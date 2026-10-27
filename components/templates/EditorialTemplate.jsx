import { PageHero } from '../hero/HeroFrame';
import RichText from '../content/RichText';
import AboutContent from '../content/AboutContent';
import PrivacyContent from '../content/PrivacyContent';
import '../content/editorial.css';

export default function EditorialTemplate({ model }) {
  const { resource } = model;
  const contentHasHeading = /<h1\b/i.test(resource.contentHtml || '');
  const about = resource.id === 18;
  const privacy = resource.path === '/private-policy/';
  const article = resource.editorialKind === 'article' || resource.editorialKind === 'news';
  const payment = resource.path === '/predoplata/';
  return <main className={`site-editorial${about ? ' site-about' : privacy ? ' site-privacy' : article ? ' site-editorial-detail' : ''}`}>
    <PageHero model={model} headingTag={contentHasHeading ? 'div' : 'h1'} />
    <div className={`center${about ? ' about-page__content' : privacy ? ' privacy-page__container' : article ? ' editorial-page__container' : ''}`}>
    {about ? <AboutContent html={resource.contentHtml} /> : privacy ? <PrivacyContent html={resource.contentHtml} /> : article ? <article className="editorial-article">
      <RichText html={resource.contentHtml} className="editorial-article__body site-prose" />
    </article> : <RichText html={resource.contentHtml} className={payment ? 'statya' : 'statya site-prose'} />}
  </div></main>;
}
