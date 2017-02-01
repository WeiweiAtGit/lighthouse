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

const PerfXDatabase = require('../../../performance-experiment/experiment-database/database');
const sampleResults = require('../../../../lighthouse-core/test/results/sample');

describe('Perf-X Database', function() {
  it('can store and output experiments data', () => {
    const perfXDatabase = new PerfXDatabase();
    process.on('exit', () => perfXDatabase.clear());

    const testCases = [
      {
        flags: {
          'blockedUrlPatterns': ['.woff2', '.jpg'],
          'disable-network-throttling': false
        },
        results: sampleResults
      },
      {
        flags: {
          'blockedUrlPatterns': ['.woff'],
          'disable-cpu-throttling': true,
          'deep-reference': {'an-object': {'an array': ['something', 'an element']}}
        },
        results: {
          generatedTime: new Date(2015, 6, 37, 0, 12, 55, 60).toJSON(),
          url: 'http://google.com/',
          else: 'some-data'
        }
      },
      {
        flags: {
          'blockedUrlPatterns': ['.woff', 'cat.jpg', '*'],
          'disable-cpu-throttling': false,
          'disable-device-emulation': true
        },
        results: {
          'generatedTime': new Date(2014, 5, 36, 23, 56, 54, 99).toJSON(),
          'url': 'http://mdn.com/',
          'audits': [{'is-on-https': {'score': true}}],
        }
      }
    ];

    testCases.forEach(testCase => {
      testCase.key = perfXDatabase.saveData(testCase.flags, testCase.results);
    });

    testCases.forEach(testCase => {
      assert.deepStrictEqual(perfXDatabase.getFlags(testCase.key), testCase.flags);
      assert.deepStrictEqual(perfXDatabase.getResults(testCase.key), testCase.results);
    });
  });

  it('prevents data from being changed by reference', () => {
    const perfXDatabase = new PerfXDatabase();
    process.on('exit', () => perfXDatabase.clear());

    const flags = {
      'blockedUrlPatterns': ['.woff', '.jpg', 'random'],
      'disable-cpu-throttling': false,
      'some-random-flag': 'some random value'
    };
    const results = JSON.parse(JSON.stringify(sampleResults));

    const key = perfXDatabase.saveData(flags, results);
    const flagsBeforeChange = JSON.parse(JSON.stringify(perfXDatabase.getFlags(key)));
    const resultsBeforeChange = JSON.parse(JSON.stringify(perfXDatabase.getResults(key)));

    // data won't be changed when the falgs/results passed to perfXDatabase.saveData is changed
    flags.blockedUrlPatterns.push('something');
    results.url = undefined;

    // data won't be changed when the falgs/results returned by perfXDatabase is changed
    perfXDatabase.getFlags(key)['another attribute'] = 'random value';
    perfXDatabase.getResults(key).aggregations.push('something-else');

    assert.deepStrictEqual(perfXDatabase.getFlags(key), flagsBeforeChange);
    assert.deepStrictEqual(perfXDatabase.getResults(key), resultsBeforeChange);
  });

  it('returns correct timestamps', () => {
    const perfXDatabase = new PerfXDatabase();
    process.on('exit', () => perfXDatabase.clear());

    const testCases = [
      {
        results: sampleResults
      },
      {
        results: {
          generatedTime: new Date(2015, 6, 37, 0, 12, 55, 60).toJSON(),
          url: 'http://google.com/',
        }
      },
      {
        results: {
          'generatedTime': new Date(2014, 5, 36, 23, 56, 54, 99).toJSON(),
          'url': 'http://mdn.com/',
        }
      }
    ];

    testCases.forEach(testCase => {
      testCase.key = perfXDatabase.saveData({}, testCase.results);
    });

    testCases.forEach(testCase => {
      assert.strictEqual(perfXDatabase.timeStamps[testCase.key], testCase.results.generatedTime);
    });
  });
});
