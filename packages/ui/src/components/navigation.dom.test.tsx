import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { LangSwitcher, type LangOption } from './LangSwitcher';
import { SiteFooter } from './SiteFooter';
import { SiteNav, type NavItem } from './SiteNav';

const ITEMS: NavItem[] = [
  { key: 'tours', label: 'Туры', href: '/ru/tours' },
  { key: 'builder', label: 'Сборщик туров', href: '/ru/builder' },
  { key: 'hotels', label: 'Отели', href: '/ru/hotels' },
];

const LABELS = {
  nav: 'Основная навигация',
  openMenu: 'Открыть меню',
  closeMenu: 'Закрыть меню',
};

function renderNavLink(
  item: NavItem,
  { children, ...props }: Parameters<Parameters<typeof SiteNav>[0]['renderLink']>[1],
) {
  // `children` is passed explicitly rather than through the spread: jsx-a11y cannot see
  // content that arrives inside a spread and reports every such anchor as empty.
  return (
    <a href={item.href} {...props}>
      {children}
    </a>
  );
}

const LANGS: LangOption[] = [
  { code: 'ru', name: 'Русский', href: '/ru/tours' },
  { code: 'en', name: 'English', href: '/en/tours' },
  { code: 'tr', name: 'Türkçe', href: '/tr/tours' },
];

describe('SiteNav', () => {
  it('is a named landmark with a marked current page', () => {
    render(
      <SiteNav
        items={ITEMS}
        activeKey="tours"
        logo={<a href="/ru">Charva</a>}
        renderLink={renderNavLink}
        labels={LABELS}
      />,
    );

    const nav = screen.getByRole('navigation', { name: 'Основная навигация' });
    // `aria-current="page"` and not just a colour: the prototype marks the active item with a
    // background tint and nothing else, so it is invisible to a screen reader.
    expect(within(nav).getByRole('link', { name: 'Туры' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Отели' })).not.toHaveAttribute('aria-current');
  });

  it('opens and closes the narrow-screen sheet', async () => {
    const user = userEvent.setup();
    render(
      <SiteNav
        items={ITEMS}
        logo={<a href="/ru">Charva</a>}
        renderLink={renderNavLink}
        labels={LABELS}
      />,
    );

    const burger = screen.getByRole('button', { name: 'Открыть меню' });
    expect(burger).toHaveAttribute('aria-expanded', 'false');

    await user.click(burger);
    expect(screen.getByRole('button', { name: 'Закрыть меню' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    // The sheet repeats the menu, so each entry now appears twice.
    expect(screen.getAllByRole('link', { name: 'Туры' })).toHaveLength(2);
  });

  it('closes the sheet on Escape', async () => {
    const user = userEvent.setup();
    render(
      <SiteNav
        items={ITEMS}
        logo={<a href="/ru">Charva</a>}
        renderLink={renderNavLink}
        labels={LABELS}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Открыть меню' }));
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Открыть меню' })).toBeInTheDocument();
  });

  it('closes the sheet when the page changes under it', () => {
    // Otherwise the menu stays open over the page the visitor just navigated to.
    const { rerender } = render(
      <SiteNav
        items={ITEMS}
        activeKey="tours"
        logo={<a href="/ru">Charva</a>}
        renderLink={renderNavLink}
        labels={LABELS}
      />,
    );

    screen.getByRole('button', { name: 'Открыть меню' }).click();
    rerender(
      <SiteNav
        items={ITEMS}
        activeKey="hotels"
        logo={<a href="/ru">Charva</a>}
        renderLink={renderNavLink}
        labels={LABELS}
      />,
    );
    expect(screen.getByRole('button', { name: 'Открыть меню' })).toBeInTheDocument();
  });
});

describe('LangSwitcher', () => {
  function Harness() {
    const [value, setValue] = useState('ru');
    return (
      <>
        <button type="button">Снаружи</button>
        <LangSwitcher
          options={LANGS}
          value={value}
          label="Язык"
          renderLink={(option, { children, ...props }) => (
            <a
              href={option.href}
              data-lang-option
              {...props}
              onClick={(event) => {
                event.preventDefault();
                setValue(option.code);
                props.onClick();
              }}
            >
              {children}
            </a>
          )}
        />
      </>
    );
  }

  it('says which language is on and which is chosen', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const trigger = screen.getByRole('button', { name: 'Язык: Русский' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);
    expect(screen.getByRole('link', { name: /Русский/ })).toHaveAttribute('aria-current', 'true');
  });

  it('offers real links, so a translation can be opened in a new tab', async () => {
    // A chooser that swaps state without changing the URL cannot be shared, bookmarked or
    // crawled, and `hreflang` has nothing to point at.
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: /Язык/ }));
    expect(screen.getByRole('link', { name: /Türkçe/ })).toHaveAttribute('href', '/tr/tours');
  });

  it('closes on Escape and gives focus back to the button', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const trigger = screen.getByRole('button', { name: /Язык/ });
    await user.click(trigger);
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('link', { name: /Türkçe/ })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('closes when something else on the page is clicked', async () => {
    // The prototype's dropdown hangs over the content until the page is reloaded.
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: /Язык/ }));
    await user.click(screen.getByRole('button', { name: 'Снаружи' }));
    expect(screen.queryByRole('link', { name: /Türkçe/ })).not.toBeInTheDocument();
  });

  it('closes once a language is chosen', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: /Язык/ }));
    await user.click(screen.getByRole('link', { name: /English/ }));

    expect(screen.getByRole('button', { name: 'Язык: English' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Türkçe/ })).not.toBeInTheDocument();
  });
});

describe('SiteFooter', () => {
  it('names its social buttons for anyone who cannot read two letters', () => {
    render(
      <SiteFooter
        label="Подвал сайта"
        logo={<span>Charva</span>}
        legal="Charva Travel — туроператор по Туркменистану."
        copyright="© 2026 Charva Travel"
        socials={[{ key: 'ig', short: 'IG', label: 'Instagram', href: 'https://instagram.com' }]}
        columns={[
          {
            key: 'tours',
            title: 'Туры',
            links: [{ key: 'all', label: 'Готовые туры', href: '/ru/tours' }],
          },
        ]}
        renderLink={(link, { children, ...props }) => (
          <a href={link.href} {...props}>
            {children}
          </a>
        )}
      />,
    );

    expect(screen.getByRole('link', { name: 'Instagram' })).toBeInTheDocument();
    expect(screen.getByRole('contentinfo', { name: 'Подвал сайта' })).toBeInTheDocument();
  });

  it('renders on a dark surface, so its hairlines and muted text resolve for one', () => {
    const { container } = render(
      <SiteFooter
        label="Подвал"
        logo={<span>Charva</span>}
        legal="—"
        copyright="—"
        socials={[]}
        columns={[]}
        renderLink={(link, { children, ...props }) => (
          <a href={link.href} {...props}>
            {children}
          </a>
        )}
      />,
    );
    expect(container.querySelector('footer')).toHaveAttribute('data-surface', 'dark');
  });
});
