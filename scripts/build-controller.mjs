import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { getRoutes } from '../lib/public-data.mjs';
import { planBuild, createBuildSnapshot, fingerprint } from './plan-build.mjs';
import { hostingConfig } from './finalize-export.mjs';
import { exists, readJson, atomicJson, walkFiles, digest, clientInventory, routeOwnedFiles, replaceFile, replaceTextIfDifferent, cloneOutput, verifyUnchanged, recoverTransaction, commitOutput, mapBounded } from './incremental-output.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const started = Date.now();
const flags = new Set(process.argv.slice(2));
for (const flag of flags) if (flag !== '--full') throw new Error('Use --full to explicitly rebuild the complete static export.');
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
const representative = process.env.SITE_BUILD_SCOPE === 'representative';
if (process.env.SITE_BUILD_SCOPE && !['full', 'representative'].includes(process.env.SITE_BUILD_SCOPE)) throw new Error('Unknown build scope.');
const targetRelative = process.env.SITE_OUTPUT_DIR || 'out';
if (targetRelative !== 'out' && !/^\.local\/build-[a-z0-9-]+$/.test(targetRelative)) throw new Error('Use out or an isolated .local/build-name output.');
if (representative && targetRelative === 'out') throw new Error('A representative build must use an isolated SITE_OUTPUT_DIR; the complete out is protected.');
const target = path.resolve(root, targetRelative);
const key = crypto.createHash('sha256').update(targetRelative + ':' + base + ':' + (representative ? 'representative' : 'full')).digest('hex').slice(0, 12);
const suffix = targetRelative === 'out' && !base && !representative ? '' : '-' + key;
const local = path.join(root, '.local');
const stateFile = path.join(local, 'build-state' + suffix + '.json');
const rendererFile = path.join(local, 'build-render-state' + suffix + '.json');
const planFile = path.join(local, 'build-plan' + suffix + '.json');
const reportFile = path.join(local, 'build-report' + suffix + '.json');
const selectionFile = path.join(local, 'build-selection' + suffix + '.json');
const auditFile = path.join(local, 'build-rendered' + suffix + '.jsonl');
const lockFile = path.join(local, 'next-build.lock');
const journalFile = path.join(local, 'build-transaction.json');
const id = Date.now().toString(36) + '-' + process.pid;
// Keep the compiler's export path stable across data-only builds. The global
// build lock serializes its use; the public target remains separate throughout.
const stageRelative = '.local/build-render-stage';
const stage = path.join(root, stageRelative);
let candidate = path.join(root, '.local/build-merge-' + id);
let lock;
const report = { schemaVersion: 1, output: targetRelative, scope: representative ? 'representative' : 'full', success: false, nextInvocations: 0, actualRenderedPaths: [], selectedPaths: [], preservedUnchangedFiles: 0, publicUpdates: 0, publicDeletions: 0 };
const env = { ...process.env, NEXT_TELEMETRY_DISABLED: '1' };
const relative = file => path.relative(root, file).split(path.sep).join('/');
async function run(args, extraEnv = {}) {
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: root, env: { ...env, ...extraEnv }, windowsHide: true, stdio: 'inherit' });
    child.on('error', reject); child.on('exit', code => resolve(code ?? 1));
  });
  if (code !== 0) throw new Error('Local build step failed: ' + args[0] + ' (exit ' + code + ').');
}
async function publicInventory(previous = {}) {
  const names = (await walkFiles(path.join(root, 'public'))).sort();
  return Object.fromEntries(await mapBounded(names, async name => {
    const file = path.join(root, 'public', name), info = await fs.stat(file), old = previous[name];
    return [name, { bytes: info.size, mtimeMs: info.mtimeMs, sha256: old?.bytes === info.size && old.mtimeMs === info.mtimeMs ? old.sha256 : await digest(file) }];
  }));
}
function publicDifference(before, after) {
  return { changed: Object.keys(after).filter(name => !before[name] || before[name].sha256 !== after[name].sha256), deleted: Object.keys(before).filter(name => !after[name]) };
}
const escapeXml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
async function controls(output) {
  const routes = getRoutes({ includeAliases: false });
  const origin = process.env.SITE_ORIGIN || 'http://localhost:3000';
  const urls = routes.map(route => '<url><loc>' + escapeXml(new URL(base + route.path, origin).href) + '</loc></url>').join('');
  await replaceTextIfDifferent(path.join(output, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + urls + '</urlset>\n');
  await replaceTextIfDifferent(path.join(output, 'robots.txt'), 'User-Agent: *\n' + (process.env.SITE_INDEXABLE === 'true' ? 'Allow: /\n' : 'Disallow: /\n') + '\nSitemap: ' + new URL(base + '/sitemap.xml', origin).href + '\n');
  const { aliases = [] } = JSON.parse(await fs.readFile(path.join(root, 'data/generated/routes.json'), 'utf8'));
  await replaceTextIfDifferent(path.join(output, '.htaccess'), hostingConfig({ aliases, base }));
  await replaceTextIfDifferent(path.join(output, '.nojekyll'), '');
}
async function acquireLock() {
  const previous = await readJson(lockFile);
  if (previous) {
    let alive = true;
    try { process.kill(previous.pid, 0); } catch (error) { if (error.code === 'ESRCH') alive = false; }
    if (alive) throw new Error('Another local Next build is active. Wait for it before building.');
    await fs.unlink(lockFile);
  }
  lock = await fs.open(lockFile, 'wx');
  await lock.writeFile(JSON.stringify({ pid: process.pid, id }));
}

try {
  await fs.mkdir(local, { recursive: true });
  await acquireLock();
  if (await recoverTransaction(root, journalFile)) console.log('Recovered the previous interrupted local output transaction.');
  await fs.writeFile(auditFile, '');
  await run(['scripts/validate-public.mjs']);
  await run(['scripts/prepare-styles.mjs']);
  const previousRenderer = await readJson(rendererFile);
  const { plan, state } = await planBuild({ projectRoot: root, stateFile, planFile, env });
  report.planCounts = plan.counts;
  report.rendererGeneration = plan.rendererGeneration;
  const generationMatches = previousRenderer?.rendererGeneration === plan.rendererGeneration;
  const previousState = await readJson(stateFile);
  const baselineConsistent = previousRenderer && previousState && previousRenderer.stateFingerprint === fingerprint(previousState);
  const full = flags.has('--full') || representative || plan.requiresFullBuild || !generationMatches || !baselineConsistent || !await exists(path.join(target, 'index.html'));
  const allRoutes = getRoutes();
  const desired = new Set(allRoutes.map(route => route.path));
  const selected = (full ? [...desired] : plan.renderSet.paths.filter(route => desired.has(route))).sort();
  const selectedSet = new Set(selected);
  const deleted = full ? [] : plan.deleted.map(entry => entry.path);
  report.selectedPaths = selected;
  report.mode = full ? 'full' : selected.length ? 'incremental' : deleted.length ? 'deletions' : 'static-updates';
  const currentPublic = await publicInventory(previousRenderer?.publicInventory);
  const publicChanges = publicDifference(previousRenderer?.publicInventory || {}, currentPublic);
  report.publicUpdates = publicChanges.changed.length; report.publicDeletions = publicChanges.deleted.length;
  const artifactChanges = plan.artifacts.new.length + plan.artifacts.changed.length + plan.artifacts.deleted.length;
  if (!full && !selected.length && !deleted.length && !artifactChanges && !publicChanges.changed.length && !publicChanges.deleted.length) {
    report.mode = 'noop'; report.success = true;
    console.log('Incremental export: no changes, Next was not invoked.');
  } else {
    await atomicJson(selectionFile, { paths: selected });
    if (selected.length) {
      report.nextInvocations++;
      await run(['scripts/run-next.mjs', 'build'], { SITE_OUTPUT_DIR: stageRelative, SITE_RENDER_PATHS_FILE: relative(selectionFile), SITE_RENDER_AUDIT_FILE: relative(auditFile), SITE_RENDER_GENERATION_FILE: relative(planFile) });
      // Turbopack can emit an orphan worker source map even with browser maps off.
      for (const name of await walkFiles(path.join(stage, '_next/static'))) if (name.endsWith('.map')) await fs.unlink(path.join(stage, '_next/static', name));
      report.actualRenderedPaths = (await fs.readFile(auditFile, 'utf8')).split('\n').filter(Boolean).map(line => JSON.parse(line).path);
      const actual = [...new Set(report.actualRenderedPaths)].sort();
      if (JSON.stringify(actual) !== JSON.stringify(selected)) throw new Error('Actual page renders do not match the selected routes; the previous export is preserved.');
      const nextClient = await clientInventory(stage);
      if (!full && JSON.stringify(nextClient) !== JSON.stringify(previousRenderer.clientInventory)) throw new Error('Client JS/CSS/fonts changed inside a renderer generation. The previous export is preserved. Run npm run build:full explicitly to start a new complete baseline.');
      report.clientInventoryEqual = full ? null : true;
      // Next or an indexer can retain a handle to the export directory on
      // Windows. Commit a fresh hardlinked tree, never rename Next's own stage.
      if (full) report.clone = await cloneOutput(stage, candidate);
    }
    if (!full) {
      report.clone = await cloneOutput(target, candidate);
      for (const route of [...deleted, ...selected]) {
        const files = previousRenderer.routes[route]?.files || await routeOwnedFiles(candidate, route);
        for (const name of files) await fs.unlink(path.join(candidate, name)).catch(error => { if (error.code !== 'ENOENT') throw error; });
      }
      for (const route of selected) for (const name of await routeOwnedFiles(stage, route)) await replaceFile(path.join(stage, name), path.join(candidate, name));
      if (selected.length) {
        for (const name of await walkFiles(stage)) {
          if (!(name === '404.html' || name.startsWith('404/') || name.startsWith('_not-found/'))) continue;
          const destination = path.join(candidate, name);
          if (!await exists(destination) || await digest(destination) !== await digest(path.join(stage, name))) await replaceFile(path.join(stage, name), destination);
        }
      }
      for (const name of publicChanges.deleted) await fs.unlink(path.join(candidate, name)).catch(error => { if (error.code !== 'ENOENT') throw error; });
      for (const name of publicChanges.changed) await replaceFile(path.join(root, 'public', name), path.join(candidate, name));
      const unchanged = plan.unchanged.map(entry => ({ files: previousRenderer.routes[entry.path]?.files || [] }));
      report.preservedUnchangedFiles = await verifyUnchanged(target, candidate, unchanged);
    }
    await controls(candidate);
    const validationPlanFile = path.join(local, 'build-validation-selection' + suffix + '.json');
    await atomicJson(validationPlanFile, { renderSet: { paths: selected } });
    const validationReport = '.local/export-validation-build' + suffix + '.json';
    await run(['scripts/validate-export.mjs', '--output=' + relative(candidate), '--base-path=' + base, '--scope=' + (representative ? 'existing' : 'full'), '--report=' + validationReport, ...(!full ? ['--route-paths-file=' + relative(validationPlanFile)] : [])]);
    const postBuild = await createBuildSnapshot({ projectRoot: root, env });
    if (fingerprint(postBuild) !== plan.nextStateFingerprint) throw new Error('Public inputs or rendering sources changed while building. The previous export is preserved; run the build again after editing has finished.');
    const routeState = Object.fromEntries(await mapBounded(allRoutes, async route => [route.path, { files: !full && !selectedSet.has(route.path) ? previousRenderer.routes[route.path]?.files || await routeOwnedFiles(candidate, route.path) : await routeOwnedFiles(candidate, route.path) }]));
    const nextRenderer = { schemaVersion: 1, output: targetRelative, rendererGeneration: plan.rendererGeneration, stateFingerprint: fingerprint(state), clientInventory: selected.length ? await clientInventory(stage) : previousRenderer.clientInventory, publicInventory: currentPublic, routes: routeState };
    const stateValues = representative ? [] : [{ file: stateFile, value: state }, { file: rendererFile, value: nextRenderer }];
    report.backup = await commitOutput({ root, target, candidate, stateValues, journalFile, id });
    report.success = true;
    console.log('Incremental export: ' + JSON.stringify({ mode: report.mode, selected: selected.length, actualRendered: report.actualRenderedPaths.length, deleted: deleted.length, preservedUnchangedFiles: report.preservedUnchangedFiles, nextInvocations: report.nextInvocations, output: targetRelative }));
  }
} catch (error) {
  report.error = error.message;
  console.error(error.message);
  process.exitCode = 1;
} finally {
  report.seconds = (Date.now() - started) / 1000;
  await atomicJson(reportFile, report);
  await atomicJson(path.join(local, 'build-duration' + suffix + '.json'), { scope: report.scope, mode: report.mode, seconds: report.seconds, success: report.success });
  if (lock) { await lock.close(); const current = await readJson(lockFile); if (current?.id === id) await fs.unlink(lockFile); }
}
