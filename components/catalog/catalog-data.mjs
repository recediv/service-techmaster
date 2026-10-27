import { getAsset, withBase } from '../../lib/public-urls.mjs';

export function catalogAsset(model, reference) {
  if (!reference) return null;
  const asset = typeof reference === 'object' ? reference : getAsset(model, reference);
  if (!asset) return null;
  const value = typeof asset === 'string' ? { url: asset } : asset;
  return value.url ? { ...value, url: withBase(value.url) } : null;
}

export function resourceImage(model, resource) {
  return catalogAsset(model, resource?.imageAssetId || resource?.tvs?.categoryLogo);
}

export function resourceHeading(model) {
  const resource = model.resource;
  if (resource.heading) return resource.heading;
  if (resource.templateId === 5) {
    const brand = model.parent?.id === 4082 ? '' : model.parent?.title || '';
    return ['Ремонт', brand, resource.title].filter(Boolean).join(' ');
  }
  if (resource.templateId === 10 && resource.id !== 4082) {
    return [model.parent?.title, resource.title].filter(Boolean).join(' ');
  }
  return resource.title;
}

