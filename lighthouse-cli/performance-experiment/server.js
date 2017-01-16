/**
 * @license
 * Copyright 2016 Google Inc. All Rights Reserved.
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
/**
 * @fileoverview Server script for Project Performance Experiment.
 *
 * Functionality:
 *    Host experiment.
 *    Report can be access via URL http://localhost:[PORT]/
 *    Rerun data can be access via URL http://localhost:[PORT]/rerun.
 *      This will rerun lighthouse with same parameters and rerun results in JSON format
 */

const http = require('http');
const parse = require('url').parse;
const fs = require('fs');
const opn = require('opn');
const log = require('../../lighthouse-core/lib/log');
const PerfXReportGenerator = require('./report/perf-x-report-generator');
const lighthouse = require('../../lighthouse-core');

let database;
/**
 * Start the server with an arbitrary port and open report page in the default browser.
 * @param {!Object} params A JSON contains lighthouse parameters
 * @param {!Object} results
 * @return {!Promise<string>} Promise that resolves when server is closed
 */
function hostExperiment(params, results) {
  return new Promise(resolve => {
    database = new ExperimentDatabase(params.url, params.config);
    const id = database.saveData(params, results);
    const server = http.createServer(requestHandler);
    server.listen(0);
    server.on('listening', () => opn(`http://localhost:${server.address().port}/?id=${id}`));
    server.on('error', err => log.error('PerformanceXServer', err.code, err));
    server.on('close', resolve);
    process.on('SIGINT', () => {
      database.clear();
      server.close();
    });
  });
}

function requestHandler(request, response) {
  request.parsedUrl = parse(request.url, true);
  const pathname = request.parsedUrl.pathname;

  if (request.method === 'GET') {
    if (pathname === '/') {
      reportRequestHandler(request, response);
    } else if (pathname === '/blocked-url-patterns') {
      blockedUrlPatternsRequestHandler(request, response);
    } else {
      response.writeHead(404);
      response.end('404: Resource Not Found');
    }
  } else if (request.method === 'POST') {
    if (pathname === '/rerun') {
      rerunRequestHandler(request, response);
    } else {
      response.writeHead(404);
      response.end('404: Resource Not Found');
    }
  } else {
    response.writeHead(405);
    response.end('405: Method Not Supported');
  }
}

function reportRequestHandler(request, response) {
  try {
    const id = request.parsedUrl.query.id || 0;
    const [params, results] = database.getData(id);
    results.previousReports = [];
    results.followingReports = [];
    database.timeStamps.forEach((generatedTime, index) => {
      const report = {url:`/?id=${index}`, generatedTime};
      if (index < id) {
        results.previousReports.push(report);
      } else if (index > id) {
        results.followingReports.push(report);
      }
    });
    const html = (new PerfXReportGenerator()).generateHTML(results, 'perf-x');
    response.writeHead(200, {'Content-Type': 'text/html'});
    response.end(html);
  } catch (err) {
    response.writeHead(404);
    response.end('404: Resource Not Found');
  }
}

function blockedUrlPatternsRequestHandler(request, response) {
  response.writeHead(200, {'Content-Type': 'text/json'});
  response.end(JSON.stringify(lhParams.flags.blockedUrlPatterns || []));
}

function rerunRequestHandler(request, response) {
  try {
    const [flags, results] = database.getData(request.parsedUrl.query.id || 0);
    let message = '';
    request.on('data', data => message += data);

    request.on('end', () => {
      const additionalFlags = JSON.parse(message);
      Object.assign(flags, additionalFlags);

      lighthouse(database.url, flags, database.config).then(results => {
        results.artifacts = undefined;
        const id = database.saveData(flags, results);
        response.writeHead(200);
        response.end(`/?id=${id}`);
      });
    });
  } catch (err) {
    response.writeHead(404);
    response.end('404: Resource Not Found');
  }
}

class ExperimentDatabase {
  constructor(url, config) {
    this._url = url;
    this._config = config;

    this._root = fs.mkdtempSync(`${__dirname}/experiment-data`);
    this._timeStamps = [];
  }

  get url() {return this._url;}
  get config() {return this._config;}
  get timeStamps() {return this._timeStamps;}

  saveData(lhFlags, lhResults) {
    const id = this._timeStamps.length;
    this._timeStamps.push(lhResults.generatedTime);
    fs.writeFileSync(`${this._root}/flags-${id}.json`, JSON.stringify(lhFlags));
    fs.writeFileSync(`${this._root}/results-${id}.json`, JSON.stringify(lhResults));
    return id;
  }

  getData(id) {
    const flags = require(`${this._root}/flags-${id}.json`);
    const results = require(`${this._root}/results-${id}.json`);
    return [flags, results];
  }

  clear() {
    fs.readdirSync(this._root).forEach(filename => fs.unlinkSync(`${this._root}/${filename}`));
    fs.rmdirSync(this._root);
  }
}

module.exports = {
  hostExperiment
};
