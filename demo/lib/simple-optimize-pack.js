const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default; // 由于 traverse 采用的 ES Module 导出，我们通过 requier 引入的话就加个 .default
const babel = require('@babel/core');
var UglifyJS = require("uglify-js");

let moduleId = 0;
const queue = []; // 所有文件依赖关系的依赖图谱

const createAssets = (filename) => {
  // 缓存已经加载过的文件
  let exitItem;
  for (let item of queue) {
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

  // 将读取文件流 buffer 转换为 AST
  const ast = parser.parse(content, {
    sourceType: 'module',
  });

  const dependencies = [];

  // 通过 traverse 提供的操作 AST 的方法，获取每个节点的依赖路径
  traverse(ast, {
    ImportDeclaration: ({ node }) => {
      dependencies.push(node.source.value);
    },
  });

  // 通过 AST 将 ES6 代码转换成 ES5 代码
  const { code } = babel.transformFromAstSync(ast, null, {
    presets: ["@babel/preset-env"],
  });
  let id = moduleId++;

  return {
    id,
    filename,
    code,
    dependencies,
  };
}

createGraph = (entry) => {
  const mainAsset = createAssets(entry); // 获取入口文件下的内容
  queue.push(mainAsset);
  for (const asset of queue) {
    const dirname = path.dirname(asset.filename);
    asset.mapping = {};
    asset.dependencies.forEach(relativePath => {
      const absolutePath = path.join(dirname, relativePath); // 转换文件路径为绝对路径
      const child = createAssets(absolutePath);
      asset.mapping[relativePath] = child.id; // 保存模块ID 
      if (child.filename) {
        queue.push(child); // 递归去遍历所有子节点的文件
      }

    });
  }
  return queue;
}

function bundle(graph) {
  console.log('graph', graph);
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
            let installedModules = {};
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

const graph = createGraph('demo/src/index.js');
let result = bundle(graph);
// 压缩
result = UglifyJS.minify(result).code;
fs.writeFileSync('./build/bundle.js', result);