import Header from './Header';
import Footer from './Footer';
import PageContentReveal from '../ui/PageContentReveal';
import './shell.css';
import './header-modern.css';

export default function SiteShell({ model, children }) {
  return <>
    <Header site={model.site} />
    <PageContentReveal>{children}</PageContentReveal>
    <Footer model={model} />
  </>;
}
