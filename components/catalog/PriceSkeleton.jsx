function TextBlock({ block, className }) {
  if (!block?.height) return null;
  return <div className={className} style={{ height: block.height }}>
    {block.lines.map((line, index) => <span className="catalog-price-skeleton__bar" key={index} style={{ left: line.left, top: line.top + (line.height - 8) / 2, width: line.width }} />)}
  </div>;
}

function Placeholder({ cell, row, column }) {
  const widths = cell?.widths || [column ? 0.42 : [0.72, 0.87, 0.6][row % 3]];
  return <div className="catalog-price-skeleton__value" style={{ '--skeleton-line-height': `${cell?.lineHeight || 22}px` }}>
    {widths.map((width, index) => <div className="catalog-price-skeleton__line" key={index}>
      <span className="catalog-price-skeleton__bar" style={{ width: `${width * 100}%` }} />
    </div>)}
  </div>;
}

export default function PriceSkeleton({ columns = [], hints = [], layout, rows = 6 }) {
  const priceColumn = columns.findIndex(column => /цен|стоимост/i.test(column));
  const question = index => hints[index] && <span className="catalog-price__hint">?</span>;
  const descriptors = layout?.rows || [];
  return <div className="catalog-price-skeleton" aria-hidden="true">
    <TextBlock block={layout?.intro} className="catalog-price-skeleton__text-block" />
    <div className="catalog-price__scroll">
      <table className={`catalog-price__table catalog-price-skeleton__table${layout?.cards ? ' catalog-price__table--cards' : ''}`} data-columns={columns.length} role="presentation">
        <thead><tr>{columns.map((column, index) => <th key={index} data-kind={index === priceColumn ? 'price' : undefined}>
          <span className="catalog-price__heading-label">{column}{question(index)}</span>
        </th>)}</tr></thead>
        <tbody>{Array.from({ length: Math.max(rows, descriptors.length) }, (_, index) => {
          const row = descriptors[index];
          const heading = row?.heading;
          const cells = heading ? [row.cells[0]] : columns.map((_, column) => row?.cells[column]);
          return <tr key={index} className={[row?.bold && 'catalog-price__row--bold', heading && 'catalog-price__row--heading'].filter(Boolean).join(' ') || undefined} style={row ? { height: row.height } : undefined}>
            {cells.map((cell, column) => <td key={column} colSpan={heading ? columns.length : cell?.colSpan} rowSpan={cell?.rowSpan} data-kind={!heading && column === priceColumn ? 'price' : undefined}>
              {column > 0 && !heading && <span className="catalog-price__mobile-label"><span>{columns[column]}</span>{question(column)}</span>}
              <Placeholder cell={cell} row={index} column={column} />
            </td>)}
          </tr>;
        })}</tbody>
      </table>
    </div>
    <TextBlock block={layout?.note} className="catalog-price-skeleton__text-block" />
  </div>;
}
