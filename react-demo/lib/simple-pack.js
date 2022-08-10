const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default; // 由于 traverse 采用的 ES Module 导出，我们通过 requier 引入的话就加个 .default
const babel = require('@babel/core');

let moduleId = 0;

const createAssets = (filename) => {
  const content = fs.readFileSync(filename, 'utf-8'); // 根据文件名，同步读取文件流

  // 将读取文件流 buffer 转换为 AST
  const ast = parser.parse(content, {
    sourceType: 'module',
    plugins: [
      // enable jsx and flow syntax
      "jsx",
      "flow",
    ],
  });

  const dependencies = [];

  // 通过 traverse 提供的操作 AST 的方法，获取每个节点的依赖路径
  traverse(ast, {
    ImportDeclaration: ({ node }) => {
      dependencies.push(node.source.value);
    },
  });

  // 通过 AST 将 代码转换成 浏览器识别的代码
  const { code } = babel.transformFromAstSync(ast, null, {
    presets: ["@babel/preset-env", "@babel/preset-react"],
  });
  let id = moduleId++;

  let obj = {
    id,
    filename,
    code,
    dependencies,
  };
  return obj;
}

createGraph = (entry) => {
  const mainAsset = createAssets(entry); // 获取入口文件下的内容
  let queue = [mainAsset]; // 入口文件的结果作为第一项
  for (const asset of queue) {
    const dirname = path.dirname(asset.filename);
    asset.mapping = {};
    asset.dependencies.forEach(relativePath => {
      const absolutePath = path.join(dirname, relativePath); // 转换文件路径为绝对路径
      const child = createAssets(absolutePath);
      asset.mapping[relativePath] = child.id; // 保存模块ID 
      queue.push(child); // 递归去遍历所有子节点的文件
    });
  }
  return queue;
}

function bundle(graph) {
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
const graph = createGraph('react-demo/src/index.js');
const result = bundle(graph);
fs.writeFileSync('./build/bundle.js', result);