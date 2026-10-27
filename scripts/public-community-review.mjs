import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import { redactCommunityContacts } from './public-community-privacy.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const community = JSON.parse(await fs.readFile(path.join(root, 'data/generated/community.json'), 'utf8'));
const directory = path.join(root, '.local/public-community-review'); await fs.mkdir(directory, { recursive: true });
const plain = value => redactCommunityContacts(cheerio.load(String(value || ''), null, false).root().text()).replace(/\s+/g, ' ').trim();
const normalize = value => value.toLocaleLowerCase('ru').replace(/\s+/g, ' ').trim();
const consultations = community.consultations.map(row => ({ id: row.id, type: 'consultation', title: plain(row.title), authorName: plain(row.authorName), question: plain(row.questionHtml), answer: plain(row.answerHtml), comments: row.comments.map(comment => ({ id: comment.id, authorName: plain(comment.authorName), text: plain(comment.textHtml) })) }));
const reviews = community.reviews.map(row => ({ id: row.id, type: 'review', authorName: plain(row.authorName), question: plain(row.textHtml), answer: plain(row.replyHtml), rating: row.rating }));
const candidates = [], seen = new Map();
for (const row of [...consultations, ...reviews]) {
  const body = [row.title || '', row.question].join(' ').trim(), folded = normalize(body);
  const reasons = [];
  if (/^(?:test|тест(?:овая запись)?|проверка|qwerty|asdf|asdfgh|фыва|фывапр|йцукен|123|123123|123456|111|11111)[\s.!?\d]*$/iu.test(folded)) reasons.push('explicit-test');
  if (folded.length < 120 && /(?:asdf|qwert|zxcv|фыва|йцук|ячсм){2,}/iu.test(folded) && !/ремонт|слом|не работ|экран|телефон|ноут|планшет|телевизор/iu.test(folded)) reasons.push('keyboard-gibberish');
  if (/казино|онлайн[- ]?казино|ставки на спорт|виагр|viagra|порносайт|эскорт|интим[- ]услуг|заработок без вложений|займ на карту/iu.test(folded) && !/ремонт|слом|экран|телефон|ноут|планшет|телевизор/iu.test(folded)) reasons.push('irrelevant-advertising');
  const key = crypto.createHash('sha256').update([row.type, normalize(row.title || ''), normalize(row.authorName), normalize(row.question), normalize(row.answer)].join('\n')).digest('hex');
  if (seen.has(key) && row.question.length >= 15) reasons.push('exact-duplicate-of-' + seen.get(key)); else seen.set(key, row.id);
  if (reasons.length) candidates.push({ id: row.id, type: row.type, reasons, excerpt: body.slice(0, 600), authorName: row.authorName });
}
for (const [name, value] of [['all-consultations.masked.json', consultations], ['all-reviews.masked.json', reviews], ['candidates.masked.json', { schemaVersion: 1, fullSetInspectedByDeterministicRules: true, counts: { consultations: consultations.length, reviews: reviews.length }, candidates }]]) await fs.writeFile(path.join(directory, name), JSON.stringify(value, null, 2) + '\n');
for (const [name, rows] of [['consultations-000-373.masked.ndjson', consultations.slice(0, 374)], ['consultations-374-end.masked.ndjson', consultations.slice(374)], ['reviews-all.masked.ndjson', reviews]]) await fs.writeFile(path.join(directory, name), rows.map(row => JSON.stringify(row)).join('\n') + '\n');
console.log(JSON.stringify({ consultations: consultations.length, reviews: reviews.length, candidates: candidates.length, candidateIds: candidates.map(row => ({ type: row.type, id: row.id, reasons: row.reasons })), sourceDataModified: false }));
