const Webpack = require('./lib/webpack');
const options = require('./webpack.config');

const compiler = new Webpack(options);
compiler.run((msg) => {
  console.log(msg);
});