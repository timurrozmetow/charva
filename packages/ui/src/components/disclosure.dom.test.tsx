import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Accordion } from './Accordion';
import { EmptyState } from './EmptyState';
import { LoadMore } from './LoadMore';
import { Skeleton } from './Skeleton';
import { TabPanel, Tabs } from './Tabs';

const FAQ = [
  { id: 'visa', question: 'Нужна ли виза?', answer: 'Да, оформляем приглашение.' },
  { id: 'pay', question: 'Как оплатить?', answer: 'Наличными или переводом.' },
  { id: 'kids', question: 'Можно с детьми?', answer: 'Да, до 12 лет со скидкой.' },
];

describe('Accordion', () => {
  it('hides the answers until asked, instead of leaving all six in the page', async () => {
    // The prototype keeps every answer in the DOM and only recolours a border, so a screen
    // reader reads the whole FAQ straight through as though the accordion were not there.
    const user = userEvent.setup();
    render(<Accordion items={FAQ} />);

    expect(screen.queryByText('Да, оформляем приглашение.')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Нужна ли виза?' }));
    expect(screen.getByText('Да, оформляем приглашение.')).toBeInTheDocument();
  });

  it('says whether a row is open', async () => {
    const user = userEvent.setup();
    render(<Accordion items={FAQ} />);

    const trigger = screen.getByRole('button', { name: 'Как оплатить?' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('region', { name: 'Как оплатить?' })).toBeInTheDocument();
  });

  it('closes the previous row when only one may be open', async () => {
    const user = userEvent.setup();
    render(<Accordion items={FAQ} defaultOpen={['visa']} />);

    await user.click(screen.getByRole('button', { name: 'Как оплатить?' }));
    expect(screen.getByRole('button', { name: 'Нужна ли виза?' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('keeps several open when told to', async () => {
    const user = userEvent.setup();
    render(<Accordion items={FAQ} multiple defaultOpen={['visa']} />);

    await user.click(screen.getByRole('button', { name: 'Как оплатить?' }));
    expect(screen.getAllByRole('region')).toHaveLength(2);
  });

  it('closes a row that is pressed again', async () => {
    const user = userEvent.setup();
    render(<Accordion items={FAQ} defaultOpen={['visa']} />);

    await user.click(screen.getByRole('button', { name: 'Нужна ли виза?' }));
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('puts the questions in the document outline', () => {
    render(<Accordion items={FAQ} headingLevel={2} />);
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(3);
  });
});

const GROUPS = [
  { value: 'sep-2025', label: 'Сентябрь 2025', count: 38 },
  { value: 'may-2025', label: 'Май 2025', count: 24 },
  { value: 'feb-2025', label: 'Февраль 2025', count: 12 },
];

function TabsHarness() {
  const [value, setValue] = useState('sep-2025');
  return (
    <Tabs items={GROUPS} value={value} onValueChange={setValue} label="Группы паломников">
      {GROUPS.map((group) => (
        <TabPanel key={group.value} value={group.value}>
          Фото группы {group.label}
        </TabPanel>
      ))}
    </Tabs>
  );
}

describe('Tabs', () => {
  it('is a named tab list with one selected tab and one panel', () => {
    render(<TabsHarness />);

    const list = screen.getByRole('tablist', { name: 'Группы паломников' });
    expect(within(list).getAllByRole('tab')).toHaveLength(3);
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Сентябрь 2025 38');
  });

  it('moves with the arrow keys and wraps at the ends', async () => {
    const user = userEvent.setup();
    render(<TabsHarness />);

    await user.tab();
    expect(screen.getByRole('tab', { name: /Сентябрь/ })).toHaveFocus();

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: /Май/ })).toHaveFocus();
    expect(screen.getByRole('tab', { name: /Май/ })).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(screen.getByRole('tab', { name: /Февраль/ })).toHaveFocus();
  });

  it('jumps to the ends with Home and End', async () => {
    const user = userEvent.setup();
    render(<TabsHarness />);

    await user.tab();
    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: /Февраль/ })).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: /Сентябрь/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('keeps only the selected tab in the tab order', async () => {
    // Otherwise Tab walks through sixty-eight groups before reaching the photographs.
    const user = userEvent.setup();
    render(<TabsHarness />);

    await user.tab();
    await user.tab();
    expect(screen.getByRole('tabpanel')).toHaveFocus();
  });
});

describe('LoadMore', () => {
  it('disappears once everything is on screen but keeps announcing the count', () => {
    // The new tiles appear below the fold, so the press otherwise gives no feedback at all.
    const { rerender } = render(
      <LoadMore onLoadMore={vi.fn()} hasMore status="Показано 16 из 248">
        Показать ещё
      </LoadMore>,
    );
    expect(screen.getByRole('button', { name: 'Показать ещё' })).toBeInTheDocument();

    rerender(
      <LoadMore onLoadMore={vi.fn()} hasMore={false} status="Показано 248 из 248">
        Показать ещё
      </LoadMore>,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('Показано 248 из 248')).toBeInTheDocument();
  });

  it('cannot be pressed twice while the page is loading', async () => {
    const onLoadMore = vi.fn();
    const user = userEvent.setup();
    render(
      <LoadMore onLoadMore={onLoadMore} hasMore busy busyLabel="Загружается">
        Показать ещё
      </LoadMore>,
    );

    await user.click(screen.getByRole('button'));
    expect(onLoadMore).not.toHaveBeenCalled();
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
  });
});

describe('EmptyState and Skeleton', () => {
  it('tells the user that the filter matched nothing', () => {
    render(<EmptyState title="Ничего не найдено" description="Попробуйте другой фильтр" />);
    expect(screen.getByRole('status')).toHaveTextContent('Ничего не найдено');
  });

  it('keeps loading placeholders out of the accessibility tree', () => {
    // "Loading, loading, loading" once per placeholder card is worse than silence.
    const { container } = render(<Skeleton count={3} className="h-40" />);
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(3);
  });
});
