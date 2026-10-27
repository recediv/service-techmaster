import test from 'node:test';
import assert from 'node:assert/strict';
import { editorialCardData, editorialTagIsActive, filterEditorialByTag, editorialTagPage, editorialTagHref } from './editorial-data.mjs';

const items = Array.from({ length: 30 }, (_, index) => ({ id: index + 1, path: '/articles/' + (index + 1) + '/', title: 'Article ' + (index + 1), tvs: { tags: index === 28 ? 'Ремонт, Мониторы' : 'Диагностика дисплея, ремонт' } }));

test('tag filter searches the entire index by case-insensitive SQL LIKE substring', () => {
  assert.deepEqual(filterEditorialByTag(items, 'МОНИТ').map(item => item.id), [29]);
  assert.equal(filterEditorialByTag(items, 'рем%т').length, 30);
  assert.equal(filterEditorialByTag(items, 'мон_торы').length, 1);
  assert.equal(filterEditorialByTag(items, 'нет такого тега').length, 0);
  assert.equal(filterEditorialByTag(items, '').length, 30);
  assert.equal(editorialTagIsActive('0'), false);
  assert.deepEqual(filterEditorialByTag([{ tvs: { tags: 'A+B, 100%, under_score' } }], 'A+B').length, 1);
  assert.equal(filterEditorialByTag([{ tvs: { tags: '100%, under_score' } }], '100\\%').length, 1);
});

test('filtered pagination retains all results and usable encoded query links', () => {
  const first = editorialTagPage(items, 'ремонт', 1), second = editorialTagPage(items, 'ремонт', 2), last = editorialTagPage(items, 'ремонт', 3);
  assert.equal(first.total, 3); assert.equal(first.items.length, 12); assert.equal(second.items[0].id, 13); assert.equal(last.items.length, 6);
  assert.equal(editorialTagPage(items, 'МОНИТОРЫ', 'invalid').page, 1);
  assert.equal(editorialTagPage(items, 'МОНИТОРЫ', 9).outOfRange, true);
  assert.deepEqual(editorialTagPage(items, 'МОНИТОРЫ', 9).items.map(item => item.id), [29]);
  assert.equal(editorialTagHref('/info/articles/', 'A&B ремонт', 2), '/info/articles/?tag=A%26B+%D1%80%D0%B5%D0%BC%D0%BE%D0%BD%D1%82&page=2');
  assert.equal(new URL(editorialTagHref('/info/news/', 'Ремонт', 1), 'https://example.test').searchParams.get('tag'), 'Ремонт');
  assert.equal(editorialTagHref('/info/articles/', null, 2), '/info/articles/?page=2');
  assert.equal(editorialTagHref('/info/articles/', null, 1), '/info/articles/');
  assert.equal(editorialTagHref('/info/articles/', '0', 2), '/info/articles/?tag=0&page=2');
});

test('client projection contains card fields and one resolved public image without article bodies or manifest', () => {
  const projected = editorialCardData({ id: 1, path: '/article/', title: 'Title', publishedAt: 123, description: 'Description', contentHtml: '<p>Full article.</p>', imageAssetId: 'photo', tvs: { tags: 'A,B', secret: 'Never project' }, unrelated: ['Never project'] }, new Map([['photo', { url: '/media/photo.jpg', internal: 'Never project' }]]));
  assert.deepEqual(projected, { id: 1, path: '/article/', title: 'Title', description: 'Description', publishedAt: 123, imageUrl: '/media/photo.jpg', tvs: { tags: 'A,B' } });
});
