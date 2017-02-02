'use strict';
const fs = require('fs');

fs.readdir(`${__dirname}/../data/block-fonts`, (err, filenames) => {
  if (err) {
    console.error(err);
    return;
  }

  let predictFailRates = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  filenames.forEach(filename => {
    const data = JSON.parse(fs.readFileSync(`${__dirname}/../data/block-fonts/${filename}`,
        'utf8'));
    const originLine = data.rawData.perfDataBeforeBlocking
        .map(perfData => perfData['first-meaningful-paint']);

    if (originLine.every(num => num < 0)) {
      return;
    }

    for (let i = 0; i < 10; ++i) {
      let predictFailCount = 0;
      originLine.forEach(base => {
        if (base < 0) {
          return;
        }
        originLine.forEach(other => {
          if (other > 0 && (base - other) / base > (i + 1) / 10) {
            ++predictFailCount;
          }
        });
      });

      predictFailRates[i] += predictFailCount /
          (originLine.filter(num => num > 0).length * originLine.length);
    }
  });

  predictFailRates = predictFailRates.map(num => num / filenames.length);
  console.log(predictFailRates.join('\t'));
});
