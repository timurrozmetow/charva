import { type Meta, type StoryObj } from '@storybook/react';
import { useState } from 'react';

import { Button } from '../components/Button';
import { LangSwitcher, type LangOption } from '../components/LangSwitcher';
import { SiteFooter } from '../components/SiteFooter';
import { type NavItem, SiteNav } from '../components/SiteNav';

const meta: Meta = { title: 'Navigation/Chrome' };
export default meta;
type Story = StoryObj;

const GLOBAL_ITEMS: NavItem[] = [
  { key: 'tours', label: 'Туры', href: '/ru/tours' },
  { key: 'builder', label: 'Сборщик туров', href: '/ru/builder' },
  { key: 'hotels', label: 'Отели', href: '/ru/hotels' },
  { key: 'turkmenistan', label: 'Туркменистан', href: '/ru/turkmenistan' },
  { key: 'gallery', label: 'Галерея', href: '/ru/gallery' },
  { key: 'video', label: 'Видео', href: '/ru/video' },
  { key: 'reviews', label: 'Отзывы', href: '/ru/reviews' },
];

const LANGS: LangOption[] = [
  { code: 'ru', name: 'Русский', href: '/ru/tours' },
  { code: 'en', name: 'English', href: '/en/tours' },
  { code: 'tr', name: 'Türkçe', href: '/tr/tours' },
];

function Logo() {
  return (
    <a href="/ru" className="font-medium text-cardTitle text-ink no-underline">
      Charva
    </a>
  );
}

/**
 * The island, with the language chooser the prototype leaves half-built.
 *
 * Narrow the preview below 1024 to see the menu collapse into a sheet — behaviour the design
 * describes in prose and does not draw, since every page in the package is fixed at 1280.
 */
export const Header: Story = {
  parameters: { layout: 'fullscreen' },
  render: function HeaderStory() {
    const [active, setActive] = useState('tours');
    const [lang, setLang] = useState('ru');

    return (
      <div className="-m-10 min-h-[420px]">
        <SiteNav
          items={GLOBAL_ITEMS}
          activeKey={active}
          logo={<Logo />}
          cta={<Button size="sm">Онлайн-заявка</Button>}
          labels={{
            nav: 'Основная навигация',
            openMenu: 'Открыть меню',
            closeMenu: 'Закрыть меню',
          }}
          langSwitcher={
            <LangSwitcher
              options={LANGS}
              value={lang}
              label="Язык"
              renderLink={(option, { children, ...props }) => (
                <a
                  href={option.href}
                  data-lang-option
                  {...props}
                  onClick={(event) => {
                    event.preventDefault();
                    setLang(option.code);
                    props.onClick();
                  }}
                >
                  {children}
                </a>
              )}
            />
          }
          renderLink={(item, { children, ...props }) => (
            <a
              href={item.href}
              {...props}
              onClick={(event) => {
                event.preventDefault();
                setActive(item.key);
                props.onClick?.();
              }}
            >
              {children}
            </a>
          )}
        />
      </div>
    );
  },
};

export const Footer: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => (
    <div className="-m-10">
      <SiteFooter
        label="Подвал сайта"
        logo={<span className="text-h3 font-medium text-accent">Charva</span>}
        legal="Charva Travel — туроператор по Туркменистану. Ашхабад, ул. Битарап Туркменистан, 42. Лицензия № TM-1428."
        copyright="© 2026 Charva Travel. Все права защищены."
        socials={[
          { key: 'ig', short: 'IG', label: 'Instagram', href: 'https://instagram.com' },
          { key: 'tg', short: 'TG', label: 'Telegram', href: 'https://t.me' },
          { key: 'wa', short: 'WA', label: 'WhatsApp', href: 'https://wa.me' },
          { key: 'yt', short: 'YT', label: 'YouTube', href: 'https://youtube.com' },
        ]}
        columns={[
          {
            key: 'tours',
            title: 'Туры',
            links: [
              { key: 'ready', label: 'Готовые туры', href: '/ru/tours' },
              { key: 'builder', label: 'Сборщик туров', href: '/ru/builder' },
              { key: 'hotels', label: 'Отели', href: '/ru/hotels' },
              { key: 'lead', label: 'Онлайн-заявка', href: '/ru/contact' },
            ],
          },
          {
            key: 'country',
            title: 'Туркменистан',
            links: [
              { key: 'about', label: 'О стране и виза', href: '/ru/turkmenistan' },
              { key: 'gallery', label: 'Галерея', href: '/ru/gallery' },
              { key: 'video', label: 'Видео', href: '/ru/video' },
              { key: 'reviews', label: 'Отзывы', href: '/ru/reviews' },
            ],
          },
          {
            key: 'contacts',
            title: 'Контакты',
            links: [
              { key: 'phone', label: '+993 12 456 789', href: 'tel:+99312456789' },
              { key: 'mail', label: 'info@charvatravel.com', href: 'mailto:info@charvatravel.com' },
              { key: 'hours', label: 'Пн–Сб, 09:00–18:00', href: '/ru/contact' },
            ],
          },
        ]}
        crossLinks={
          <span className="flex gap-6">
            <a
              href="https://charva-travel.com"
              className="text-muted no-underline hover:text-accent"
            >
              Выбор сайта
            </a>
            <a
              href="https://umra.charva-travel.com"
              className="text-muted no-underline hover:text-accent"
            >
              Charva Umrah →
            </a>
          </span>
        }
        renderLink={(link, { children, ...props }) => (
          <a href={link.href} {...props}>
            {children}
          </a>
        )}
      />
    </div>
  ),
};
