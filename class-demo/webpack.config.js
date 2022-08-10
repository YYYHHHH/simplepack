const path = require('path');
const ImgsLoader = require('./loaders/imgs-loader');
const Uglify = require('./plugins/uglify');

module.exports = {
  entry: 'class-demo/src/index.js',
  output: {
    path: path.resolve(process.cwd(), './build'),
    filename: 'bundle.js',
  },

  loaders: [{
    test: ['bmp', 'gif', 'jpeg', 'png'],
    loader: ImgsLoader,
  }],

  plugins: [
    new Uglify({
      removeConsole: true,
    }),
  ],
};
