import Breadcrumbs from '../shell/Breadcrumbs';
import './hero.css';

export default function HeroFrame({ model, className = '', children, breadcrumbs = true, background }) {
  return <section className={`site-hero ${className}`.trim()}>
    {background}
    <div className="site-hero__container">
      {breadcrumbs && model && <Breadcrumbs model={model} />}
      {children}
    </div>
  </section>;
}

export function HeroTitle({ children, as: Tag = 'h1', ...props }) {
  return <Tag className="site-hero__title" {...props}>{children}</Tag>;
}

export function PageHero({ model, title = model?.resource?.title, headingTag = 'h1', headingProps = {}, className = '' }) {
  return <HeroFrame model={model} className={`site-hero--compact ${className}`.trim()}>
    <HeroTitle as={headingTag} {...headingProps}>{title}</HeroTitle>
  </HeroFrame>;
}
