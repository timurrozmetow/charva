import { type Meta, type StoryObj } from '@storybook/react';
import { useState } from 'react';

import { Badge } from '../components/Badge';
import { CountdownTimer } from '../components/CountdownTimer';
import { FilterChipRow } from '../components/FilterChipRow';
import { ProgressBar } from '../components/ProgressBar';
import { StarRating } from '../components/StarRating';
import { StatStrip } from '../components/StatStrip';

const meta: Meta = { title: 'Indicators/Status' };
export default meta;
type Story = StoryObj;

const CATEGORIES = [
  { value: 'all', label: 'Все', count: 9 },
  { value: 'classic', label: 'Классика', count: 3 },
  { value: 'nature', label: 'Природа', count: 2 },
  { value: 'history', label: 'История', count: 2 },
  { value: 'culture', label: 'Культура', count: 2 },
];

export const Filters: Story = {
  render: function FiltersStory() {
    const [value, setValue] = useState('all');
    const count = CATEGORIES.find((item) => item.value === value)?.count ?? 0;

    return (
      <div className="flex flex-col gap-10">
        <FilterChipRow
          label="Фильтр по теме"
          options={CATEGORIES}
          value={value}
          onValueChange={setValue}
          counter={`Показано ${String(count)} из 9`}
        />
        <FilterChipRow
          label="Интересует"
          variant="tint"
          options={CATEGORIES}
          value={value}
          onValueChange={setValue}
        />
      </div>
    );
  },
};

export const Badges: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Badge live>Boş ýer: 12 · 38 gün galdy</Badge>
      <Badge>Набор открыт</Badge>
      <Badge variant="scrim">14:20</Badge>
      <Badge variant="scrim">Ашхабад</Badge>
    </div>
  ),
};

/**
 * The seats bar, computed.
 *
 * The prototype writes `width: 73%` beside a caption reading `33 / 45`, which is 73.33%: the
 * bar and the number under it already disagree, and the bar never moves whatever the trip sells.
 */
export const Seats: Story = {
  render: () => (
    <div className="flex max-w-[520px] flex-col gap-8">
      {[
        [33, 45],
        [45, 45],
        [4, 45],
      ].map(([taken, total]) => (
        <div key={taken} className="flex flex-col gap-3">
          <div className="flex justify-between text-bodySm font-bold text-ink">
            <span>Набор группы</span>
            <span>
              {taken} / {total} adam
            </span>
          </div>
          <ProgressBar
            value={taken ?? 0}
            max={total ?? 1}
            label="Набор группы"
            valueText={`${String(taken)} из ${String(total)} мест`}
          />
        </div>
      ))}
    </div>
  ),
};

export const Statistics: Story = {
  render: () => (
    <StatStrip
      items={[
        { value: '9', label: 'групп' },
        { value: '312', label: 'паломников' },
        { value: '4,8', label: 'оценка' },
        { value: '92%', label: 'советуют' },
      ]}
    />
  ),
};

export const Ratings: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      {[5, 4.5, 4, 3.5, 0].map((value) => (
        <div key={value} className="flex items-center gap-4">
          <StarRating value={value} size={18} label={`${String(value)} из 5`} />
          <span className="text-bodySm text-muted">{value}</span>
        </div>
      ))}
    </div>
  ),
};

/**
 * One clock for both sites.
 *
 * Choice and the Umrah homepage disagree by a day in the prototypes because one rounds up and
 * the other down; the signup badge does not tick at all.
 */
export const Countdown: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => (
    <div data-surface="dark" className="-m-10 bg-dark-alt p-10 [--c-bg:var(--c-dark-alt)]">
      <CountdownTimer
        target={new Date(Date.now() + 38 * 24 * 3600 * 1000 + 4 * 3600 * 1000).toISOString()}
        labels={{
          days: 'gün',
          hours: 'sagat',
          minutes: 'minut',
          seconds: 'sekunt',
          announce: (days, hours) => `Ugramaga ${String(days)} gün ${String(hours)} sagat galdy`,
        }}
        passed={<p className="m-0 text-lead text-dark-on">Topar ýolda</p>}
      />
    </div>
  ),
};
