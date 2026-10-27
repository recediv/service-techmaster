import Link from 'next/link';

export default function NotFound() {
  return <main className="site-not-found wrapper">
      <h1>Страница не найдена</h1>
      <p>Проверьте адрес или выберите нужный раздел.</p>
      <p><Link href="/" prefetch={false}>Главная</Link> · <Link href="/services/" prefetch={false}>Ремонт техники</Link> · <Link href="/info/contacts/" prefetch={false}>Контакты</Link></p>
    </main>;
}
