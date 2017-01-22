'use strict';

const exec = require('child_process').exec;
const fs = require('fs');
const path = require('path');

const websites = [
  {url: 'http://localhost:8887/', blockedUrlPatterns: ['*cat.jpg', '*cat2.jpg']}
];

function testWebsite(url, blockedUrlPatterns) {
  // eslint-disable-next-line max-len
  const cmd = `node lighthouse-cli ${url} --quiet --output json --perf --blocked-url-patterns ${blockedUrlPatterns.join(' ')}`;
  console.log(cmd);

  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      stderr && console.error(stderr);
      resolve(JSON.stringify(stdout));
    });
  });
}

function experiment(url, blockedUrlPatterns, repeat) {
  let run = Promise.resolve();
  const dirName = path.join(__dirname, url.substr(0, min(url.length, 20)));
  fs.mkdirSync(dirName);
  const blockedData = [];
  const nonBlockedData = [];
  for (let num = 0; num < repeat; ++num) {
    run = run
      .then(() => testWebsite(url))
      .then(lhResults => {
        nonBlockedData.push(getSimplifiedResults(lhResults));
      })
      .then(() => testWebsite(url, ['n', ...blockedUrlPatterns]))
      .then(lhResults => {
        blockedData.push(getSimplifiedResults(lhResults));
      });
  }
  return run
    .then();
}

function getSimplifiedResults(lhResults) {
  const audits = lhResults.audits;
  return {
    'first-meaningful-paint': audits['first-meaningful-paint'].rawValue,
    'speed-index-metric': audits['speed-index-metric'].rawValue,
    'time-to-interactive': audits['time-to-interactive'].rawValue
  };
}

let run = Promise.resolve();
for (const {url, blockedUrlPatterns} of websites) {
  run = run.then(() => experiment(url, blockedUrlPatterns, 5));
}
