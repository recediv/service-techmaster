import Link from 'next/link';
import { internalHref } from '../../lib/public-urls.mjs';

export default function ConsultationLinks({ model }) {
  return (model.community?.relatedConsultations || []).map(item =>
    <Link key={item.id} href={internalHref(item.path)} target="_blank" prefetch={false}>{item.title}</Link>);
}
