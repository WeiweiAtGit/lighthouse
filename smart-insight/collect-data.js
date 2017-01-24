'use strict';

/*
 *  Added --blocked-url-patterns as an array flag to lighthouse-cli/bin.ts
 *  Modified lighthouse-core/gather/computed/critical-request-chains.js to treat every request as
 *  critical request
 */

const exec = require('child_process').exec;
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const urlParse = require('url').parse;

function runLighthouse(url, blockedUrlPatterns) {
  let cmd = `node lighthouse-cli ${url} --quiet --output json --perf`;
  if (blockedUrlPatterns && blockedUrlPatterns.length >= 1) {
    // to deal with a bug where yargs does not convert parameters to an array when the array is of
    // length 1 and the flag is accessed via camel case attribute name (issue #768)
    if (blockedUrlPatterns.length === 1) {
      blockedUrlPatterns.push('to-make-it-become-a-list');
    }
    cmd += ` --blocked-url-patterns ${blockedUrlPatterns.join(' ')}`;
  }
  console.log(cmd);

  return new Promise((resolve, reject) => {
    exec(cmd, {maxBuffer: 16 * 1024 * 1024}, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      stderr && console.error(stderr);
      resolve(JSON.parse(stdout));
    });
  });
}

function getSimplifiedResults(lhResults) {
  const audits = lhResults.audits;
  return {
    'first-meaningful-paint': audits['first-meaningful-paint'].rawValue,
    'speed-index-metric': audits['speed-index-metric'].rawValue,
    'time-to-interactive': audits['time-to-interactive'].rawValue
  };
}

function processRawData(rawData) {
  const initValue = {
    'first-meaningful-paint': 0,
    'speed-index-metric': 0,
    'time-to-interactive': 0
  };

  function getAvg(dataSet) {
    const sumObj = Object.assign({}, initValue);
    dataSet.forEach(data => {
      Object.keys(sumObj).forEach(key => {
        sumObj[key] += data[key];
      });
    });
    Object.keys(sumObj).forEach(key => {
      sumObj[key] /= dataSet.length;
    });
    return sumObj;
  }

  const avgBeforeBlocking = getAvg(rawData.perfDataBeforeBlocking);
  const avgAfterBlocking = getAvg(rawData.perfDataAfterBlocking);

  const diff = Object.assign({}, initValue);
  Object.keys(diff).forEach(key => {
    const absDiff = avgAfterBlocking[key] - avgBeforeBlocking[key];
    diff[key] = {
      'abs-diff': absDiff,
      'rel-diff': absDiff / avgBeforeBlocking[key]
    };
  });

  return {avgBeforeBlocking, avgAfterBlocking, diff};
}

function executeExperiment({url, blockedUrlPatterns, repeatTime}) {
  let run = Promise.resolve();
  const perfDataBeforeBlocking = [];
  const perfDataAfterBlocking = [];
  for (let num = 0; num < repeatTime; ++num) {
    run = run
      .then(() => runLighthouse(url, blockedUrlPatterns))
      .then(lhResults => {
        perfDataAfterBlocking.push(getSimplifiedResults(lhResults));
      })
      .then(() => runLighthouse(url))
      .then(lhResults => {
        perfDataBeforeBlocking.push(getSimplifiedResults(lhResults));
      });
  }
  return run
    .then(() => ({perfDataBeforeBlocking, perfDataAfterBlocking}));
}

// eslint-disable-next-line no-unused-vars
function getResourcesOfType(requestTree, type) {
  const resources = [];
  for (const key of Object.keys(requestTree)) {
    const request = requestTree[key].request;
    if (request.resourceType === type) {
      resources.push(request);
    }
    resources.push(...getResourcesOfType(requestTree[key].children, type));
  }
  return resources;
}

const config = {
  'catagory': 'block-fonts',
  // eslint-disable-next-line max-len
  'blockedUrlPatterns': fs.readFileSync(path.join(__dirname, 'blocked-url-patterns/font-urls.txt'), 'utf8').split('\n').filter(line => !line.startsWith('! ')),
  'repeatTime': 10
};

const catagoryDirName = path.join(__dirname, 'data', config.catagory);
fs.existsSync(catagoryDirName) || fs.mkdirSync(catagoryDirName);

const rl = readline.createInterface({input: process.stdin, output: process.stdout});

let run = Promise.resolve();
rl.write('Enter URLs. Separate by \\n. Enter stop to stop:\n');
rl.on('line', url => {
  if (url === 'stop') {
    run.then(() => console.log('complete'));
    rl.close();
    return;
  }
  const name = urlParse(url).hostname;
  run = run
    .then(() => executeExperiment(Object.assign({name, url}, config)))
    .then(rawData => {
      const summary = processRawData(rawData);
      const results = {rawData, summary};
      fs.writeFileSync(path.join(catagoryDirName, `${name}.json`),
                       JSON.stringify(Object.assign(results, {config}), null, '\t'));
    })
    .catch(err => console.log(err));
});
