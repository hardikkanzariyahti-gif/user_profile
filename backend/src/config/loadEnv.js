const fs = require('fs');
const path = require('path');

function unquote(value) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function loadEnv() {
  const envPath = path.join(__dirname, '../../.env');
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, 'utf8');
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const index = trimmed.indexOf('=');
    if (index === -1) continue;

    const key = trimmed.slice(0, index).trim();
    if (!key) continue;

    const rawValue = trimmed.slice(index + 1);
    const parsedValue = unquote(rawValue);

    // Always prefer file values for DB settings to avoid stale exported shell vars.
    if (key === 'DATABASE_URL' || key === 'DIRECT_URL') {
      process.env[key] = parsedValue;
      continue;
    }

    if (process.env[key] === undefined) {
      process.env[key] = parsedValue;
    }
  }
}

module.exports = loadEnv;
