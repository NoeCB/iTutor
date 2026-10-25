const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'www');
const targets = [
  path.join(__dirname, '..', 'dist'),
  path.join(__dirname, '..', 'dist', 'itutor'),
  path.join(__dirname, '..', 'dist', 'itutor', 'browser')
];

if (fs.existsSync(srcDir)) {
  for (const target of targets) {
    fs.mkdirSync(target, { recursive: true });
    fs.cpSync(srcDir, target, { recursive: true });
  }
}
