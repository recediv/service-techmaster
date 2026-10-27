import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export async function mapBounded(items, operation, concurrency = 8) {
  const result = new Array(items.length); let next = 0, failure;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (!failure && next < items.length) {
      const index = next++;
      try { result[index] = await operation(items[index], index); }
      catch (error) { failure ||= error; }
    }
  }));
  if (failure) throw failure;
  return result;
}
function limiter(concurrency) {
  let active = 0; const waiting = [];
  return async operation => {
    if (active < concurrency) active++;
    else await new Promise(resolve => waiting.push(resolve));
    try { return await operation(); }
    finally { const resume = waiting.shift(); if (resume) resume(); else active--; }
  };
}
const filesystem = limiter(8);

export const exists = async file => { try { await fs.access(file); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } };
export const readJson = async (file, fallback = null) => { try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch (error) { if (error.code === 'ENOENT') return fallback; throw error; } };
export function inside(root, file) { const relative = path.relative(root, file); return !!relative && !relative.startsWith('..') && !path.isAbsolute(relative); }
export async function renameWithRetry(source, destination) {
  for (let attempt = 0; ; attempt++) {
    try { await fs.rename(source, destination); return; }
    catch (error) {
      if (!['EPERM', 'EBUSY', 'EACCES'].includes(error.code) || attempt >= 5) throw error;
      await new Promise(resolve => setTimeout(resolve, 50 * 2 ** attempt));
    }
  }
}
export async function atomicJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = file + '.tmp-' + process.pid + '-' + crypto.randomUUID();
  const handle = await fs.open(temporary, 'wx');
  try { await handle.writeFile(JSON.stringify(value, null, 2) + '\n'); await handle.sync(); }
  finally { await handle.close(); }
  await renameWithRetry(temporary, file);
  await syncDirectory(path.dirname(file));
}
async function syncDirectory(directory) {
  let handle;
  try { handle = await fs.open(directory, 'r'); await handle.sync(); }
  catch (error) { if (!['EINVAL', 'EPERM', 'EISDIR', 'EBADF', 'ENOTSUP', 'EACCES'].includes(error.code)) throw error; }
  finally { await handle?.close(); }
}
export async function walkFiles(root, relative = '') {
  const entries = await filesystem(() => fs.readdir(path.join(root, relative), { withFileTypes: true }));
  const groups = await Promise.all(entries.map(async entry => {
    const name = path.posix.join(relative, entry.name);
    if (entry.isSymbolicLink()) throw new Error('A generated output contains a symbolic link.');
    if (entry.isDirectory()) return walkFiles(root, name);
    if (!entry.isFile()) throw new Error('A generated output contains a non-regular file.');
    return [name];
  }));
  return groups.flat();
}
export async function digest(file) { return crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex'); }
export async function clientInventory(output) {
  const directory = path.join(output, '_next');
  const names = (await walkFiles(directory)).sort();
  return Object.fromEntries(await mapBounded(names, async name => [name, await digest(path.join(directory, name))]));
}
export async function routeOwnedFiles(output, route) {
  const relative = route === '/' ? '' : route.slice(1, -1);
  const directory = path.resolve(output, relative);
  if (directory !== output && !inside(output, directory)) throw new Error('A route escaped the output directory.');
  let entries;
  try { entries = await filesystem(() => fs.readdir(directory, { withFileTypes: true })); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  const files = [];
  for (const entry of entries) {
    if (entry.isFile() && /^(?:index\.(?:html|txt)|__next.*\.txt)$/.test(entry.name)) files.push(path.posix.join(relative, entry.name));
    else if (entry.isDirectory() && entry.name.startsWith('__next.')) {
      const prefix = path.posix.join(relative, entry.name);
      // Segment payload directories belong to this route. Ordinary child
      // resource directories do not: a parent update must preserve those.
      for (const name of await walkFiles(path.join(output, prefix))) {
        if (!name.endsWith('.txt')) throw new Error('Unexpected file inside an owned RSC segment directory.');
        files.push(path.posix.join(prefix, name));
      }
    }
  }
  return files.sort();
}
export async function replaceFile(source, destination) {
  await fs.mkdir(path.dirname(destination), { recursive: true });
  // The destination may be a hardlink to the previous output. Never overwrite
  // that inode: unlink the candidate's name before creating the replacement.
  await fs.unlink(destination).catch(error => { if (error.code !== 'ENOENT') throw error; });
  await fs.copyFile(source, destination);
}
export async function replaceTextIfDifferent(destination, text) {
  if (await exists(destination) && await fs.readFile(destination, 'utf8') === text) return false;
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.unlink(destination).catch(error => { if (error.code !== 'ENOENT') throw error; });
  await fs.writeFile(destination, text); return true;
}
export async function cloneOutput(source, destination) {
  await fs.mkdir(destination, { recursive: true });
  let linked = 0, copied = 0;
  const directories = new Map([[destination, Promise.resolve()]]);
  await mapBounded(await walkFiles(source), async name => {
    const from = path.join(source, name), to = path.join(destination, name), parent = path.dirname(to);
    if (!directories.has(parent)) directories.set(parent, fs.mkdir(parent, { recursive: true }));
    await directories.get(parent);
    try { await fs.link(from, to); linked++; }
    catch (error) {
      if (!['EXDEV', 'EPERM', 'EOPNOTSUPP', 'ENOTSUP', 'EMLINK'].includes(error.code)) throw error;
      await fs.copyFile(from, to);
      const info = await fs.stat(from);
      await fs.utimes(to, info.atimeMs / 1000, info.mtimeMs / 1000); copied++;
    }
  });
  return { linked, copied };
}
export async function verifyUnchanged(source, candidate, entries) {
  const files = entries.flatMap(entry => entry.files);
  await mapBounded(files, async name => {
    const from = path.join(source, name), to = path.join(candidate, name);
    const [before, after] = await Promise.all([filesystem(() => fs.stat(from)), filesystem(() => fs.stat(to))]);
    if (before.size !== after.size || Math.abs(before.mtimeMs - after.mtimeMs) > 1) throw new Error('An unchanged artifact changed size or modification time: ' + name);
    if (before.ino !== after.ino || before.dev !== after.dev) {
      if (await digest(from) !== await digest(to)) throw new Error('An unchanged copied artifact changed bytes: ' + name);
    }
  });
  return files.length;
}

function overlaps(a, b) { return a === b || inside(a, b) || inside(b, a); }
function localPath(local, file) { return typeof file === 'string' && path.isAbsolute(file) && path.resolve(file) === file && inside(local, file); }
async function noSymlinks(root, file) {
  if (file !== root && !inside(root, file)) throw new Error('A transaction path escaped the project.');
  const parts = path.relative(root, file).split(path.sep).filter(Boolean);
  let current = root;
  for (let i = -1; i < parts.length; i++) {
    if (i >= 0) current = path.join(current, parts[i]);
    let info;
    try { info = await fs.lstat(current); }
    catch (error) { if (error.code === 'ENOENT') return; throw error; }
    if (info.isSymbolicLink()) throw new Error('A build transaction path contains a symbolic link.');
    if (i < parts.length - 1 && !info.isDirectory()) throw new Error('A transaction parent is not a directory.');
  }
}
function relativeFile(name) {
  if (typeof name !== 'string' || !name || name.includes('\\') || /[:\u0000-\u001f]/.test(name) || path.posix.isAbsolute(name) || name.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('Invalid transaction manifest file path.');
  return name;
}
async function fileInfo(file) {
  try {
    const info = await fs.lstat(file);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error('A transaction artifact is not a regular file.');
    return { size: info.size, mtimeMs: info.mtimeMs, ino: info.ino, dev: info.dev };
  } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
function sameFile(a, b) { return !!a && !!b && a.ino === b.ino && a.dev === b.dev && a.size === b.size && a.mtimeMs === b.mtimeMs; }
function validFileInfo(info) { return !!info && ['size', 'mtimeMs', 'ino', 'dev'].every(key => typeof info[key] === 'number' && Number.isFinite(info[key])) && ['size', 'ino', 'dev'].every(key => Number.isInteger(info[key]) && info[key] >= 0); }
async function unlinkFile(file) { await fs.unlink(file).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
async function durableCopy(source, destination) {
  await fs.copyFile(source, destination, fs.constants.COPYFILE_EXCL);
  const handle = await fs.open(destination, 'r+');
  try { await handle.sync(); } finally { await handle.close(); }
}
async function validateTransaction(root, journalFile, transaction) {
  const local = path.join(root, '.local');
  if (!localPath(local, journalFile)) throw new Error('Invalid build journal path.');
  for (const name of ['candidate', 'backup', 'failed']) if (!localPath(local, transaction[name])) throw new Error('Invalid local build transaction path.');
  if (transaction.target !== path.join(root, 'out') && !localPath(local, transaction.target)) throw new Error('Invalid build transaction output.');
  if ([transaction.target, transaction.candidate].some(directory => overlaps(directory, path.join(local, 'build-transactions')))) throw new Error('An output cannot overlap transaction metadata.');
  if ([transaction.candidate, transaction.backup, transaction.failed, journalFile].some(file => overlaps(transaction.target, file)) || [transaction.backup, transaction.failed, journalFile].some(file => overlaps(transaction.candidate, file))) throw new Error('Overlapping build transaction paths.');
  const paths = [journalFile, transaction.target, transaction.candidate, transaction.backup, transaction.failed];
  const stateNames = new Set();
  if (!Array.isArray(transaction.states)) throw new Error('Invalid transaction states.');
  for (const item of transaction.states) {
    if (!localPath(local, item.file) || !localPath(local, item.oldFile) || typeof item.existed !== 'boolean' || [transaction.target, transaction.candidate, transaction.backup, transaction.failed, path.join(local, 'build-transactions')].some(directory => overlaps(item.file, directory)) || [transaction.target, transaction.candidate, transaction.backup, transaction.failed].some(directory => overlaps(item.oldFile, directory)) || item.file === journalFile || item.file === item.oldFile || stateNames.has(item.file)) throw new Error('Invalid state transaction path.');
    stateNames.add(item.file); paths.push(item.file, item.oldFile);
  }
  await mapBounded(paths, file => noSymlinks(root, file));
}
async function loadFileManifest(root, transaction) {
  const local = path.join(root, '.local');
  if (!localPath(local, transaction.manifestFile) || !inside(path.join(local, 'build-transactions'), transaction.manifestFile) || !/^[a-f0-9]{64}$/.test(transaction.manifestSha256 || '')) throw new Error('Invalid build manifest location.');
  await noSymlinks(root, transaction.manifestFile);
  const bytes = await fs.readFile(transaction.manifestFile);
  if (crypto.createHash('sha256').update(bytes).digest('hex') !== transaction.manifestSha256) throw new Error('Build transaction manifest checksum mismatch.');
  const manifest = JSON.parse(bytes);
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.ops)) throw new Error('Invalid build transaction manifest.');
  let previous = '';
  for (const op of manifest.ops) {
    relativeFile(op.name);
    if (op.name <= previous || typeof op.existed !== 'boolean' || typeof op.hasNew !== 'boolean' || !op.existed && !op.hasNew) throw new Error('Invalid or unordered build manifest operation.');
    if (op.existed ? !validFileInfo(op.before) : op.before !== null) throw new Error('Invalid original file metadata in build manifest.');
    if (op.hasNew ? !validFileInfo(op.after) : op.after !== null) throw new Error('Invalid candidate file metadata in build manifest.');
    previous = op.name;
  }
  // Inspect each directory tree once rather than lstat-ing every shared parent
  // for every operation. walkFiles rejects junctions/symlinks at every depth.
  await mapBounded([transaction.target, transaction.backup, transaction.candidate], async directory => { if (await exists(directory)) await walkFiles(directory); });
  return manifest;
}
async function restoreStates(transaction) {
  // Validate every backup before changing either state; a missing backup is an
  // explicit recovery error, never permission to accept an incomplete output.
  for (const item of transaction.states) if (item.existed && (!await fileInfo(item.oldFile) || item.sha256 && await digest(item.oldFile) !== item.sha256)) throw new Error('A transaction state backup is missing or corrupt.');
  for (const item of transaction.states) {
    if (item.existed) {
      await fs.mkdir(path.dirname(item.file), { recursive: true });
      const temporary = item.file + '.restore-' + process.pid;
      await unlinkFile(temporary); await durableCopy(item.oldFile, temporary); await renameWithRetry(temporary, item.file);
    } else await unlinkFile(item.file);
  }
}

// A small durable journal points to a checksum-protected, immutable operation
// list. Recovery can be repeated after interruption: a remaining backup file
// means its original inode still needs to be restored.
export async function recoverTransaction(root, journalFile) {
  await noSymlinks(root, journalFile);
  const transaction = await readJson(journalFile);
  if (!transaction) return false;
  await validateTransaction(root, journalFile, transaction);
  if (transaction.mode === 'files') {
    const manifest = await loadFileManifest(root, transaction);
    if (transaction.phase !== 'committed') {
      for (const item of transaction.states) if (item.existed && (!await fileInfo(item.oldFile) || item.sha256 && await digest(item.oldFile) !== item.sha256)) throw new Error('A transaction state backup is missing or corrupt.');
      // A missing backup is safe only before that move, or after an earlier
      // recovery restored the original inode. Never accept lost originals.
      await mapBounded(manifest.ops.filter(op => op.existed), async op => {
        const backup = await fileInfo(path.join(transaction.backup, op.name));
        if (backup ? !sameFile(backup, op.before) : !sameFile(await fileInfo(path.join(transaction.target, op.name)), op.before)) throw new Error('An original output backup is missing or corrupt: ' + op.name);
      });
      await mapBounded(manifest.ops, async op => {
        const target = path.join(transaction.target, op.name), backup = path.join(transaction.backup, op.name);
        if (op.existed) {
          if (await fileInfo(backup)) {
            await unlinkFile(target); await fs.mkdir(path.dirname(target), { recursive: true }); await renameWithRetry(backup, target);
          }
        } else await unlinkFile(target);
      });
      await restoreStates(transaction);
    }
  } else {
    if (transaction.mode && transaction.mode !== 'directories') throw new Error('Unknown build transaction mode.');
    if (transaction.phase !== 'committed') {
      if (await exists(transaction.backup)) {
        if (await exists(transaction.target)) await renameWithRetry(transaction.target, transaction.failed);
        await renameWithRetry(transaction.backup, transaction.target);
      } else if (!transaction.previousOutput && await exists(transaction.target) && !await exists(transaction.candidate)) {
        await renameWithRetry(transaction.target, transaction.failed);
      }
      await restoreStates(transaction);
    }
  }
  await fs.unlink(journalFile); await syncDirectory(path.dirname(journalFile)); return true;
}

export async function commitOutput({ root, target, candidate, stateValues, journalFile, id, mode = process.platform === 'win32' ? 'files' : 'directories', onStep }) {
  if (!/^[a-zA-Z0-9-]+$/.test(id) || !['files', 'directories'].includes(mode)) throw new Error('Invalid transaction identity or mode.');
  const directory = path.join(root, '.local', 'build-transactions', id);
  const backup = path.join(root, '.local', 'export-backups', 'build-' + id);
  const transaction = { mode, phase: 'prepared', target, candidate, backup, failed: path.join(root, '.local', 'build-failed-' + id), previousOutput: await exists(target), states: stateValues.map((item, index) => ({ file: item.file, oldFile: path.join(directory, index + '-before.json'), existed: false })) };
  await validateTransaction(root, journalFile, transaction);
  if (await exists(journalFile) || await exists(directory) || await exists(backup)) throw new Error('Build transaction already exists; recover it before committing.');
  if (!(await fs.lstat(candidate)).isDirectory()) throw new Error('Missing output candidate.');
  await fs.mkdir(path.dirname(directory), { recursive: true }); await fs.mkdir(directory);
  await fs.mkdir(path.dirname(backup), { recursive: true });
  for (const item of transaction.states) {
    item.existed = !!await fileInfo(item.file);
    if (item.existed) { await durableCopy(item.file, item.oldFile); item.sha256 = await digest(item.oldFile); }
  }
  let manifest;
  if (mode === 'files') {
    const names = await walkFiles(candidate), oldNames = transaction.previousOutput ? await walkFiles(target) : [];
    const newSet = new Set(names), oldSet = new Set(oldNames), allNames = [...new Set([...names, ...oldNames])].sort(), allSet = new Set(allNames);
    for (const name of allNames) {
      const parts = name.split('/'); parts.pop();
      while (parts.length) {
        if (allSet.has(parts.join('/'))) throw new Error('A file/directory replacement needs a separate output target: ' + name);
        parts.pop();
      }
    }
    const ops = (await mapBounded(allNames, async name => {
      relativeFile(name);
      const [before, after] = await Promise.all([oldSet.has(name) ? fileInfo(path.join(target, name)) : null, newSet.has(name) ? fileInfo(path.join(candidate, name)) : null]);
      const identical = sameFile(before, after) || before && after && before.size === after.size && Math.abs(before.mtimeMs - after.mtimeMs) <= 1 && await digest(path.join(target, name)) === await digest(path.join(candidate, name));
      return identical ? null : { name, existed: !!before, hasNew: !!after, before, after };
    })).filter(Boolean);
    manifest = { schemaVersion: 1, ops };
    transaction.manifestFile = path.join(directory, 'file-manifest.json');
    await atomicJson(transaction.manifestFile, manifest); transaction.manifestSha256 = await digest(transaction.manifestFile);
    // No output file is touched before both the complete manifest and journal
    // have reached disk. The candidate remains read-only throughout the commit.
  }
  await atomicJson(journalFile, transaction);
  let completed = 0;
  async function step(phase, name) {
    completed++;
    if (completed % 2000 === 0) console.log('Output transaction: ' + completed + ' file operations (' + phase + ').');
    await onStep?.({ phase, name, completed, transaction });
  }
  try {
    if (mode === 'files') {
      await fs.mkdir(target, { recursive: true }); await fs.mkdir(backup);
      await mapBounded(manifest.ops.filter(op => op.existed), async op => {
        const from = path.join(target, op.name), to = path.join(backup, op.name);
        if (!sameFile(await fileInfo(from), op.before)) throw new Error('Output changed during commit: ' + op.name);
        await fs.mkdir(path.dirname(to), { recursive: true }); await renameWithRetry(from, to); await step('backup-file', op.name);
      });
      await mapBounded(manifest.ops.filter(op => op.hasNew), async op => {
        const from = path.join(candidate, op.name), to = path.join(target, op.name);
        if (!sameFile(await fileInfo(from), op.after)) throw new Error('Candidate changed during commit: ' + op.name);
        await fs.mkdir(path.dirname(to), { recursive: true });
        try { await fs.link(from, to); }
        catch (error) {
          if (!['EXDEV', 'EPERM', 'EOPNOTSUPP', 'ENOTSUP', 'EMLINK'].includes(error.code)) throw error;
          await durableCopy(from, to); await fs.utimes(to, op.after.mtimeMs / 1000, op.after.mtimeMs / 1000);
        }
        await step('install-file', op.name);
      });
      const targetNames = (await walkFiles(target)).sort(), candidateNames = (await walkFiles(candidate)).sort();
      if (JSON.stringify(targetNames) !== JSON.stringify(candidateNames)) throw new Error('Committed output inventory differs from its candidate.');
      await verifyUnchanged(candidate, target, [{ files: candidateNames }]);
    } else {
      if (transaction.previousOutput) await renameWithRetry(target, backup);
      await renameWithRetry(candidate, target);
    }
    transaction.phase = 'output-swapped'; await atomicJson(journalFile, transaction);
    for (const item of stateValues) { await atomicJson(item.file, item.value); await step('state-written', item.file); }
    transaction.phase = 'committed'; await atomicJson(journalFile, transaction);
    await fs.unlink(journalFile); await syncDirectory(path.dirname(journalFile));
  } catch (error) {
    try { await recoverTransaction(root, journalFile); }
    catch (recoveryError) { throw new AggregateError([error, recoveryError], 'Output commit failed and needs recovery; transaction journal was preserved.'); }
    throw error;
  }
  return transaction.previousOutput ? path.relative(root, backup).split(path.sep).join('/') : null;
}
