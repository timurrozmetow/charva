import { beforeEach, describe, expect, it } from 'vitest';

import { applyDocumentHead, type DocumentHead } from './head';

/** What the shell injects before the application starts — the real markup, in the real order. */
function serverHead(path = '/ru'): void {
  document.head.innerHTML = `
    <title>Charva Travel — туры по Туркменистану</title>
    <meta name="description" content="Туры по Туркменистану.">
    <link rel="canonical" href="https://global.charva-travel.com${path}">
    <link rel="alternate" hreflang="ru" href="https://global.charva-travel.com/ru">
    <link rel="alternate" hreflang="en" href="https://global.charva-travel.com/en">
    <link rel="alternate" hreflang="x-default" href="https://global.charva-travel.com/ru">
    <meta property="og:title" content="Charva Travel — туры по Туркменистану">
    <meta property="og:url" content="https://global.charva-travel.com${path}">
    <meta property="og:image" content="https://global.charva-travel.com/api/v1/img/hero?w=1280">
    <link rel="modulepreload" href="/assets/index-abc123.js">
  `;
}

const head = (path: string): DocumentHead => ({
  lang: 'ru',
  title: `Заголовок ${path}`,
  description: `Описание ${path}`,
  canonical: `https://global.charva-travel.com${path}`,
  alternates: [
    { hreflang: 'ru', href: `https://global.charva-travel.com${path}` },
    { hreflang: 'en', href: `https://global.charva-travel.com/en${path.slice(3)}` },
    { hreflang: 'x-default', href: `https://global.charva-travel.com${path}` },
  ],
});

const canonicals = () => [...document.head.querySelectorAll('link[rel="canonical"]')];
const alternates = () => [...document.head.querySelectorAll('link[rel="alternate"][hreflang]')];

beforeEach(() => {
  serverHead();
});

describe('applyDocumentHead', () => {
  it('leaves one canonical, not two, when the shell has already written one', () => {
    applyDocumentHead(head('/ru'));

    expect(canonicals()).toHaveLength(1);
    expect(canonicals()[0]?.getAttribute('href')).toBe('https://global.charva-travel.com/ru');
  });

  it('leaves one set of hreflang, not two', () => {
    applyDocumentHead(head('/ru'));

    expect(alternates().map((link) => link.getAttribute('hreflang'))).toEqual([
      'ru',
      'en',
      'x-default',
    ]);
  });

  it('stays at one canonical across navigations, and points at the current page', () => {
    applyDocumentHead(head('/ru'));
    applyDocumentHead(head('/ru/tours'));
    applyDocumentHead(head('/ru/tours/turkmenistan-2-days'));

    expect(canonicals()).toHaveLength(1);
    expect(alternates()).toHaveLength(3);
    expect(canonicals()[0]?.getAttribute('href')).toBe(
      'https://global.charva-travel.com/ru/tours/turkmenistan-2-days',
    );
  });

  it('patches the description rather than appending a second one', () => {
    applyDocumentHead(head('/ru/tours'));

    const tags = document.head.querySelectorAll('meta[name="description"]');
    expect(tags).toHaveLength(1);
    expect(tags[0]?.getAttribute('content')).toBe('Описание /ru/tours');
  });

  it('writes the title and the document language', () => {
    applyDocumentHead({ ...head('/tm/paket'), lang: 'tk' });

    expect(document.title).toBe('Заголовок /tm/paket');
    expect(document.documentElement.lang).toBe('tk');
  });

  /*
   * The card belongs to the server. Nothing that reads it runs JavaScript, and the application
   * has no way to know the page's first photograph — so a half-updated card would be worse than
   * the server's, whole. This is a decision, which is why it is pinned down here.
   */
  it('does not touch the Open Graph card', () => {
    applyDocumentHead(head('/ru/tours'));

    expect(document.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe(
      'https://global.charva-travel.com/ru',
    );
    expect(document.querySelectorAll('meta[property="og:image"]')).toHaveLength(1);
  });

  it('leaves other links alone', () => {
    applyDocumentHead(head('/ru'));

    expect(document.head.querySelectorAll('link[rel="modulepreload"]')).toHaveLength(1);
  });
});
