'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { internalHref } from '../../lib/public-urls.mjs';
import { navigateOnSite } from '../../lib/client-navigation.mjs';
import FacetSelect from '../community/FacetSelect';
import './model-picker.css';

export default function ModelPicker({ items = [] }) {
  const router = useRouter();
  const [value, setValue] = useState(0);
  const options = useMemo(() => [...items]
    .sort((a, b) => a.title.localeCompare(b.title, 'ru'))
    .map(item => ({ id: item.id, title: item.title })), [items]);
  function selectModel(id) {
    setValue(id);
    const item = items.find(item => item.id === id);
    if (item?.path) navigateOnSite(internalHref(item.path), router);
  }
  return <div className="model-picker">
    <p className="model-picker__heading">Выберите модель устройства</p>
    <div className="model-picker__field" data-page-reveal-skip>
      <FacetSelect name="device-model" label="Выберите модель" placeholder="Выберите модель" value={value} items={options} onChange={selectModel} clearable />
    </div>
  </div>;
}
