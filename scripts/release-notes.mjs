// Prints one version's entry from the README's 버전 기록, which becomes that GitHub Release's notes.
// bubuddy-dev.github.io shows release notes as the game's patch notes, so they are written only in the README.
// Usage: node scripts/release-notes.mjs [version]   (defaults to package.json's version)
import { readFileSync } from 'node:fs';

const version = process.argv[2] ?? JSON.parse(readFileSync('package.json', 'utf8')).version;
const lines = readFileSync('README.md', 'utf8').split('\n');
const start = lines.indexOf(`### ${version}`);
if (start < 0) {
  console.error(`README.md has no "### ${version}" entry under 버전 기록. Write the release notes there first.`);
  process.exit(1);
}
const end = lines.findIndex((line, i) => i > start && (/^#{1,3} /.test(line) || line.startsWith('</details>')));
const notes = lines.slice(start + 1, end < 0 ? undefined : end).join('\n').trim();
if (!notes) {
  console.error(`README.md's "### ${version}" entry is empty.`);
  process.exit(1);
}
console.log(notes);
