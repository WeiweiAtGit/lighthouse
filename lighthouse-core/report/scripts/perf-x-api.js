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

/* global window, document */

'use strict';
/**
 * @fileoverview Report script for Project Performance Experiment.
 *
 * Include functions for supporting interation between report page and Perf-X server.
 * Currently not exposed to users. Only for testing Perf-X server.
 */

/**
 * Send request to rerun lighthouse with additional cli-flags.
 * Some cli-flags will be ignored. 
 	- Flags which are not applicable to rerun lighthouse (e.g. --list-all-audits, --help)
 	- config related flags (e.g. --config-path). Always use perf-olny config for rerunning.
 * @param {!Object} additionalFlags
 */
function rerunLighthouse(additionalFlags={}) {
	fetch('/rerun', {method: 'POST', body: JSON.stringify(additionalFlags)})
		.then(response => response.json())
		.then(console.log.bind(console));
}
