const UglifyJS = require("uglify-js");

module.exports = class Uglify {
  constructor(options) {
    console.log(12, options);
  }

  apply(compiler) {
    compiler.hooks.beforeEmitFile.tap('optimize', this.optimize.bind(this, compiler));
  }

  // 压缩
  optimize(compiler, result) {
    compiler.bundles = UglifyJS.minify(result).code;
  }
}