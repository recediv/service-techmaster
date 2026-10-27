import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanCommunityHtml, cleanCommunityText } from './public-community.mjs';
import { readCommunitySnapshot } from './public-community-source.mjs';
import { redactCommunityContacts } from './public-community-privacy.mjs';
import { pruneCommunityPayloads, auditCommunityJsonPrivacy } from './public-community-files.mjs';
import crypto from 'node:crypto';

test('author contacts are removed while device numbers, dates and prices remain intact', () => {
  const audit = {};
  const source = 'Name +7 (999) 111-22-33; 8 999 111 22 33; 9991112233; 123-45-67; a@example.test';
  const clean = redactCommunityContacts(source, audit);
  assert.equal(clean, 'Name ; ; ; ; '); assert.equal(audit.redactedPhones, 4); assert.equal(audit.redactedEmails, 1);
  const devices = 'Samsung S23, iPhone 16, Pentax K-S2 18-50mm, 2026-10-22, 1500 руб.';
  assert.equal(redactCommunityContacts(devices), devices);
});

test('historical generated payload cleanup verifies schema/hash and backs up only exact owned files', async () => {
  const temporary = await fs.mkdtemp(path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), '.local/community-files-test-'));
  try {
    const directory = path.join(temporary, 'public/community'); await fs.mkdir(directory, { recursive: true });
    const old = JSON.stringify({ schemaVersion: 1, consultations: [{ questionHtml: 'a@example.test' }], filters: {} }), oldName = 'consultations-' + crypto.createHash('sha256').update(old).digest('hex').slice(0, 20) + '.json';
    const current = JSON.stringify({ schemaVersion: 1, consultations: [], filters: {} }), currentName = 'consultations-' + crypto.createHash('sha256').update(current).digest('hex').slice(0, 20) + '.json';
    await fs.writeFile(path.join(directory, oldName), old); await fs.writeFile(path.join(directory, currentName), current);
    await fs.writeFile(path.join(directory, 'unrelated.txt'), 'preserve');
    const options = { projectRoot: temporary, keepUrl: '/community/' + currentName, backupDirectory: path.join(temporary, '.local/backup') };
    const removed = await pruneCommunityPayloads(options); assert.equal(removed.length, 1);
    assert.equal(await fs.readFile(path.join(options.backupDirectory, oldName), 'utf8'), old);
    assert.equal(await fs.readFile(path.join(directory, 'unrelated.txt'), 'utf8'), 'preserve');
    assert.equal((await auditCommunityJsonPrivacy({ projectRoot: temporary })).files, 1);
    const badName = 'consultations-' + '0'.repeat(20) + '.json'; await fs.writeFile(path.join(directory, badName), '{}');
    await assert.rejects(pruneCommunityPayloads(options), /not a verified importer artifact/);
    assert.equal(await fs.readFile(path.join(directory, badName), 'utf8'), '{}');
  } finally {
    const local = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), '.local'), relative = path.relative(local, temporary);
    assert(relative && !relative.startsWith('..') && !path.isAbsolute(relative)); await fs.rm(temporary, { recursive: true, force: true });
  }
});

test('public HTML retains wording but removes emails, executable markup and unmapped private images', () => {
  const audit = {};
  const html = cleanCommunityHtml('<p>Имя автора. Ответ <b>без изменений</b>.</p><p>Почта author@example.test <a href="mailto:author@example.test">author@example.test</a></p><script>alert(1)</script><img src="/private/a.jpg" onerror="alert(1)"><a href="/allowed/">Материал</a><a href="/excluded/">Закрытый адрес</a>', { audit, publicPaths: new Set(['/allowed/']) });
  assert(html.includes('Имя автора. Ответ <b>без изменений</b>.'));
  assert(html.includes('href="/allowed/"')); assert(!html.includes('href="/excluded/"'));
  assert(!/@|script|mailto:|onerror|private\/a/.test(html)); assert.equal(audit.redactedEmails, 2); assert.equal(audit.removedUnmappedImages, 1);
  assert.equal(cleanCommunityText('Иван author@example.test'), 'Иван'); assert.equal(cleanCommunityText(''), '');
});

test('public links resolve only reviewed resource IDs and preserve allowed safe markup', () => {
  const html = cleanCommunityHtml('<p><a href="[[~4]]">Раздел</a> <a href="javascript:alert(1)">Текст</a></p><blockquote>Исходная фраза</blockquote>', { publicPaths: new Set(['/services/']), idPaths: new Map([[4, '/services/']]) });
  assert(html.includes('href="/services/"')); assert(!html.includes('javascript:')); assert(html.includes('<blockquote>Исходная фраза</blockquote>'));
});

test('snapshot adapter obeys explicit INSERT column order and projects only allowlisted fields', async () => {
  const root = path.dirname(path.dirname(fileURLToPath(import.meta.url))), local = path.join(root, '.local');
  await fs.mkdir(local, { recursive: true }); const temporary = await fs.mkdtemp(path.join(local, 'community-source-test-'));
  try {
    const file = path.join(temporary, 'source.sql');
    await fs.writeFile(file, 'CREATE TABLE `example` (\n `id` int,\n `published` tinyint,\n `name` varchar(255),\n `email` varchar(255)\n);\nINSERT INTO `example` (`name`, `email`, `published`, `id`) VALUES (\'Опубликовано\',\'not-exported@example.test\',1,7),(\'Закрыто\',\'private@example.test\',0,8);\n');
    const source = await readCommunitySnapshot(file);
    assert.deepEqual(source.select('example', get => get('published') === '1', ['id','name']), [{ id: '7', name: 'Опубликовано' }]);
    assert.throws(() => source.select('example', () => true, ['nonexistent']), /required public source column/);
  } finally {
    const relative = path.relative(local, temporary); assert(relative && !relative.startsWith('..') && !path.isAbsolute(relative)); await fs.rm(temporary, { recursive: true, force: true });
  }
});
