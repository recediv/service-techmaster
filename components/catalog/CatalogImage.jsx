export default function CatalogImage({ asset, alt = '', critical = false, className, style, ...props }) {
  if (!asset?.url) return null;
  return (
    <img
      {...props}
      src={asset.url}
      alt={alt}
      width={asset.width || undefined}
      height={asset.height || undefined}
      style={{ height: 'auto', ...style }}
      loading={critical ? 'eager' : 'lazy'}
      fetchPriority={critical ? 'high' : undefined}
      decoding="async"
      className={className}
    />
  );
}

