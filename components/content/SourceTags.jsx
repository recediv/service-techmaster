import { Fragment } from 'react';
import Link from 'next/link';
import { internalHref } from '../../lib/public-urls.mjs';

// Original snippet tags: explode comma, trim, skip empty, PHP urlencode.
const encodeTag = value => encodeURIComponent(value).replace(/%20/g, '+').replace(/[!'()*]/g, character => '%' + character.charCodeAt(0).toString(16).toUpperCase());

export default function SourceTags({ tags = [] }) {
  const values = (Array.isArray(tags) ? tags : String(tags || '').split(',')).map(tag => String(tag && typeof tag === 'object' ? tag.title || '' : tag || '').trim()).filter(Boolean);
  return values.map((tag,index) => <Fragment key={index}>{index > 0 ? ' ' : null}<Link href={internalHref('/info/articles/?tag=' + encodeTag(tag))} className="post-portfolio__tag" prefetch={false}>{tag}</Link></Fragment>);
}
