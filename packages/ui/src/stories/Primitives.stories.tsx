import { type Meta, type StoryObj } from '@storybook/react';

import { Button, ButtonLink } from '../components/Button';
import { Divider } from '../components/Divider';
import { Eyebrow } from '../components/Eyebrow';
import { Heading } from '../components/Heading';
import { Icon, type IconName } from '../components/Icon';
import { LinkArrow } from '../components/LinkArrow';
import { Section } from '../components/Section';
import { SectionHead } from '../components/SectionHead';

const meta: Meta = { title: 'Primitives/Layout and text' };
export default meta;
type Story = StoryObj;

/**
 * The arrangement that opens seventeen sections across the two sites.
 *
 * Switch the surface to dark in the toolbar: the eyebrow's sand becomes the bright one, the
 * heading becomes cream and the rule flips to light, all without a prop.
 */
export const SectionHeader: Story = {
  render: () => (
    <SectionHead
      eyebrow="Популярные туры"
      title="Маршруты, которые выбирают чаще всего"
      action={<LinkArrow href="/ru/tours">Все туры — 9</LinkArrow>}
    />
  ),
};

export const Headings: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <Heading level={1} size="hero">
        Земля пустынь, ковров и ахалтекинских коней
      </Heading>
      <Heading level={2} size="h2Lg">
        Маршруты, которые выбирают чаще всего
      </Heading>
      <Heading level={3} size="h3">
        Что входит в пакет
      </Heading>
      <Heading level={3} size="card">
        Юрточный лагерь у Дарвазы
      </Heading>
    </div>
  ),
};

export const Rules: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <Eyebrow>Надзаголовок секции</Eyebrow>
      <Divider />
      <div className="flex h-8 items-center gap-4">
        <span className="text-bodySm text-body">Логотип</span>
        <Divider orientation="vertical" className="h-[26px]" />
        <span className="text-bodySm text-body">Меню</span>
      </div>
      <div className="flex gap-8">
        <LinkArrow href="/ru/hotels">Все отели — 9</LinkArrow>
        <LinkArrow href="/ru/tours/classic" variant="plain">
          Подробнее
        </LinkArrow>
      </div>
    </div>
  ),
};

/** Both painted tones, so the surface layer can be seen doing its work in one frame. */
export const Sections: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => (
    <div className="-m-10">
      <Section tone="page" space="sm">
        <SectionHead eyebrow="Светлая секция" title="Фон страницы" size="h2Sm" />
        <p className="m-0 max-w-[560px] text-body font-light text-body">
          Основной текст, приглушённая подпись и ссылка ниже.
        </p>
        <p className="m-0 mt-2 text-bodySm text-muted">Подпись, meta, дата.</p>
      </Section>

      <Section tone="dark" space="sm">
        <SectionHead eyebrow="Тёмная секция" title="Тот же код" size="h2Sm" />
        <p className="m-0 max-w-[560px] text-body font-light text-body">
          Ни один компонент не знает, что находится на тёмном фоне.
        </p>
        <p className="m-0 mt-2 text-bodySm text-muted">Подпись, meta, дата.</p>
      </Section>

      <Section tone="darkest" space="sm">
        <SectionHead eyebrow="Футер" title="Самая тёмная поверхность" size="h2Sm" />
      </Section>
    </div>
  ),
};

const ICONS: IconName[] = [
  'star',
  'starHalf',
  'check',
  'diamond',
  'caretDown',
  'play',
  'pause',
  'globe',
];

/**
 * The hand-drawn set.
 *
 * Every one of these replaces a literal character the prototypes typed into the markup —
 * `★ ☆ ✓ ✦ ▾ ▶` — none of which exists in Stolzl. Decision D-26.
 */
export const Icons: Story = {
  render: () => (
    <div className="flex flex-wrap gap-8">
      {ICONS.map((name) => (
        <span key={name} className="flex flex-col items-center gap-2">
          <Icon name={name} size={28} className="text-accent-text" />
          <span className="font-bold uppercase text-label text-muted">{name}</span>
        </span>
      ))}
    </div>
  ),
};

export const Buttons: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-4">
        <Button variant="solid" size="lg" arrow>
          Подобрать тур
        </Button>
        <Button variant="dark" size="md">
          Оставить заявку
        </Button>
        <Button variant="outline" size="md">
          Показать ещё
        </Button>
        <Button variant="ghost" size="md">
          Сбросить
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Button size="sm">Онлайн-заявка</Button>
        <Button size="md">Средняя</Button>
        <Button size="lg">Крупная</Button>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Button disabled>Недоступна</Button>
        <Button busy busyLabel="Отправляется">
          Отправить заявку
        </Button>
        <ButtonLink href="tel:+99312456789" variant="outline">
          +993 12 456 789
        </ButtonLink>
      </div>

      <Button fullWidth size="lg">
        Во всю ширину колонки
      </Button>
    </div>
  ),
};
