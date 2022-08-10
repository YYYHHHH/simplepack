import { info } from './info.js';
import { text } from './text.js';
import imgs from '../../asset/imgs/eg.png'

document.write(`${info}，${text}`);
let img = document.createElement('img');
img.src = imgs;
document.body.appendChild(img);