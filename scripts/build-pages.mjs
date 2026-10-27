import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { packPages } from './pack-pages.mjs';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const city = JSON.parse(await fs.readFile(path.join(root, 'data/default-city.json'), 'utf8'));
if (city.resourceId !== 344 || city.slug !== 'tomsk' || city.name !== 'Томск' || city.prepositional !== 'Томске') throw new Error('The client preview is restricted to Tomsk.');
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/service-techmaster';
const env = { ...process.env, NEXT_PUBLIC_BASE_PATH: basePath, SITE_ORIGIN: process.env.SITE_ORIGIN || 'https://recediv.github.io', SITE_INDEXABLE: 'false', SITE_BUILD_SCOPE: 'full', SITE_OUTPUT_DIR: '.local/build-pages-source', NEXT_TELEMETRY_DISABLED: '1' };
const code = await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ['scripts/build.mjs', '--full'], { cwd: root, env, stdio: 'inherit', windowsHide: true }); child.on('error', reject); child.on('exit', resolve);
});
if (code !== 0) throw new Error('The full Tomsk source export did not pass validation.');
const report = await packPages({ input: '.local/build-pages-source', output: process.env.PAGES_OUTPUT_DIR || '.local/build-pages-package-' + Date.now().toString(36), basePath, onProgress: value => console.log('Pages packaging: ' + JSON.stringify(value)) });
await fs.writeFile(path.join(root, '.local/pages-package-report.json'), JSON.stringify(report, null, 2));
console.log('GitHub Pages package: ' + JSON.stringify(report));
