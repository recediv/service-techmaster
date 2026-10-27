'use client';

export default function SourceSelect({ name, label, value, items = [], onChange, disabled = false, placeholder = true }) {
  const selected = items.find(item => String(item.id) === String(value)) || (!placeholder ? items[0] : null);
  return <div className="jq-selectbox source-select">
    <select name={name} aria-label={label || 'Услуга'} value={value} onChange={onChange} disabled={disabled}>
      {placeholder && <option value="0">{label}</option>}
      {items.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
    </select>
    <div className="jq-selectbox__select" aria-hidden="true">
      <div className="jq-selectbox__select-text">{selected?.title || label}</div>
      <div className="jq-selectbox__trigger"><div className="jq-selectbox__trigger-arrow" /></div>
    </div>
  </div>;
}
