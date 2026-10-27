import test from 'node:test';
import assert from 'node:assert/strict';
import { classicPageWindow, pdoPageEntries } from './pagination-data.mjs';

test('original pdoPage classic window has five centered pages and shifts at boundaries', () => {
  assert.deepEqual(classicPageWindow(1, 10), [1,2,3,4,5]);
  assert.deepEqual(classicPageWindow(2, 10), [1,2,3,4,5]);
  assert.deepEqual(classicPageWindow(5, 10), [3,4,5,6,7]);
  assert.deepEqual(classicPageWindow(9, 10), [6,7,8,9,10]);
  assert.deepEqual(classicPageWindow(10, 10), [6,7,8,9,10]);
  assert.deepEqual(classicPageWindow(2, 3), [1,2,3]);
  assert.deepEqual(classicPageWindow(1, 1), []);
});

test('source pager preserves disabled boundary spans, current anchor and original labels', () => {
  const items=Array.from({length:10},(_,index)=>({page:index+1,path:'/list/page-'+(index+1)+'/'}));
  const first=pdoPageEntries({items,current:1,total:10}),last=pdoPageEntries({items,current:10,total:10});
  assert.deepEqual(first.slice(0,2).map(item=>[item.text,item.href]),[['Первая',null],['«',null]]);
  assert.deepEqual(first.slice(-2).map(item=>[item.text,item.href]),[['»','/list/page-2/'],['Последняя','/list/page-10/']]);
  assert.equal(first.find(item=>item.current).href,'/list/page-1/');
  assert.deepEqual(last.slice(-2).map(item=>[item.text,item.href]),[['»',null],['Последняя',null]]);
  assert.deepEqual(pdoPageEntries({items:[items[0]],current:1,total:1}),[]);
});
