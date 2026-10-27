import CatalogImage from './CatalogImage';

export default function DeviceGallery({ assets, title }) {
  return assets.map((asset, index) => <CatalogImage key={asset.id || asset.url} asset={asset} alt="" title="" critical={index === 0} />);
}

