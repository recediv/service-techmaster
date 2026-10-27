import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

// Optional local QA tooling; these dependencies are never needed by the site.
const root = process.cwd();
const require = createRequire(import.meta.url);
const tooling = [root, path.join(root, '.local/lighthouse')];
const origin = new URL(process.env.QA_ORIGIN || 'http://127.0.0.1:3000');
if (origin.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(origin.hostname) || origin.username || origin.password) {
  throw new Error('Performance checks must use the local preview.');
}
const base = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');
const output = path.join(root, '.local/performance');
await fs.mkdir(output, { recursive: true });
const { default: lighthouse } = await import(pathToFileURL(require.resolve('lighthouse', { paths: tooling })));
const { launch } = await import(pathToFileURL(require.resolve('chrome-launcher', { paths: tooling })));
const desktopConfig = (await import(pathToFileURL(require.resolve('lighthouse/core/config/desktop-config.js', { paths: tooling })))).default;
const pages = [
  { name: 'home', path: '/' },
  { name: 'category', path: '/services/remont-sotovyh/' },
  { name: 'repair', path: '/services/remont-iphone/iphone-16/' },
];
const summary = { measuredAt: new Date().toISOString(), origin: origin.origin, base, runs: [] };
for (const page of pages) for (const mode of ['mobile', 'desktop']) {
  const chrome = await launch({
    chromePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    chromeFlags: [
      '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      '--disable-background-networking', '--disable-component-update', '--disable-sync',
      '--disable-extensions', '--disable-default-apps', '--no-pings',
      '--disable-domain-reliability', '--metrics-recording-only',
      '--disable-client-side-phishing-detection', '--safebrowsing-disable-auto-update',
      '--disable-features=Translate,OptimizationHints,MediaRouter,AutofillServerCommunication',
      '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1',
      '--proxy-server=direct://', '--proxy-bypass-list=*',
    ],
  });
  try {
    const result = await lighthouse(origin.origin + base + page.path, {
      port: chrome.port, output: ['json', 'html'], logLevel: 'error',
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
    }, mode === 'desktop' ? desktopConfig : undefined);
    if (result.lhr.runtimeError) throw new Error('Lighthouse runtime error: ' + result.lhr.runtimeError.code);
    for (const [index, extension] of ['json', 'html'].entries()) {
      await fs.writeFile(path.join(output, `${page.name}-${mode}.${extension}`), result.report[index]);
    }
    const audits = result.lhr.audits;
    const row = {
      page: page.name, path: page.path, mode,
      version: result.lhr.lighthouseVersion,
      scores: Object.fromEntries(Object.entries(result.lhr.categories).map(([key, value]) => [key, Math.round(value.score * 100)])),
      fcpMs: audits['first-contentful-paint']?.numericValue,
      lcpMs: audits['largest-contentful-paint']?.numericValue,
      cls: audits['cumulative-layout-shift']?.numericValue,
      tbtMs: audits['total-blocking-time']?.numericValue,
      transferBytes: audits['total-byte-weight']?.numericValue,
      warnings: result.lhr.runWarnings,
    };
    summary.runs.push(row);
    await fs.writeFile(path.join(output, 'summary.json'), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify(row));
  } finally {
    await chrome.kill();
  }
}
