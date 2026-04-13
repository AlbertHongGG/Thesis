import fs from 'node:fs';
import path from 'node:path';

function normalizeValue(rawValue) {
  const trimmed = rawValue.trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

export function loadDotEnv(envFilePath = '.env') {
  const resolvedPath = path.resolve(envFilePath);
  const content = fs.readFileSync(resolvedPath, 'utf8');

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = normalizeValue(line.slice(separatorIndex + 1));
    process.env[key] = value;
  }
}