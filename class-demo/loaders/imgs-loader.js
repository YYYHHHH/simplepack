const fs = require('fs');
const crypto = require('crypto');

module.exports = function ImgsLoader(filename) {
  const hash = crypto.createHash('md5', filename).digest('hex');

  let filenameArr = filename.split('.');
  let ext = filenameArr.pop();
  filenameArr.push(hash);
  let _filename = filenameArr.join('.');

  fs.copyFile(filename, `build/${_filename}.${ext}`, function (err) {
    if (err) console.log(err);
  });

  let code = `"use strict";

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.default = void 0;
    var imgs = '${_filename}.${ext}';
    exports.default = imgs;`;
  return code;
}