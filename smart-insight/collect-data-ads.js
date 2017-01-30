/* eslint-disable no-console */

'use strict';

/*
 *  Assign URLs in ./data/blocked-ads to blockedUrlPatterns when --block-ads in bin.ts
 *  Those URLs are not passes by flags because there are too many.
 *  Modified lighthouse-core/gather/computed/critical-request-chains.js to treat every request as
 *  critical request
 */

const exec = require('child_process').exec;
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const urlParse = require('url').parse;

function runLighthouse(url, blockAds) {
  let cmd = `node lighthouse-cli ${url} --quiet --output json --perf`;
  if (blockAds) {
    cmd += ' --block-ads';
  }

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
    const results = Object.assign({}, initValue);

    Object.keys(initValue).forEach(key => {
      let count = 0;
      let sum = 0;
      dataSet.forEach(data => {
        if (data[key] >= 0) {
          sum += data[key];
          ++count;
        }
      });

      let avg;
      if (count > 0) {
        avg = sum / count;
      } else {
        avg = -1;
      }
      results[key] = avg;
    });
    return results;
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

function executeExperiment({url, repeatTime}) {
  let run = Promise.resolve();
  const perfDataBeforeBlocking = [];
  const perfDataAfterBlocking = [];
  let screenshotBeforeBlocking;
  let screenshotAfterBlocking;
  for (let num = 0; num < repeatTime; ++num) {
    run = run
      .then(() => runLighthouse(url, true))
      .then(lhResults => {
        perfDataAfterBlocking.push(getSimplifiedResults(lhResults));
        if (!screenshotAfterBlocking) {
          const screenshots = lhResults.audits.screenshots.extendedInfo.value;
          screenshotAfterBlocking = screenshots[screenshots.length - 1];
        }
      })
      .then(() => runLighthouse(url, false))
      .then(lhResults => {
        perfDataBeforeBlocking.push(getSimplifiedResults(lhResults));
        if (!screenshotBeforeBlocking) {
          const screenshots = lhResults.audits.screenshots.extendedInfo.value;
          screenshotBeforeBlocking = screenshots[screenshots.length - 1];
        }
      });
  }
  return run
    .then(() => ({
      perfDataBeforeBlocking,
      perfDataAfterBlocking,
      screenshotBeforeBlocking,
      screenshotAfterBlocking
    }));
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

const configuration = {
  'catagory': 'block-ads',
  'repeatTime': 10
};

const dataRoot = path.join(__dirname, 'data');
fs.existsSync(dataRoot) || fs.mkdirSync(dataRoot);

const catagoryDirName = path.join(dataRoot, configuration.catagory);
fs.existsSync(catagoryDirName) || fs.mkdirSync(catagoryDirName);

const rl = readline.createInterface({input: process.stdin, output: process.stdout});

let run = Promise.resolve();
rl.write('Enter URLs. Separate by \\n. Enter stop to stop:\n');
rl.on('line', url => {
  if (url === 'stop') {
    rl.close();
    return;
  }
  url = 'http://' + url;
  const name = urlParse(url).hostname;
  run = run
    .then(() => executeExperiment(Object.assign({name, url}, configuration)))
    .then(rawData => {
      const config = Object.assign({url}, configuration);
      const summary = processRawData(rawData);
      fs.writeFileSync(path.join(catagoryDirName, `${name}-results.json`),
                       JSON.stringify({rawData, summary, config}, null, '\t'));
    })
    .catch(err => console.log(err))
    .then(() => console.log('complete: ' + url));
});
