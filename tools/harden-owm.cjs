'use strict';
// Upstream 1.0.1 sends current-weather credentials over HTTP. Keep the required
// OWM node, but require HTTPS. This narrow, version-guarded patch is documented.
const fs = require('node:fs');
const path = require('node:path');
const root = path.dirname(require.resolve('node-red-node-openweathermap/package.json'));
const info = require(path.join(root, 'package.json'));
if (info.version !== '1.0.1') throw Error('Review the OWM transport patch for this version');
const file = path.join(root, 'weather.js');
const source = fs.readFileSync(file, 'utf8');
const patched = source.replaceAll('http://api.openweathermap.org/', 'https://api.openweathermap.org/');
if (!patched.includes('https://api.openweathermap.org/data/2.5/weather?')) throw Error('OWM HTTPS patch failed');
if (patched !== source) fs.writeFileSync(file, patched);
console.log('OWM current/forecast transport: HTTPS enforced (node version 1.0.1).');
