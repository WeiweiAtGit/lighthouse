/**
 * Copyright 2017 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

/* eslint-env mocha */
const assert = require('assert');
const http = require('http');

const perfXServer = require('./performance-experiment/server');
const sampleResults = require('../../../../lighthouse-core/test/results/sample');
const config = require('../../../../lighthouse-core/config/perf');

describe('Perf-X Server', function() {
  let server;

  before(done => {
    const lhParams = {
      url: sampleResults.initialUrl,
      flags: {
        disableCpuThrottling: true,
        disableNetworkThrottling: false,
        disableDeviceEmulation: false
      },
      config
    };

    server = perfXServer.hostExperiment(lhParams, sampleResults);
    server.once('listening', () => done());
  });

  after(done => {
    server.once('close', () => done());
    server.close();
  });

  function testReportRequest(reportId, done) {
    const options = {
      port: server.address().port,
      path: reportId ? `/?id=${reportId}` : '/'
    };

    const request = http.request(options, response => {
      assert.strictEqual(response.statusCode, 200);

      let html = '';
      response.on('data', data => html += data);
      response.on('end', () => {
        assert.ok(/data-report-context="perf-x"/gim.test(html));
        done();
      });
    });
    request.end();
  }

  server.on('listening', () => {
    it('can handle report requests', done => testReportRequest(null, done));

    it('can handle rerun requests', done => {
      const options = {
        port: server.address().port,
        method: 'POST',
        path: '/rerun'
      };

      const request = http.request(options, response => {
        assert.strictEqual(response.statusCode, 200);

        let newReportKey = '';
        response.on('data', data => newReportKey += data);
        response.on('end', () => testReportRequest(newReportKey, done));
      });
      request.end();
    });
  });
});
