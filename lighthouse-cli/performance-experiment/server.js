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
const path = require('path');
const opn = require('opn');
const stringify = require('json-stringify-safe');
const log = require('../../lighthouse-core/lib/log');
const ReportGenerator = require('../../lighthouse-core/report/report-generator');
const lighthouse = require('../../lighthouse-core');
const perfOnlyConfig = require('../../lighthouse-core/config/perf.json');

/**
 * Start the server with an arbitrary port and open report page in the default browser.
 * @param {!Object} lighthouseParams
 * @param {!Object} results
 * @return {!Promise<string>} Promise that resolves when server is closed
 */
let lhResults;
let lhParams;
function serveAndOpenReport(lighthouseParams, results) {
  lhParams = lighthouseParams;
  lhResults = results;
  return new Promise(resolve => {
    const server = http.createServer(requestHandler);
    server.listen(0);
    server.on('listening', () => {
      opn(`http://localhost:${server.address().port}/`);
    });
    server.on('error', err => log.error('PerformanceXServer', err.code, err));
    server.on('close', resolve);
    process.on('SIGINT', () => {
      server.close();
    });
  });
}

function requestHandler(request, response) {
  const pathname = path.normalize(parse(request.url).pathname);
  if (request.method === 'GET') {
    if (pathname === '/') {
      reportRequestHandler(request, response);
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
  const reportGenerator = new ReportGenerator();
  const html = reportGenerator.generateHTML(lhResults, 'perf-x');
  response.writeHead(200, {'Content-Type': 'text/html'});
  response.end(html);
}

function rerunRequestHandler(request, response) {
  try {
    let message = '';
    request.on('data', data => message += data);

    request.on('end', () => {
      const additionalFlags = JSON.parse(message);

      // Add more to flags without changing the original flags
      const flags = Object.assign({}, lhParams.flags, additionalFlags);
      lighthouse(lhParams.url, flags, perfOnlyConfig).then(results => {
        results.artifacts = undefined;
        response.writeHead(200, {'Content-Type': 'text/json'});
        response.end(stringify(results));
      });
    });
  } catch (e) {
    response.writeHead(500);
    response.end('500: Internal Server Error');
  }
}


module.exports = {
  serveAndOpenReport
};
