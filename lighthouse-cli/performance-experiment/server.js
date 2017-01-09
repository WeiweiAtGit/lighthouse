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
const opn = require('opn');
const log = require('../../lighthouse-core/lib/log');
const reportGenerator = new (require('../../lighthouse-core/report/report-generator'))();
const lighthouse = require('../../lighthouse-core');
const perfOnlyConfig = require('../../lighthouse-core/config/perf.json');

const hostedExperiments = {};

/**
 * Start the server with an arbitrary port and open report page in the default browser.
 * @param {!Object} params A JSON contains lighthouse parameters
 * @param {!Object} results
 * @param {!Object} artifacts
 * @return {!Promise<string>} Promise that resolves when server is closed
 */
function hostExperiment(params, results, artifacts) {
  hostedExperiments.original = {params, results, artifacts};
  return new Promise(resolve => {
    const server = http.createServer(requestHandler);
    server.listen(0);
    server.on('listening', () => {
      opn(`http://localhost:${server.address().port}/?id=original`);
    });
    server.on('error', err => log.error('PerformanceXServer', err.code, err));
    server.on('close', resolve);
    process.on('SIGINT', () => {
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
  const experimentData = hostedExperiments[request.parsedUrl.query.id || 'original'];
  if (!experimentData) {
    response.writeHead(404);
    response.end('404: Resource Not Found');
    return;
  }

  const html = reportGenerator.generateHTML(experimentData.results, 'perf-x');
  response.writeHead(200, {'Content-Type': 'text/html'});
  response.end(html);
}

function rerunRequestHandler(request, response) {
  let message = '';
  request.on('data', data => message += data);

  request.on('end', () => {
    const configs = JSON.parse(message);
    let blockedUrlPatterns = configs.blockedUrlPatterns || [];

    const networkRequests = hostedExperiments.original.artifacts.networkRecords.defaultPass;
    if (configs.blockedMimeTypes) { 
      const filterFn = request => {
        return configs.blockedMimeTypes.indexOf(request.mimeType) > -1;
      };
      blockedUrlPatterns.push(...networkRequests.filter(filterFn).map(request => request.url));
    }

    // Add more to flags without changing the original flags
    const flags = Object.assign({}, hostedExperiments.original.params.flags, {blockedUrlPatterns});

    const url = hostedExperiments.original.params.url;
    lighthouse(url, flags, perfOnlyConfig).then(results => {
      const artifacts = results.artifacts;
      results.artifacts = undefined;
      hostedExperiments.rerun = {params: {url, flags}, results, artifacts};
      response.writeHead(200, {'Content-Type': 'text/plain'});
      response.end('/?id=rerun');
    });
  });
}

module.exports = {
  hostExperiment
};
