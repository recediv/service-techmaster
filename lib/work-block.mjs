const ownerTemplates = new Set([6, 16, 18]);
const inheritedTemplates = new Set([5, 10, 15]);

// Template10's exported default must not hide its category's specific terms.
export function resolveWorkBlock(resource, ancestors = [], blocks = {}) {
  if (!resource || !['category', 'repair', 'service'].includes(resource.type)) return null;
  const templateId = Number(resource.templateId);
  let owner;
  if (resource.type === 'category' && ownerTemplates.has(templateId)) owner = resource;
  else if (inheritedTemplates.has(templateId)) {
    owner = [...ancestors].reverse().find(item => item?.type === 'category' && ownerTemplates.has(Number(item.templateId)) && item.blockKey);
  }
  if (!owner?.blockKey) return null;
  return (blocks instanceof Map ? blocks.get(owner.blockKey) : blocks?.[owner.blockKey]) || null;
}
