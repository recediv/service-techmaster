'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import FacetSelect from './FacetSelect';
import ConsultationCards from './ConsultationCards';
import Button from '../ui/Button';
import { consultationCardData } from '../../lib/community-data.mjs';
import { consultationFacets } from '../../lib/consultation-facets.mjs';
import { withBase } from '../../lib/public-urls.mjs';
import './community.css';
import './consultation-explorer.css';

const requests = new Map();
function getConsultations(url) {
  if (!requests.has(url)) requests.set(url, fetch(withBase(url), { cache: 'no-cache' }).then(response => {
    if (!response.ok) throw new Error('Consultations unavailable.');
    return response.json();
  }).then(async data => {
    if (data.url) {
      if (!/^\/community\/consultations-[a-f0-9]{12,64}\.json$/.test(data.url)) throw new Error('Invalid public consultation manifest.');
      const response = await fetch(withBase(data.url), { cache: 'force-cache' });
      if (!response.ok) throw new Error('Consultations unavailable.');
      return response.json();
    }
    return data;
  }).then(data => {
    if (data.schemaVersion !== 1 || !Array.isArray(data.consultations) || !data.filters) throw new Error('Invalid public consultation data.');
    return data;
  }).catch(error => { requests.delete(url); throw error; }));
  return requests.get(url);
}
const emptySelection = { type: 0, vendor: 0, model: 0 };
const emptyItems = [];
const facetFields = [
  { name: 'type', options: 'types', label: 'Категория' },
  { name: 'vendor', options: 'vendors', label: 'Производитель' },
  { name: 'model', options: 'models', label: 'Модель' },
];
function updateAddress(selection, query) {
  const url = new URL(location.href);
  for (const [name, value] of Object.entries({ ...selection, query: query.trim() })) {
    if (value) url.searchParams.set(name, String(value)); else url.searchParams.delete(name);
  }
  history.replaceState(history.state, '', url);
}

function CloseIcon() {
  return <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="m6 6 8 8M14 6l-8 8" /></svg>;
}

export default function ConsultationExplorer({ initialItems = emptyItems, initialTotal, initialTypes = emptyItems, jsonUrl, currentId, children, renderHeading = true }) {
  const [selection, setSelection] = useState(emptySelection);
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [data, setData] = useState(null);
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const sequence = useRef(0);
  const dataset = useRef(null);
  const searchId = useId();
  const filterTitleId = useId();
  const load = useCallback(async () => {
    if (dataset.current) return;
    const request = ++sequence.current;
    setLoading(true); setError(false);
    try {
      const payload = await getConsultations(jsonUrl);
      if (request !== sequence.current) return;
      dataset.current = payload;
      setData(payload);
    } catch { if (request === sequence.current) setError(true); }
    finally { if (request === sequence.current) setLoading(false); }
  }, [jsonUrl]);

  const changeFacet = (name, value) => {
    const next = { ...selection, [name]: value };
    setSelection(next);
    setLimit(20);
    updateAddress(next, appliedQuery);
    load();
  };
  const search = (text = query) => {
    setQuery(text);
    setAppliedQuery(text.trim());
    setLimit(20);
    updateAddress(selection, text);
    load();
  };
  const reset = () => {
    setSelection(emptySelection);
    setQuery(''); setAppliedQuery(''); setLimit(20);
    updateAddress(emptySelection, '');
    load();
  };
  useEffect(() => {
    sequence.current++;
    dataset.current = null;
    setData(null); setLoading(false); setError(false);
    const restore = () => {
      const params = new URL(location.href).searchParams;
      const next = Object.fromEntries(Object.keys(emptySelection).map(name => {
        const value = Number(params.get(name));
        return [name, Number.isSafeInteger(value) && value > 0 ? value : 0];
      }));
      const text = params.get('query') || '';
      setSelection(next); setQuery(text); setAppliedQuery(text.trim()); setLimit(20);
      if (Object.values(next).some(Boolean) || text || currentId) load();
    };
    restore();
    addEventListener('popstate', restore);
    return () => { sequence.current++; removeEventListener('popstate', restore); };
  }, [jsonUrl, currentId, load]);

  // Unknown URL values must not leave an invisible active filter behind.
  useEffect(() => {
    if (!data) return;
    const next = Object.fromEntries(facetFields.map(({ name, options }) => [name,
      data.filters[options]?.some(option => option.id === selection[name]) ? selection[name] : 0,
    ]));
    if (facetFields.some(({ name }) => next[name] !== selection[name])) {
      setSelection(next);
      updateAddress(next, appliedQuery);
    }
  }, [data, selection, appliedQuery]);

  const result = useMemo(() => data ? consultationFacets(data.consultations, data.filters, { ...selection, query: appliedQuery, currentId }) : null, [data, selection, appliedQuery, currentId]);
  const items = useMemo(() => result ? result.items.slice(0, limit).map(item => consultationCardData(item, data.filters)) : initialItems, [result, limit, data, initialItems]);
  // Until the full dataset arrives, unknown counts are not valid facet choices.
  const facets = result?.facets || { types: emptyItems, vendors: emptyItems, models: emptyItems };
  const activeFilters = facetFields.filter(({ name }) => selection[name]).map(field => ({ ...field,
    title: data?.filters[field.options]?.find(option => option.id === selection[field.name])?.title || initialTypes.find(option => field.name === 'type' && option.id === selection.type)?.title || field.label,
  }));
  const hasFilters = activeFilters.length > 0 || Boolean(appliedQuery);
  const hasMore = result ? result.items.length > limit : initialTotal !== undefined ? initialTotal > initialItems.length : initialItems.length === 20;
  const total = result ? result.items.length : initialTotal;

  return <section className={`consultation-explorer${renderHeading ? ' consultation-explorer--with-heading' : ''}`} data-community-json={jsonUrl}>
      {renderHeading && <div className="title" role="heading" aria-level="1">{currentId ? 'Консультация' : 'Консультации'}</div>}
      <form className="consultation-explorer__search" role="search" onSubmit={event => { event.preventDefault(); search(); }}>
        <label className="consultation-explorer__search-label" htmlFor={searchId}>Поиск по консультациям</label>
        <div className="consultation-explorer__search-row">
          <div className="consultation-explorer__search-field">
            <svg className="consultation-explorer__search-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
            <input id={searchId} type="search" name="query" placeholder="Быстрый поиск консультаций" value={query} onChange={event => setQuery(event.target.value)} onFocus={load} />
            {query && <button className="consultation-explorer__clear" type="button" aria-label="Очистить поиск" onClick={() => search('')}><CloseIcon /></button>}
          </div>
          <Button type="submit" variant="green" className="consultation-explorer__search-button">Найти</Button>
        </div>
      </form>
      <aside className="consultation-explorer__filters" aria-labelledby={filterTitleId}>
        <div className="consultation-explorer__filter-heading">
          <h2 id={filterTitleId}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M4 6h7m4 0h5M4 12h2m4 0h10M4 18h10m4 0h2" /><circle cx="13" cy="6" r="2" /><circle cx="8" cy="12" r="2" /><circle cx="16" cy="18" r="2" /></svg>Фильтр</h2>
          {hasFilters && <button type="button" className="consultation-explorer__text-button" onClick={reset}>Сбросить</button>}
        </div>
        <p className="consultation-explorer__filter-hint">Варианты учитывают поиск и другие фильтры</p>
        <form id="form-filter" className="consultation-explorer__facet-fields" onSubmit={event => event.preventDefault()}>
          {facetFields.map(({ name, label, options }) => <FacetSelect key={name} name={name} label={label} items={facets[options]} value={selection[name]} loading={loading} onFocus={load} onChange={value => changeFacet(name, value)} />)}
        </form>
      </aside>
      <div className="consultation-explorer__content" aria-busy={loading}>
        {children}
        {currentId && <h2 className="consultation-explorer__other-title">Другие вопросы</h2>}
        <div className="consultation-explorer__results-heading" role="status" aria-live="polite" aria-atomic="true">
          <h2>{total !== undefined ? <>Найдено: <span>{total}</span></> : 'Последние вопросы'}</h2>
          <span>{total !== undefined ? `Показано ${items.length} из ${total}` : loading ? 'Загружаем консультации…' : `Показано ${items.length}`}</span>
        </div>
        {hasFilters && <div className="consultation-explorer__active-filters" aria-label="Выбранные фильтры">
          {appliedQuery && <button type="button" className="consultation-explorer__chip" onClick={() => search('')} aria-label={`Убрать поиск: ${appliedQuery}`}><span>Поиск: {appliedQuery}</span><CloseIcon /></button>}
          {activeFilters.map(({ name, label, title }) => <button type="button" key={name} className="consultation-explorer__chip" onClick={() => changeFacet(name, 0)} aria-label={`Убрать фильтр ${label}: ${title}`}><span>{title}</span><CloseIcon /></button>)}
        </div>}
        {error && <div className="consultation-explorer__notice" role="alert"><p>Не удалось загрузить консультации. Последние вопросы остаются доступны.</p><Button type="button" variant="outline" onClick={load}>Повторить</Button></div>}
        {result?.items.length === 0 && <div className="consultation-explorer__empty"><h3>Консультации не найдены</h3><p>Измените поисковый запрос или уберите часть фильтров.</p><Button type="button" variant="outline" onClick={reset}>Сбросить фильтры</Button></div>}
        <div className="consultation-explorer__list"><ConsultationCards items={items} /></div>
        {hasMore && <div className="consultation-explorer__more"><Button type="button" variant="outline" disabled={loading} onClick={() => { setLimit(value => value + 20); load(); }}>Показать ещё</Button></div>}
      </div>
  </section>;
}
