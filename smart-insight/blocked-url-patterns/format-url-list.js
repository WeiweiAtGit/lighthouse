'use strict';

const fs = require('fs');

const urlArr = fs.readFileSync(`${__dirname}/ad-urls.txt`, 'utf8')
.split('\n').filter(line => !line.startsWith('! '));
fs.writeFileSync(`${__dirname}/ad-urls.json`,
    JSON.stringify(urlArr, null, '\t'));
