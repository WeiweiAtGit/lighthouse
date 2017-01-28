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
    this._defaultId = undefined;

    this._fsRoot = fs.mkdtempSync(`${__dirname}/experiment-data-`);
    this._timeStamps = {};
  }

  get url() {
    return this._url;
  }

  get config() {
    return this._config;
  }

  /*
   * Save experiment data
   * @param {!Object} lhFlags
   * @param {!Object} lhResults
   */
  saveData(lhFlags, lhResults) {
    const id = assetSaver.getFilenamePrefix(lhResults);
    this._timeStamps[id] = lhResults.generatedTime;

    const dirPath = path.join(this._fsRoot, id);
    fs.mkdirSync(dirPath);
    fs.writeFileSync(path.join(dirPath, 'flags.json'), JSON.stringify(lhFlags));
    fs.writeFileSync(path.join(dirPath, 'results.json'), JSON.stringify(lhResults));
    return id;
  }

  /*
   * Get report.html
   * @param {string} id
   */
  getHTML(id) {
    const perfXReportGenerator = new PerfXReportGenerator();

    const results = JSON.parse(fs.readFileSync(path.join(this._fsRoot, id, 'results.json'),
        'utf8'));

    const reportsInfo = Object.keys(this._timeStamps)
      .map(key => {
        const generatedTime = this._timeStamps[key];
        return {url: this._url, id: key, generatedTime};
      });
    perfXReportGenerator.setReportsCatalog(reportsInfo, id);

    return perfXReportGenerator.generateHTML(results, 'perf-x');
  }

  /*
   * Get flags.json
   * @param {string} id
   */
  getFlags(id) {
    id = id || this._defaultId;
    return JSON.parse(fs.readFileSync(path.join(this._fsRoot, id, 'flags.json'), 'utf8'));
  }

  /*
   * Delete all the files created by this object
   */
  clear() {
    rimraf.sync(this._fsRoot);
  }
}

module.exports = ExperimentDatabase;
