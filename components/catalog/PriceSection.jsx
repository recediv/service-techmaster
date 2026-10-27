import PriceTabs from './PriceTabs';
import PriceTable from './PriceTable';
import './catalog.css';
import './prices.css';

function hasPrices(tab) {
  const priceColumn = (tab.columns || []).findIndex(column => /цен|стоимост/i.test(column));
  if (priceColumn < 0) return Boolean(tab.rows?.length || tab.columns?.length);
  return (tab.rows || []).some(row => {
    if (row.cells?.length === 1 && Number(row.colSpans?.[0]) > 1) return false;
    const value = String(row.cells?.[priceColumn] ?? '').replace(/<[^>]*>/g, '').replace(/&nbsp;|&#160;|&#x0*a0;/gi, ' ').trim();
    return value.length > 0 && !/^[-–—]+$/.test(value);
  });
}

export default function PriceSection({ table, title, bare = false }) {
  const tabs = table?.tabs?.filter(hasPrices) || [];
  if (!tabs.length) return null;
  return <section className={`catalog-prices ${bare ? 'catalog-prices--embedded' : 'ceni catalog-prices--standalone'}`}>
      {title && <h2 className="title catalog-prices__title">{title}</h2>}
      <PriceTabs key={[table.key, ...tabs.map(tab => tab.id)].join('-')} showNavigation={table.showTabNavigation} navigationCopies={table.tabNavigationCopies} tabs={tabs.map(({ id, sourceTabId, label, columns, columnNotes }) => ({ id, sourceTabId, label, columns, hints: (columnNotes || []).map(Boolean) }))}>
        {tabs.map((tab, index) => <PriceTable key={tab.id || index} tab={tab} caption={table.title || title} />)}
      </PriceTabs>
    </section>;
}

