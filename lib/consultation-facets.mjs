import { consultationMatches, latestConsultations } from './community-data.mjs';

const definitions = [
  ['type', 'types', 'typeIds'],
  ['vendor', 'vendors', 'vendorIds'],
  ['model', 'models', 'modelIds'],
];

export function consultationFacets(consultations = [], filters = {}, { type = 0, vendor = 0, model = 0, query = '', currentId } = {}) {
  const selection = { type, vendor, model };
  const typesById = new Map((filters.types || []).map(option => [option.id, option]));
  const vendorsById = new Map((filters.vendors || []).map(option => [option.id, option]));
  const rows = latestConsultations(consultations).filter(item => item.id !== currentId);
  const queryRows = rows.filter(item => consultationMatches(item, { query }));
  const items = queryRows.filter(item => consultationMatches(item, selection));
  const facets = {};

  for (const [name, optionsKey, idsKey] of definitions) {
    const globallyUsed = new Set(rows.flatMap(item => item[idsKey] || []));
    const otherSelections = { ...selection, [name]: 0 };
    const counts = new Map();
    for (const item of queryRows) {
      if (!consultationMatches(item, otherSelections)) continue;
      for (const id of new Set(item[idsKey] || [])) counts.set(id, (counts.get(id) || 0) + 1);
    }
    facets[optionsKey] = (filters[optionsKey] || [])
      .filter(option => globallyUsed.has(option.id) || Number(selection[name]) === option.id)
      .map(option => {
        const count = counts.get(option.id) || 0;
        const parentVendor = optionsKey === 'models' ? vendorsById.get(option.parentId) : undefined;
        const parentLabels = optionsKey === 'vendors'
          ? [typesById.get(option.parentId)?.title]
          : [parentVendor?.title, typesById.get(parentVendor?.parentId)?.title];
        const description = [...new Set(parentLabels.filter(label => label && label !== option.title))].join(' · ');
        return { ...option, ...(optionsKey !== 'types' ? { description } : {}), count, disabled: count === 0 };
      })
      .filter(option => option.count > 0 || Number(selection[name]) === option.id);
  }

  return { items, facets };
}
