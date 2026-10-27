import test from 'node:test';
import assert from 'node:assert/strict';
import { communityContext, sourceConsultationType, consultationMatches } from './community-data.mjs';

test('consultation category follows the original three-ancestor rules and special groups', () => {
  const current = { id: 1000, parentId: 100, type: 'repair', templateId: 5 };
  for (const [chain, expected] of [[[100,10,4],10],[[100,200,13],13],[[100,200,10227],10227],[[10227,13,4],13],[[13,10227,4],10227]]) {
    const resource = { ...current, parentId: chain[0] };
    const records = new Map(chain.map((id,index) => [id, { id, parentId: chain[index + 1] || 0 }]));
    assert.equal(sourceConsultationType(resource, records), expected);
  }
});

test('source selections keep twenty latest IDs, all sidebar matches, and no unrelated question fallback', () => {
  const consultations = Array.from({ length: 26 }, (_, index) => ({ id: index + 1, publishedAt: '2020-01-01T00:00:00Z', createdAt: new Date(2020,0,30-index).toISOString(), typeIds: [10], vendorIds: [100], modelIds: [], title: 'Вопрос ' + index, questionHtml: '<p>Полный текст</p>' }));
  const resource = { id: 1000, parentId: 100, type: 'repair', templateId: 5 };
  const byId = new Map([{ id: 100, parentId: 10 },{ id: 10, parentId: 4 },{ id: 4, parentId: 1 },...consultations.map(item => ({ id:item.id, hidemenu:item.id === 2 }))].map(item => [item.id,item]));
  const model = communityContext({ consultations }, resource, byId);
  assert.deepEqual(model.initialConsultations.map(item => item.id), Array.from({ length:20 },(_,index) => 26-index));
  assert.equal(model.relatedConsultations.length, 25);
  assert.equal(model.relatedConsultations[0].id, 1);
  assert.deepEqual(model.homeConsultations.map(item => item.id), [26,25,24,23]);
  assert.deepEqual(communityContext({ consultations }, { type:'category',templateId:10,parentId:999 },byId).homeConsultations, []);
});

test('consultation search combines device filters with Russian text outside the initial page', () => {
  const item = { title:'Ремонт ёлочного устройства', questionHtml:'<p>Не включается экран</p>', typeIds:[10], vendorIds:[100], modelIds:[1000] };
  assert.equal(consultationMatches(item,{ query:'Елочного',type:10,vendor:100,model:1000 }),true);
  assert.equal(consultationMatches(item,{ query:'экран',vendor:999 }),false);
  assert.equal(consultationMatches(item,{ query:'Нет такого текста' }),false);
});
