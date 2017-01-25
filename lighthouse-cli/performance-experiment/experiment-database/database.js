/**
 * @license
 * Copyright 2017 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf');
const PerfXReportGenerator = require('../report/perf-x-report-generator');
const assetSaver = require('../../../lighthouse-core/lib/asset-saver');

class ExperimentDatabase {
  constructor(url, config) {
    this._url = url;
    this._config = config;

    this._root = fs.mkdtempSync(`${__dirname}/experiment-data-`);
    this._timeStamps = {};
  }

  get url() {
    return this._url;
  }

  get config() {
    return this._config;
  }

  saveData(lhFlags, lhResults) {
    const id = assetSaver.getFilenamePrefix(lhResults);
    this._timeStamps[id] = lhResults.generatedTime;

    const dirPath = path.join(this._root, id);
    fs.mkdirSync(dirPath);
    fs.writeFileSync(path.join(dirPath, 'flags.json'), JSON.stringify(lhFlags));
    fs.writeFileSync(path.join(dirPath, 'results.json'), JSON.stringify(lhResults));
    return id;
  }

  getHTML(id) {
    const results = JSON.parse(fs.readFileSync(path.join(this._root, id, 'results.json'), 'utf8'));
    results.relatedReports = Object.keys(this._timeStamps)
      .filter(key => key !== id)
      .map(key => {
        const generatedTime = this._timeStamps[key];
        return {reportUrl: `/?id=${key}`, url: this._url, generatedTime};
      });

    const perfXReportGenerator = new PerfXReportGenerator();
    return perfXReportGenerator.generateHTML(results, 'perf-x');
  }

  getFlags(id) {
    return JSON.parse(fs.readFileSync(path.join(this._root, id, 'flags.json'), 'utf8'));
  }

  clear() {
    return new Promise((resolve, reject) => {
      rimraf(this._root, () => resolve());
    });
  }
}

module.exports = ExperimentDatabase;
