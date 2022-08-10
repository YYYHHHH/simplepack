const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default; // 由于 traverse 采用的 ES Module 导出，我们通过 requier 引入的话就加个 .default
const babel = require('@babel/core');
const { SyncHook } = require('tapable');

module.exports = class Webpack {
  constructor(options) {
    // webpack 配置
    const { entry, output, loaders, plugins } = options;

    this.entry = entry;
    this.output = output;
    this.loaders = loaders || [];
    this.plugins = plugins || [];

    // 模块
    this.modules = [];
    this.moduleId = 0;

    this.hooks = {
      beforeEmitFile: new SyncHook(['arg1']),
    };

    for (let i of this.plugins) {
      i.apply(this);
    }
  }

  run(cb = () => { }) {
    try {
      let graph = this.createGraph(this.entry);
      this.bundles = this.getBundle(graph);
      this.emitFiles();
      cb('succeed!');
    } catch (e) {
      cb(e);
    }
  }

  createAssets = (filename) => {
    // 缓存已经加载过的文件
    let exitItem;
    for (let item of this.modules) {
      if (item.filename === filename) {
        exitItem = item;
        break;
      }
    }
    if (exitItem) {
      return {
        id: exitItem.id,
      };
    }

    const content = fs.readFileSync(filename, 'utf-8'); // 根据文件名，同步读取文件流
    let ext = filename.split('.').pop();
    const dependencies = [];
    let code = '';

    if (ext === 'js') {
      // 将读取文件流 buffer 转换为 AST
      const ast = parser.parse(content, {
        sourceType: 'module',
      });

      // 通过 traverse 提供的操作 AST 的方法，获取每个节点的依赖路径
      traverse(ast, {
        ImportDeclaration: ({ node }) => {
          dependencies.push(node.source.value);
        },
      });
      // 通过 AST 将 ES6 代码转换成 ES5 代码
      code = babel.transformFromAstSync(ast, null, {
        presets: ["@babel/preset-env"],
      }).code;
    } else {
      // loaders
      for (let i of this.loaders) {
        if (i.test.includes(ext)) {
          code = i.loader(filename);
        }
      }
    }

    let id = this.moduleId++;
    let obj = {
      id,
      filename,
      code,
      dependencies,
    };
    return obj;
  }

  createGraph = (entry) => {
    const mainAsset = this.createAssets(entry); // 获取入口文件下的内容
    this.modules.push(mainAsset); // 入口文件的结果作为第一项
    for (const asset of this.modules) {
      const dirname = path.dirname(asset.filename);
      asset.mapping = {};
      asset.dependencies.forEach(relativePath => {
        const absolutePath = path.join(dirname, relativePath); // 转换文件路径为绝对路径
        const child = this.createAssets(absolutePath);
        asset.mapping[relativePath] = child.id; // 保存模块ID 
        if (child.filename) { // 新的module
          this.modules.push(child); // 递归去遍历所有子节点的文件
        }
      });
    }
    return this.modules;
  }

  getBundle = (graph) => {
    let modules = '';
    graph.forEach(item => {
      modules += `
            ${item.id}: [
                function (require, module, exports){
                    ${item.code}
                },
                ${JSON.stringify(item.mapping)}
            ],
        `
    });

    return `
          (function(modules){
              function require(id){
                  const [fn, mapping] = modules[id];
                  function localRequire(relativePath){
                      return require(mapping[relativePath]);
                  }
                  const module = {
                      exports: {}
                  }
                  fn(localRequire, module, module.exports);
                  return module.exports;
              }
              require(0);
          })({${modules}})
      `
  }

  emitFiles = () => {
    const filePath = path.join(this.output.path, this.output.filename);
    this.hooks.beforeEmitFile.call(this.bundles);
    fs.writeFileSync(filePath, this.bundles, 'utf-8');
  }
}