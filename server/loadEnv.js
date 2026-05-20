import fs from 'node:fs';
import path from 'node:path';

export function loadLocalEnv() {
  const envPath = path.join(process.cwd(), '.env');

  if (!fs.existsSync(envPath)) {
    return;
  }

  const raw = fs.readFileSync(envPath, 'utf8').trim();

  if (!raw) {
    return;
  }

  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  if (lines.length === 1 && !lines[0].includes('=')) {
    process.env.ANTHROPIC_API_KEY ||= lines[0];
    return;
  }

  lines.forEach((line) => {
    if (line.startsWith('#')) {
      return;
    }

    const separatorIndex = line.indexOf('=');

    if (separatorIndex === -1) {
      return;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');

    if (key && value) {
      process.env[key] ||= value;
    }
  });
}
