'use client';

import { useId, useMemo, useState } from 'react';
import Select, { components, createFilter } from 'react-select';
import './facet-select.css';

const placeholders = {
  type: 'Все категории',
  category: 'Все категории',
  vendor: 'Все производители',
  manufacturer: 'Все производители',
  model: 'Все модели',
};
const filterByLabel = createFilter({ stringify: option => `${option.label} ${option.data.description}` });
const liveMessagesFor = (clearable, countLabel) => ({
  guidance: ({ context, isInitialFocus }) => {
    if (context === 'menu') return 'Стрелки вверх и вниз — выбор варианта. Enter — применить. Escape — закрыть список.';
    if (context === 'input' && isInitialFocus) return `Введите название для поиска или нажмите стрелку вниз.${clearable ? ' Backspace — очистить выбор.' : ''}`;
    if (context === 'value' && clearable) return 'Backspace — очистить выбор.';
    return '';
  },
  onChange: ({ action, label, labels = [], isDisabled }) => {
    if (action === 'clear') return 'Выбор очищен.';
    if (action === 'select-option') return isDisabled ? `${label}: нет подходящих записей.` : `Выбрано: ${label}.`;
    if (action === 'initial-input-focus') return labels.length ? `Выбрано: ${labels.join(', ')}.` : '';
    if (['deselect-option', 'remove-value', 'pop-value'].includes(action)) return 'Выбор очищен.';
    return '';
  },
  onFocus: ({ context, label, focused, isDisabled, isSelected }) => {
    if (context !== 'menu') return '';
    const description = focused.description ? ` ${focused.description}.` : '';
    const count = focused.count === undefined ? '' : ` ${countLabel}: ${focused.count}.`;
    return `${label}.${description}${count}${isSelected ? ' Выбрано.' : ''}${isDisabled ? ' Недоступно.' : ''}`;
  },
  onFilter: ({ inputValue, resultsMessage }) => `${resultsMessage}${inputValue ? ` Поиск: ${inputValue}.` : ''}`,
});

function ClearIndicator(props) {
  return <components.ClearIndicator {...props} innerProps={{ ...props.innerProps, title: 'Очистить выбор' }} />;
}
const selectComponents = { IndicatorSeparator: null, ClearIndicator };

function formatOptionLabel(option, { context }, showSelectedCount) {
  if (context === 'value' && !showSelectedCount) return option.label;
  return <span className="consultation-facet__option-row">
    <span className="consultation-facet__option-copy">
      <span className="consultation-facet__option-label">{option.label}</span>
      {context === 'menu' && option.description && <span className="consultation-facet__description">{option.description}</span>}
    </span>
    {option.count !== undefined && <span className="consultation-facet__count" aria-hidden="true">{option.count}</span>}
  </span>;
}

export default function FacetSelect({ name, label, value = 0, items = [], onChange, onFocus, loading = false, disabled = false, clearable = true, countLabel = 'Консультаций', placeholder, showSelectedCount = false }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const generatedId = useId();
  const id = `consultation-facet-${name}-${generatedId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const options = useMemo(() => {
    const mapped = items.map(item => {
      const count = item.count === undefined || item.count === null ? undefined : Number(item.count);
      return {
        id: Number(item.id),
        label: String(item.title || ''),
        description: String(item.description || ''),
        count: Number.isFinite(count) ? count : undefined,
        isDisabled: Boolean(item.disabled) || count === 0,
      };
    });
    return [...mapped.filter(option => !option.isDisabled), ...mapped.filter(option => option.isDisabled)];
  }, [items]);
  const selected = options.find(option => option.id === Number(value)) || null;
  const ariaLiveMessages = useMemo(() => liveMessagesFor(clearable, countLabel), [clearable, countLabel]);
  return <div className="consultation-facet" data-disabled={disabled || undefined}>
    <label className="consultation-facet__label" id={`${id}-label`} htmlFor={`${id}-input`}>{label}</label>
    <Select
      className="consultation-facet__select"
      classNamePrefix="facet-select"
      id={id}
      inputId={`${id}-input`}
      instanceId={id}
      name={name}
      aria-labelledby={`${id}-label`}
      aria-label={label}
      ariaLiveMessages={ariaLiveMessages}
      options={options}
      value={selected}
      onChange={option => onChange?.(option ? option.id : 0)}
      onFocus={onFocus}
      onMenuOpen={() => { setMenuOpen(true); onFocus?.(); }}
      onMenuClose={() => setMenuOpen(false)}
      getOptionLabel={option => option.label}
      getOptionValue={option => String(option.id)}
      isOptionDisabled={option => option.isDisabled}
      filterOption={(option, input) => option.data.count !== 0 && filterByLabel(option, input)}
      formatOptionLabel={(option, context) => formatOptionLabel(option, context, showSelectedCount)}
      components={selectComponents}
      placeholder={menuOpen ? 'Поиск по названию…' : placeholder || placeholders[name] || 'Все варианты'}
      controlShouldRenderValue={!menuOpen}
      isSearchable
      isClearable={clearable}
      escapeClearsValue={clearable}
      backspaceRemovesValue={clearable}
      isLoading={loading}
      isDisabled={disabled}
      loadingMessage={() => 'Загрузка вариантов…'}
      noOptionsMessage={({ inputValue }) => inputValue ? 'Ничего не найдено' : 'Нет вариантов для выбранных фильтров'}
      screenReaderStatus={({ count }) => `Найдено вариантов: ${count}.`}
      menuPlacement="auto"
      menuPosition="fixed"
      maxMenuHeight={280}
      minMenuHeight={120}
      menuShouldScrollIntoView={false}
      captureMenuScroll={false}
      tabSelectsValue={false}
      unstyled
    />
  </div>;
}
