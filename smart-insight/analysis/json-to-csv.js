'use strict';
const fs = require('fs');

fs.readdir(`${__dirname}/../data/block-fonts`, (err, filenames) => {
  if (err) {
    console.error(err);
    return;
  }

  const blockedCsv = `${__dirname}/block-fonts.csv`;
  const originCsv = `${__dirname}/origin.csv`;

  filenames.forEach(filename => {
    const data = JSON.parse(fs.readFileSync(`${__dirname}/../data/block-fonts/${filename}`,
        'utf8'));
    const originLine = data.config.url + ',' + data.rawData.perfDataBeforeBlocking
      .map(perfData => perfData['first-meaningful-paint'])
      .join(',') + '\n';
    fs.appendFileSync(originCsv, originLine);
    const blockedLine = data.config.url + ',' + data.rawData.perfDataAfterBlocking
      .map(perfData => perfData['first-meaningful-paint'])
      .join(',') + '\n';
    fs.appendFileSync(blockedCsv, blockedLine);
  });
});
