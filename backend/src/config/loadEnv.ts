import * as fs from 'fs';
import * as path from 'path';

function unquote(value: string): string {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function loadEnv(): void {
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

    if (key === 'DATABASE_URL' || key === 'DIRECT_URL') {
      process.env[key] = parsedValue;
      continue;
    }

    if (process.env[key] === undefined) {
      process.env[key] = parsedValue;
    }
  }
}

export default loadEnv;
