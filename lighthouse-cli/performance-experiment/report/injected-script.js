/**
 * @license
 * Copyright 2016 Google Inc. All rights reserved.
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

/* global window, document, location */

'use strict';

/**
 * @fileoverview Report script for Project Performance Experiment.
 *
 * Include functions for supporting interation between report page and Perf-X server.
 */

window.addEventListener('DOMContentLoaded', () => {
  const configPanel = new ConfigPanel();

  const blockToggles = document.querySelectorAll('.js-request-blocking__toggle');
  blockToggles.forEach(toggle => {
    const requestNode = toggle.parentNode;
    const url = requestNode.getAttribute('title');
    const unblockCallback = () => requestNode.classList.remove('request__block');

    toggle.addEventListener('click', () => {
      if (requestNode.classList.contains('request__block')) {
        requestNode.classList.remove('request__block');
        configPanel.removeBlockedUrlPattern(url);
      } else {
        requestNode.classList.add('request__block');
        configPanel.addBlockedUrlPattern(url, unblockCallback);
      }
    });

    if (requestNode.classList.contains('request__block')) {
      configPanel.addBlockedUrlPattern(url, unblockCallback);
    }
  });

  configPanel.log('');
  configPanel.show();
});

class ConfigPanel {
  constructor() {
    this._configPanel = document.querySelector('.js-config-panel');
    this._rerunButton = this._configPanel.querySelector('.js-rerun-button');
    this._messageField = this._configPanel.querySelector('.js-message');
    this._bodyToggle = this._configPanel.querySelector('.js-panel-toggle');
    this._urlBlockingList = this._configPanel.querySelector('.js-url-blocking-patterns');
    this._addButton = this._configPanel.querySelector('.js-add-button');
    this._patternInput = this._configPanel.querySelector('.js-pattern-input');

    this._blockedUrlCallbacks = {};  // {blockedUrlPattern: calcelBlockingCallbacks}

    this._rerunButton.addEventListener('click', this._rerunLighthouse.bind(this));
    this._bodyToggle.addEventListener('click', this._toggleBody.bind(this));
    this._addButton.addEventListener('click', () => {
      this._patternInput.value && this.addBlockedUrlPattern(this._patternInput.value);
      this._patternInput.value = '';
    });
    this._patternInput.addEventListener('keypress', event => {
      (event.keyCode || event.which) === 13 && this._addButton.click();
    });
  }

  /**
   * Send POST request to rerun lighthouse.
   */
  _rerunLighthouse() {
    this.log('Start Rerunning Lighthouse');

    const options = {
      blockedUrlPatterns: this.getBlockedUrlPatterns()
    };

    return fetch('/rerun', {method: 'POST', body: JSON.stringify(options)}).then(() => {
      location.reload();
    }).catch(err => {
      rerunButton.classList.remove('rerun-button__spinning');
      this.log(`Lighthouse Runtime Error: ${err}`);
    });
  }

  addBlockedUrlPattern(urlPattern, cancelCallback) {
    if (this._blockedUrlCallbacks[urlPattern]) {
      this.log(`${urlPattern} is already in the list`);
    } else {
      const template = document.querySelector('template.url-blocking-entry');
      const newEntry = document.importNode(template.content, true).querySelector('li');

      newEntry.querySelector('div').textContent = urlPattern;
      newEntry.querySelector('button').addEventListener('click', () => {
        this.removeBlockedUrlPattern(urlPattern);
      });

      this._blockedUrlCallbacks[urlPattern] = [() => {
        newEntry.parentNode.removeChild(newEntry);
      }];

      this._urlBlockingList.insertBefore(newEntry, template);
      this.log(`Added URL Blocking Pattern: ${urlPattern}`);
    }
    cancelCallback && this._blockedUrlCallbacks[urlPattern].push(cancelCallback);
  }

  removeBlockedUrlPattern(urlPattern) {
    this._blockedUrlCallbacks[urlPattern].forEach(callback => callback());
    this._blockedUrlCallbacks[urlPattern] = undefined;
    this.log(`Removed URL Blocking Pattern: ${urlPattern}`);
  }

  getBlockedUrlPatterns() {
    return Object.keys(this._blockedUrlCallbacks).filter(key => this._blockedUrlCallbacks[key]);
  }

  log(message) {
    this._messageField.innerHTML = message;
  }

  show() {
    this._configPanel.style.display = 'block';
  }

  _toggleBody() {
    this._configPanel.classList.toggle('expanded');
  }
}