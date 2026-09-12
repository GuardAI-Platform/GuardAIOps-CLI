import { readFileSync } from 'node:fs';

export function readVersion() {
  const packageJsonUrl = new URL('../package.json', import.meta.url);
  return JSON.parse(readFileSync(packageJsonUrl, 'utf8')).version;
}
