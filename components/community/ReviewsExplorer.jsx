'use client';

import { useEffect, useMemo, useState } from 'react';
import FacetSelect from './FacetSelect';
import ReviewCards from './ReviewCards';
import Button from '../ui/Button';
import { latestCommunity } from '../../lib/community-data.mjs';
import './community.css';
import './reviews-explorer.css';

export default function ReviewsExplorer({ items = [], types = [], defaultServiceId = 5, initialPage = 1, fallbackServiceId }) {
  const [serviceId, setServiceId] = useState(defaultServiceId);
  const [page, setPage] = useState(initialPage);
  useEffect(() => {
    const params = new URL(location.href).searchParams;
    const selected = Number(params.get('serviceid'));
    setServiceId(selected && types.some(item => item.id === selected) ? selected : defaultServiceId);
    const requestedPage = Number(params.get('page'));
    setPage(requestedPage > 0 ? requestedPage : initialPage);
  }, [defaultServiceId, initialPage]);
  const ordered = useMemo(() => latestCommunity(items), [items]);
  const serviceOptions = useMemo(() => {
    const counts = new Map();
    for (const item of ordered) counts.set(item.threadKey, (counts.get(item.threadKey) || 0) + 1);
    return types.map(item => ({ ...item, count: counts.get('service_' + item.id) || 0 }))
      .filter(item => item.count > 0 || item.id === serviceId);
  }, [ordered, types, serviceId]);
  let selected = ordered.filter(item => item.threadKey === 'service_' + serviceId);
  if (!selected.length && fallbackServiceId) selected = ordered.filter(item => item.threadKey === 'service_' + fallbackServiceId);
  const pages = Math.max(1, Math.ceil(selected.length / 12));
  const current = Math.min(page, pages);
  const update = (nextServiceId, nextPage) => {
    setServiceId(nextServiceId); setPage(nextPage);
    const url = new URL(location.href);
    url.searchParams.set('serviceid', String(nextServiceId));
    if (nextPage > 1) url.searchParams.set('page', String(nextPage)); else url.searchParams.delete('page');
    history.replaceState(history.state, '', url);
  };
  const reset = () => {
    setServiceId(defaultServiceId); setPage(1);
    const url = new URL(location.href);
    url.searchParams.delete('serviceid'); url.searchParams.delete('page');
    history.replaceState(history.state, '', url);
  };
  return <div className="reviews-explorer">
    <div className="reviews-explorer__filter">
      <FacetSelect name="serviceid" label="Услуга" placeholder="Выберите услугу" items={serviceOptions} value={serviceId} onChange={value => update(value, 1)} clearable={false} countLabel="Отзывов" showSelectedCount />
      <Button type="button" variant="outline" className="reviews-explorer__reset" disabled={serviceId === defaultServiceId && current === 1} onClick={reset}>Сбросить</Button>
    </div>
    <div className="reviews-explorer__results" id="form">
      <div className="reviews-explorer__list"><ReviewCards items={selected.slice((current - 1) * 12, current * 12)} /></div>
      {pages > 1 && <div className="pagination reviews-explorer__pagination" aria-label="Страницы отзывов">{Array.from({ length: pages }, (_, index) => index + 1).map(number => number === current
        ? <span key={number} aria-current="page">{number}</span>
        : <a key={number} href={'?serviceid=' + serviceId + '&page=' + number} data-community-pagination onClick={event => { event.preventDefault(); update(serviceId, number); }}>{number}</a>)}</div>}
    </div>
  </div>;
}
