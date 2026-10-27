import { richHtml } from '../../lib/public-urls.mjs';

function span(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 1 && number <= 32 ? number : undefined;
}

export default function PriceTable({ tab, caption }) {
  const columns = tab.columns || [];
  const rows = tab.rows || [];
  const noteId = index => `${tab.sourceTabId || tab.id}-price-note-${index}`;
  const question = index => tab.columnNotes?.[index] && <button type="button" className="catalog-price__hint" data-price-hint={noteId(index)} popoverTarget={noteId(index)} aria-label={`Пояснение: ${columns[index]}`} aria-describedby={noteId(index)}>?</button>;
  const priceColumn = columns.findIndex(column => /цен|стоимост/i.test(column));
  const text = value => String(value ?? '').replace(/<[^>]*>/g, '').replace(/&nbsp;|&#160;|&#x0*a0;/gi, ' ').trim();
  const rowHeading = row => (row.cells?.length === 1 && Number(row.colSpans?.[0]) === columns.length) ||
    (row.cells?.length === columns.length && text(row.cells[0]) && row.cells.slice(1).every(cell => !text(cell)));
  // Only flat tables become mobile cards; merged cells retain a scrollable table.
  const cards = columns.length >= 2 && columns.length <= 4 && rows.length > 0 && rows.every(row =>
    !(row.rowSpans || []).some(value => Number(value) > 1) &&
    (rowHeading(row) || (row.cells?.length === columns.length && !(row.colSpans || []).some(value => Number(value) > 1)))
  );
  return (
    <>
      {tab.introHtml && <div className="catalog-price__intro" dangerouslySetInnerHTML={{ __html: richHtml(tab.introHtml) }} />}
      <div className="catalog-price__scroll" role="region" aria-label={caption || tab.label || 'Цены на ремонт'} tabIndex={0}>
        <table className={`catalog-price__table${cards ? ' catalog-price__table--cards' : ''}`} data-columns={columns.length} role="table">
          <caption className="catalog-sr-only">{caption || tab.label || 'Цены на ремонт'}</caption>
          {columns.length > 0 && (
            <thead><tr role="row">{columns.map((column, index) => (
              <th key={index} scope="col" role="columnheader" data-kind={index === priceColumn ? 'price' : undefined}><span className="catalog-price__heading-label">{column}{question(index)}</span></th>
            ))}</tr></thead>
          )}
          <tbody role="rowgroup">
            {rows.map((row, rowIndex) => (
              <tr key={row.id || rowIndex} role="row" className={[row.bold && 'catalog-price__row--bold', rowHeading(row) && 'catalog-price__row--heading'].filter(Boolean).join(' ') || undefined}>
                {(row.cells || []).map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    role="cell"
                    data-kind={cellIndex === priceColumn && !rowHeading(row) ? 'price' : undefined}
                    colSpan={span(row.colSpans?.[cellIndex])}
                    rowSpan={span(row.rowSpans?.[cellIndex])}
                  >
                    {cellIndex > 0 && !rowHeading(row) && <span className="catalog-price__mobile-label"><span aria-hidden="true">{columns[cellIndex]}</span>{question(cellIndex)}</span>}
                    <div className="catalog-price__value" dangerouslySetInnerHTML={{ __html: richHtml(cell) }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {tab.columnNotes?.some(Boolean) && <div>
        {tab.columnNotes.map((note, index) => note && <div role="tooltip" popover="auto" className="catalog-price-native-tooltip" id={noteId(index)} key={index}>{note}</div>)}
      </div>}
      {tab.noteHtml && <div className="catalog-price__note" dangerouslySetInnerHTML={{ __html: richHtml(tab.noteHtml) }} />}
    </>
  );
}

