import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { atomicJson, cloneOutput, commitOutput, digest, exists, inside, recoverTransaction, replaceFile, routeOwnedFiles, verifyUnchanged } from './incremental-output.mjs';

const project = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
async function fixture(action) {
  const parent = path.join(project, '.local'); await fs.mkdir(parent, { recursive: true });
  const root = await fs.mkdtemp(path.join(parent, 'qa-incremental-output-'));
  try { await action(root); }
  finally {
    assert(inside(parent, root) && path.basename(root).startsWith('qa-incremental-output-'));
    await fs.rm(root, { recursive: true, force: true });
  }
}
async function write(root, name, value) { await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true }); await fs.writeFile(path.join(root, name), value); }

test('a changed or deleted parent route preserves its unchanged child and source inode', async () => fixture(async root => {
  const output = path.join(root, 'out'), candidate = path.join(root, '.local/candidate');
  await write(output, 'category/index.html', 'old parent');
  await write(output, 'category/index.txt', 'old parent RSC');
  await write(output, 'category/__next._full.txt', 'old parent segment');
  await write(output, 'category/__next.$oc$slug/__PAGE__.txt', 'old nested parent segment');
  await write(output, 'category/child/index.html', 'unchanged child');
  await write(output, 'category/child/index.txt', 'unchanged child RSC');
  const originalHash = await digest(path.join(output, 'category/index.html'));
  const owned = await routeOwnedFiles(output, '/category/');
  assert.equal(owned.length, 4);
  assert(owned.includes('category/__next.$oc$slug/__PAGE__.txt'));
  assert(owned.every(name => !name.includes('/child/')));
  await cloneOutput(output, candidate);
  for (const name of owned) await fs.unlink(path.join(candidate, name));
  assert.equal(await verifyUnchanged(output, candidate, [{ files: ['category/child/index.html', 'category/child/index.txt'] }]), 2);
  await write(root, '.local/new-parent.html', 'new parent');
  await replaceFile(path.join(root, '.local/new-parent.html'), path.join(candidate, 'category/index.html'));
  assert.equal(await digest(path.join(output, 'category/index.html')), originalHash);
  assert.equal(await fs.readFile(path.join(candidate, 'category/index.html'), 'utf8'), 'new parent');
  assert.equal(await fs.readFile(path.join(candidate, 'category/child/index.html'), 'utf8'), 'unchanged child');
}));

test('output and both fingerprints commit together and an interrupted swap restores all three', async () => fixture(async root => {
  const local = path.join(root, '.local'), target = path.join(root, 'out'), candidate = path.join(local, 'candidate');
  const state = path.join(local, 'state.json'), renderer = path.join(local, 'renderer.json'), journal = path.join(local, 'transaction.json');
  await write(target, 'index.html', 'old output'); await write(candidate, 'index.html', 'new output');
  await atomicJson(state, { version: 'old' }); await atomicJson(renderer, { version: 'old' });
  await commitOutput({ root, target, candidate, stateValues: [{ file: state, value: { version: 'new' } }, { file: renderer, value: { version: 'new' } }], journalFile: journal, id: 'test', mode: 'directories' });
  assert.equal(await fs.readFile(path.join(target, 'index.html'), 'utf8'), 'new output');
  assert.equal(JSON.parse(await fs.readFile(state)).version, 'new');
  assert.equal(JSON.parse(await fs.readFile(renderer)).version, 'new');
  assert.equal(await exists(journal), false);
  const backup = path.join(local, 'interrupted-backup'), failed = path.join(local, 'failed');
  await fs.rename(target, backup); await write(target, 'index.html', 'incomplete output');
  const oldState = path.join(local, 'state-before.json'), oldRenderer = path.join(local, 'renderer-before.json');
  await fs.copyFile(state, oldState); await fs.copyFile(renderer, oldRenderer);
  await atomicJson(state, { version: 'incomplete' });
  await atomicJson(journal, { phase: 'output-swapped', target, candidate: path.join(local, 'missing-candidate'), backup, failed, previousOutput: true, states: [{ file: state, oldFile: oldState, existed: true }, { file: renderer, oldFile: oldRenderer, existed: true }] });
  assert.equal(await recoverTransaction(root, journal), true);
  assert.equal(await fs.readFile(path.join(target, 'index.html'), 'utf8'), 'new output');
  assert.equal(JSON.parse(await fs.readFile(state)).version, 'new');
  assert.equal(JSON.parse(await fs.readFile(renderer)).version, 'new');
  assert.equal(await exists(journal), false);
}));

async function transactionFixture(root) {
  const target = path.join(root, 'out'), candidate = path.join(root, '.local/candidate');
  const state = path.join(root, '.local/state.json'), renderer = path.join(root, '.local/renderer.json'), journalFile = path.join(root, '.local/transaction.json');
  await write(target, 'changed/index.html', 'old page'); await write(target, 'deleted/index.txt', 'deleted RSC');
  await write(target, 'unchanged/child/index.html', 'same page');
  await cloneOutput(target, candidate);
  await write(root, '.local/replacement', 'new page');
  await replaceFile(path.join(root, '.local/replacement'), path.join(candidate, 'changed/index.html'));
  await fs.unlink(path.join(candidate, 'deleted/index.txt')); await write(candidate, 'new/index.html', 'added page');
  await atomicJson(state, { version: 'old' }); await atomicJson(renderer, { version: 'old' });
  const before = Object.fromEntries(await Promise.all(['changed/index.html', 'deleted/index.txt', 'unchanged/child/index.html'].map(async name => [name, { info: await fs.stat(path.join(target, name)), hash: await digest(path.join(target, name)) }])));
  const candidateBefore = Object.fromEntries(await Promise.all(['changed/index.html', 'new/index.html', 'unchanged/child/index.html'].map(async name => [name, { info: await fs.stat(path.join(candidate, name)), hash: await digest(path.join(candidate, name)) }])));
  const options = { root, target, candidate, stateValues: [{ file: state, value: { version: 'new' } }, { file: renderer, value: { version: 'new' } }], journalFile, mode: 'files', id: 'file-test' };
  async function checkCandidate() {
    for (const [name, expected] of Object.entries(candidateBefore)) {
      const info = await fs.stat(path.join(candidate, name));
      assert.equal(info.ino, expected.info.ino); assert.equal(info.mtimeMs, expected.info.mtimeMs); assert.equal(await digest(path.join(candidate, name)), expected.hash);
    }
  }
  async function checkRestored() {
    for (const [name, expected] of Object.entries(before)) {
      const info = await fs.stat(path.join(target, name));
      assert.equal(info.ino, expected.info.ino); assert.equal(info.mtimeMs, expected.info.mtimeMs); assert.equal(await digest(path.join(target, name)), expected.hash);
    }
    assert.equal(await exists(path.join(target, 'new/index.html')), false);
    assert.deepEqual(JSON.parse(await fs.readFile(state)), { version: 'old' }); assert.deepEqual(JSON.parse(await fs.readFile(renderer)), { version: 'old' });
    await checkCandidate();
  }
  return { options, before, checkCandidate, checkRestored };
}

for (const phase of ['backup-file', 'install-file', 'state-written']) {
  test('file commit rolls back an injected ' + phase + ' failure without changing candidate or old inodes', async () => fixture(async root => {
    const { options, checkRestored } = await transactionFixture(root);
    await assert.rejects(commitOutput({ ...options, onStep: async step => { if (step.phase === phase) throw new Error('injected ' + phase); } }), /injected/);
    await checkRestored(); assert.equal(await exists(options.journalFile), false); assert.equal(await recoverTransaction(root, options.journalFile), false);
  }));
}

test('successful file commit preserves unchanged inode and immutable candidate, including deletion', async () => fixture(async root => {
  const { options, before, checkCandidate } = await transactionFixture(root);
  await commitOutput(options); await checkCandidate();
  assert.equal((await fs.stat(path.join(options.target, 'unchanged/child/index.html'))).ino, before['unchanged/child/index.html'].info.ino);
  assert.equal(await fs.readFile(path.join(options.target, 'changed/index.html'), 'utf8'), 'new page');
  assert.equal(await exists(path.join(options.target, 'deleted/index.txt')), false);
  assert.equal(JSON.parse(await fs.readFile(options.stateValues[0].file)).version, 'new');
}));

test('process exit during a file commit leaves a durable recoverable journal', async () => fixture(async root => {
  const { options, checkRestored } = await transactionFixture(root);
  const moduleUrl = new URL('./incremental-output.mjs', import.meta.url).href;
  const source = `import {commitOutput} from ${JSON.stringify(moduleUrl)}; await commitOutput({...${JSON.stringify(options)}, onStep(step) { if (step.phase === 'state-written') process.exit(89); }});`;
  const result = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', source], { stdio: ['ignore', 'pipe', 'pipe'] }); let errors = '';
    child.stderr.on('data', chunk => { errors += chunk; }); child.once('error', reject); child.once('exit', code => resolve({ code, errors }));
  });
  assert.equal(result.code, 89, result.errors);
  const journal = JSON.parse(await fs.readFile(options.journalFile));
  assert.equal(journal.mode, 'files'); assert.equal(journal.phase, 'output-swapped'); assert.match(journal.manifestSha256, /^[a-f0-9]{64}$/);
  assert.equal(await recoverTransaction(root, options.journalFile), true); await checkRestored();
  assert.equal(await recoverTransaction(root, options.journalFile), false);
}));

for (const damage of ['missing', 'corrupt']) {
  test('recovery refuses a ' + damage + ' original backup and preserves journal/state', async () => fixture(async root => {
    const { options, checkRestored } = await transactionFixture(root);
    const moduleUrl = new URL('./incremental-output.mjs', import.meta.url).href;
    const source = `import {commitOutput} from ${JSON.stringify(moduleUrl)}; await commitOutput({...${JSON.stringify(options)}, onStep(step) { if (step.phase === 'state-written') process.exit(89); }});`;
    const result = await new Promise((resolve, reject) => { const child = spawn(process.execPath, ['--input-type=module', '-e', source], { stdio: 'ignore' }); child.once('error', reject); child.once('exit', resolve); });
    assert.equal(result, 89);
    const journal = JSON.parse(await fs.readFile(options.journalFile));
    const backup = path.join(journal.backup, 'changed/index.html'), saved = path.join(root, '.local/saved-original');
    await fs.link(backup, saved);
    if (damage === 'missing') await fs.unlink(backup);
    else { await fs.unlink(backup); await fs.writeFile(backup, 'corrupt original'); }
    await assert.rejects(recoverTransaction(root, options.journalFile), /original output backup is missing or corrupt/);
    assert.equal(await exists(options.journalFile), true);
    assert.equal(JSON.parse(await fs.readFile(options.stateValues[0].file)).version, 'new');
    assert.equal(await fs.readFile(path.join(options.target, 'changed/index.html'), 'utf8'), 'new page');
    await fs.unlink(backup).catch(error => { if (error.code !== 'ENOENT') throw error; }); await fs.rename(saved, backup);
    assert.equal(await recoverTransaction(root, options.journalFile), true); await checkRestored();
  }));
}

test('malicious manifest path is rejected before recovery changes files', async () => fixture(async root => {
  const { options, checkCandidate } = await transactionFixture(root);
  const outside = path.join(root, 'must-stay.txt'); await fs.writeFile(outside, 'private sentinel');
  const manifestFile = path.join(root, '.local/build-transactions/malicious/file-manifest.json');
  await atomicJson(manifestFile, { schemaVersion: 1, ops: [{ name: '../../must-stay.txt', existed: false, hasNew: true }] });
  await atomicJson(options.journalFile, { mode: 'files', phase: 'prepared', target: options.target, candidate: options.candidate, backup: path.join(root, '.local/backup'), failed: path.join(root, '.local/failed'), states: [], manifestFile, manifestSha256: await digest(manifestFile) });
  await assert.rejects(recoverTransaction(root, options.journalFile), /manifest file path/);
  assert.equal(await fs.readFile(outside, 'utf8'), 'private sentinel'); await checkCandidate();
  assert.equal(await exists(options.journalFile), true);
}));

test('candidate cannot be a transaction state destination', async () => fixture(async root => {
  const { options, checkCandidate } = await transactionFixture(root);
  await assert.rejects(commitOutput({ ...options, stateValues: [{ file: path.join(options.candidate, 'changed/index.html'), value: { corrupt: true } }] }), /state transaction path/);
  await checkCandidate(); assert.equal(await exists(options.journalFile), false);
}));

test('a candidate junction is rejected before any output mutation', async () => fixture(async root => {
  const { options, checkRestored } = await transactionFixture(root);
  const protectedDirectory = path.join(root, 'protected'); await fs.mkdir(protectedDirectory); await write(protectedDirectory, 'sentinel.txt', 'private sentinel');
  await fs.symlink(protectedDirectory, path.join(options.candidate, 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(commitOutput(options), /symbolic link/);
  assert.equal(await fs.readFile(path.join(protectedDirectory, 'sentinel.txt'), 'utf8'), 'private sentinel');
  await checkRestored(); assert.equal(await exists(options.journalFile), false);
}));

test('preview returns 503 only while its output has an active file transaction', async () => fixture(async root => {
  const serverFile = path.join(root, 'scripts/serve.mjs'); await fs.mkdir(path.dirname(serverFile), { recursive: true }); await fs.copyFile(new URL('./serve.mjs', import.meta.url), serverFile);
  await fs.mkdir(path.join(root, 'lib'), { recursive: true });
  await fs.copyFile(new URL('../lib/content-security-policy.mjs', import.meta.url), path.join(root, 'lib/content-security-policy.mjs'));
  await write(root, 'out/index.html', 'ready'); await write(root, 'out/404.html', 'not found');
  const port = await new Promise((resolve, reject) => { const probe = net.createServer(); probe.once('error', reject); probe.listen(0, '127.0.0.1', () => { const chosen = probe.address().port; probe.close(() => resolve(chosen)); }); });
  const child = spawn(process.execPath, [serverFile], { env: { ...process.env, PORT: String(port), STATIC_OUTPUT_DIR: 'out', NEXT_PUBLIC_BASE_PATH: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Preview did not start.')), 5000);
      child.stdout.once('data', () => { clearTimeout(timer); resolve(); }); child.once('error', error => { clearTimeout(timer); reject(error); }); child.once('exit', code => { clearTimeout(timer); reject(new Error('Preview exited: ' + code)); });
    });
    const url = 'http://127.0.0.1:' + port + '/'; const journal = path.join(root, '.local/build-transaction.json');
    assert.equal((await fetch(url)).status, 200);
    await atomicJson(journal, { mode: 'files', phase: 'prepared', target: path.join(root, 'out') });
    const blocked = await fetch(url); assert.equal(blocked.status, 503); assert.equal(blocked.headers.get('retry-after'), '1'); assert.equal(blocked.headers.get('cache-control'), 'no-store');
    await atomicJson(journal, { mode: 'files', phase: 'prepared', target: path.join(root, '.local/other-preview') }); assert.equal((await fetch(url)).status, 200);
    await atomicJson(journal, { mode: 'files', phase: 'committed', target: path.join(root, 'out') }); assert.equal((await fetch(url)).status, 200);
    await fs.unlink(journal); assert.equal((await fetch(url)).status, 200);
  } finally { child.kill(); await new Promise(resolve => { if (child.exitCode !== null) resolve(); else child.once('exit', resolve); }); }
}));
