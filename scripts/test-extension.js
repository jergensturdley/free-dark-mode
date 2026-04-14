function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));

assert(manifest.manifest_version === 3, 'manifest_version must be 3');
assert(manifest.options_page === 'options.html', 'options page must exist');
assert(manifest.content_scripts?.[0]?.matches?.includes('<all_urls>'), 'must match all urls');
assert(fs.existsSync(path.join(root, 'options.html')), 'options.html missing');
assert(fs.existsSync(path.join(root, 'options.js')), 'options.js missing');
assert(fs.existsSync(path.join(root, 'scripts/test-extension.js')), 'test script missing');

console.log('extension tests passed');
