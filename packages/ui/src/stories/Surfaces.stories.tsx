import { type Meta, type StoryObj } from '@storybook/react';
import { useState } from 'react';

import { Accordion } from '../components/Accordion';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { Heading } from '../components/Heading';
import { LoadMore } from '../components/LoadMore';
import { Skeleton } from '../components/Skeleton';
import { TabPanel, Tabs } from '../components/Tabs';

const meta: Meta = { title: 'Surfaces/Cards and disclosure' };
export default meta;
type Story = StoryObj;

export const Cards: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-6 tab:grid-cols-2 mob:grid-cols-1">
      <Card interactive padding="sm">
        <Heading level={3} size="card">
          Классика Туркменистана
        </Heading>
        <p className="m-0 mt-3 text-bodySm font-light text-body">
          Ашхабад, Мерв, Куняургенч — 8 дней, 4 города.
        </p>
        <p className="m-0 mt-4 text-bodySm text-muted">от 980 $</p>
      </Card>

      <Card padding="sm">
        <Heading level={3} size="card">
          Без наведения
        </Heading>
        <p className="m-0 mt-3 text-bodySm font-light text-body">
          Карточка, которая никуда не ведёт, не поднимается под курсором.
        </p>
      </Card>

      <Card padding="lg" className="col-span-2 mob:col-span-1">
        <Heading level={3} size="h3">
          Крупный CTA-блок
        </Heading>
        <p className="m-0 mt-4 max-w-[420px] text-body font-light text-body">
          Радиус, тень и подъём приходят из темы: 22px и −6px на Global, 24px и −5px на Umrah.
        </p>
      </Card>
    </div>
  ),
};

const FAQ = [
  {
    id: 'visa',
    question: 'Нужна ли виза в Туркменистан?',
    answer: 'Да. Мы оформляем приглашение — это занимает от десяти рабочих дней.',
  },
  {
    id: 'pay',
    question: 'Как происходит оплата?',
    answer: 'Предоплата 30% при подтверждении, остаток — по приезде.',
  },
  {
    id: 'kids',
    question: 'Можно ли с детьми?',
    answer: 'Да. Дети до 12 лет — со скидкой, до 4 лет — бесплатно.',
  },
];

/**
 * The prototype keeps every answer in the DOM and only recolours a border, so a screen reader
 * reads the whole FAQ straight through as though the accordion were not there.
 */
export const FrequentlyAsked: Story = {
  render: () => <Accordion items={FAQ} defaultOpen={['visa']} />,
};

export const Programme: Story = {
  render: () => (
    <Accordion
      multiple
      headingLevel={3}
      items={Array.from({ length: 4 }, (_, index) => ({
        id: `day-${String(index + 1)}`,
        question: `${String(index + 1)}-nji gün · Mekge`,
        answer: 'Umra ybadaty, tawaf we saý, soňra dynç alyş.',
      }))}
    />
  ),
};

const GROUPS = [
  { value: 'sep-2025', label: 'Sentýabr 2025', count: 38 },
  { value: 'may-2025', label: 'Maý 2025', count: 24 },
  { value: 'feb-2025', label: 'Fewral 2025', count: 12 },
];

export const GroupTabs: Story = {
  render: function GroupTabsStory() {
    const [value, setValue] = useState('sep-2025');

    return (
      <Tabs items={GROUPS} value={value} onValueChange={setValue} label="Toparlar">
        {GROUPS.map((group) => (
          <TabPanel key={group.value} value={group.value} className="mt-8">
            <div className="grid grid-cols-4 gap-4 mob:grid-cols-2">
              <Skeleton count={4} className="h-40" />
            </div>
            <p className="mt-4 text-bodySm text-muted">
              {group.label}: {group.count} фотографий
            </p>
          </TabPanel>
        ))}
      </Tabs>
    );
  },
};

/** The three states the prototypes cannot reach, because their data is nine hardcoded rows. */
export const States: Story = {
  render: function StatesStory() {
    const [shown, setShown] = useState(4);

    return (
      <div className="flex flex-col gap-12">
        <div>
          <p className="mb-4 font-bold uppercase text-label text-muted">Загрузка</p>
          <div className="grid grid-cols-3 gap-6 mob:grid-cols-1">
            <Skeleton count={3} className="h-52" />
          </div>
        </div>

        <div>
          <p className="mb-4 font-bold uppercase text-label text-muted">Ничего не найдено</p>
          <EmptyState
            title="По этому фильтру пока ничего нет"
            description="Попробуйте другую тему или посмотрите все маршруты."
            action={<Button variant="outline">Показать все</Button>}
          />
        </div>

        <div>
          <p className="mb-4 font-bold uppercase text-label text-muted">Показать ещё</p>
          <LoadMore
            hasMore={shown < 9}
            status={`Показано ${String(shown)} из 9`}
            onLoadMore={() => {
              setShown((current) => Math.min(9, current + 4));
            }}
          >
            Показать ещё
          </LoadMore>
        </div>
      </div>
    );
  },
};
