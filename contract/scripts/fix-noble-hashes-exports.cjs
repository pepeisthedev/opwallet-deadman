#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const pkgPath = path.join(__dirname, '..', 'node_modules', '@noble', 'hashes', 'package.json');

if (!fs.existsSync(pkgPath)) {
  console.warn('[legacy-vault] @noble/hashes not installed yet, skipping compatibility patch');
  process.exit(0);
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
if (!pkg.exports || typeof pkg.exports !== 'object') {
  console.warn('[legacy-vault] unexpected @noble/hashes package.json exports format, skipping');
  process.exit(0);
}

const aliases = {
  './sha256': './sha2.js',
  './sha512': './sha2.js',
  './pbkdf2': './pbkdf2.js',
  './utils': './utils.js'
};

let changed = false;
for (const [k, v] of Object.entries(aliases)) {
  if (!(k in pkg.exports)) {
    pkg.exports[k] = v;
    changed = true;
  }
}

if (!changed) {
  console.log('[legacy-vault] @noble/hashes exports already compatible');
  process.exit(0);
}

fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
console.log('[legacy-vault] patched @noble/hashes exports for bip39 compatibility');
