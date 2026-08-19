import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Badge } from './Badge';
import { Chip } from './Chip';
import { FilterChipRow } from './FilterChipRow';
import { ProgressBar } from './ProgressBar';
import { StatStrip } from './StatStrip';

describe('ProgressBar', () => {
  it('computes its width from the numbers instead of a literal', () => {
    // The prototype writes `width: 73%` beside a caption reading `33 / 45`, which is 73.33%.
    // The bar and the number under it disagree, and the bar never moves.
    render(<ProgressBar value={33} max={45} label="Набор группы" />);
    const bar = screen.getByRole('progressbar');
    expect(bar.firstElementChild).toHaveStyle({ width: '73.33%' });
  });

  it('reports places rather than a percentage', () => {
    render(<ProgressBar value={33} max={45} label="Набор группы" valueText="33 из 45 мест" />);
    const bar = screen.getByRole('progressbar', { name: 'Набор группы' });
    expect(bar).toHaveAttribute('aria-valuenow', '33');
    expect(bar).toHaveAttribute('aria-valuemax', '45');
    expect(bar).toHaveAttribute('aria-valuetext', '33 из 45 мест');
  });

  it('survives a full group and a bad one', () => {
    const { rerender } = render(<ProgressBar value={60} max={45} label="Набор" />);
    expect(screen.getByRole('progressbar').firstElementChild).toHaveStyle({ width: '100.00%' });

    // `seats_total` of zero should not divide by zero and should not render a NaN width.
    rerender(<ProgressBar value={0} max={0} label="Набор" />);
    expect(screen.getByRole('progressbar').firstElementChild).toHaveStyle({ width: '0.00%' });
  });
});

describe('Chip', () => {
  it('is a button that says whether it is on', async () => {
    // Every filter and tab in the handoff is a `<div onClick>`: no keyboard, nothing announced,
    // and no way at all to tell which one is selected.
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Chip active onClick={onClick}>
        Пустыня
      </Chip>,
    );

    const chip = screen.getByRole('button', { name: /Пустыня/ });
    expect(chip).toHaveAttribute('aria-pressed', 'true');

    await user.tab();
    await user.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalled();
  });

  it('does not submit the form it sits in', () => {
    // The contact form's topic chips live inside the `<form>`; a bare <button> would submit it.
    render(<Chip>Свой маршрут</Chip>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });
});

describe('FilterChipRow', () => {
  const OPTIONS = [
    { value: 'all', label: 'Все', count: 9 },
    { value: 'desert', label: 'Пустыня', count: 3 },
    { value: 'jidda', label: 'Джидда', count: 1 },
  ];

  it('names the group and marks exactly one chip pressed', () => {
    render(
      <FilterChipRow
        label="Фильтр по теме"
        options={OPTIONS}
        value="desert"
        onValueChange={vi.fn()}
      />,
    );

    const group = screen.getByRole('group', { name: 'Фильтр по теме' });
    const pressed = within(group)
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-pressed') === 'true');
    expect(pressed).toHaveLength(1);
    expect(pressed[0]).toHaveAccessibleName(/Пустыня/);
  });

  it('reports the code, never the label', async () => {
    // The label is translated; the code is what the query is keyed by.
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    render(
      <FilterChipRow label="Фильтр" options={OPTIONS} value="all" onValueChange={onValueChange} />,
    );

    await user.click(screen.getByRole('button', { name: /Джидда/ }));
    expect(onValueChange).toHaveBeenCalledWith('jidda');
  });

  it('announces the count politely rather than interrupting', () => {
    render(
      <FilterChipRow
        label="Фильтр"
        options={OPTIONS}
        value="all"
        onValueChange={vi.fn()}
        counter="Показано 9 из 9"
      />,
    );
    expect(screen.getByText('Показано 9 из 9')).toHaveAttribute('aria-live', 'polite');
  });
});

describe('StatStrip', () => {
  it('pairs each number with its label rather than leaving eight loose fragments', () => {
    render(
      <StatStrip
        items={[
          { value: '68', label: 'групп' },
          { value: '2 840', label: 'паломников' },
        ]}
      />,
    );

    const terms = screen.getAllByRole('term');
    const definitions = screen.getAllByRole('definition');
    expect(terms).toHaveLength(2);
    expect(definitions[0]).toHaveTextContent('68');
    expect(terms[0]).toHaveTextContent('групп');
  });

  it('takes as many columns as it has numbers', () => {
    /*
     * It was four whatever it held. Three of the five strips carry three numbers, so a quarter
     * of the width stood empty while «СРЕДНЯЯ ОЦЕНКА» wrapped onto two lines in the narrowed
     * column beside it.
     */
    const strip = (count: number) =>
      render(
        <StatStrip
          items={Array.from({ length: count }, (_, index) => ({
            value: String(index),
            label: `метрика ${String(index)}`,
          }))}
        />,
      ).container.firstElementChild;

    expect(strip(3)).toHaveClass('grid-cols-3');
    expect(strip(3)).not.toHaveClass('grid-cols-4');
    expect(strip(4)).toHaveClass('grid-cols-4');
    expect(strip(2)).toHaveClass('grid-cols-2');
  });
});

describe('Badge', () => {
  it('hides the live dot from assistive technology', () => {
    // It carries no information the text does not already have.
    const { container } = render(<Badge live>Boş ýer: 12</Badge>);
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
    expect(screen.getByText('Boş ýer: 12')).toBeInTheDocument();
  });
});
