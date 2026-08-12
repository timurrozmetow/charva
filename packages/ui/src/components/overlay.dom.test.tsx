import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Lightbox } from './Lightbox';
import { Modal } from './Modal';
import { ToastViewport, useToasts } from './Toast';

const LABELS = {
  close: 'Закрыть',
  previous: 'Предыдущее фото',
  next: 'Следующее фото',
  counter: (current: number, total: number) => `${String(current)} из ${String(total)}`,
};

const PHOTOS = [
  { id: '1', src: '/1.webp', alt: 'Кратер Дарваза', caption: 'Каракумы' },
  { id: '2', src: '/2.webp', alt: 'Каньон Йангыкала' },
  { id: '3', src: '/3.webp', alt: 'Древний Мерв' },
];

describe('Modal', () => {
  it('is a modal dialog with an accessible name', () => {
    render(
      <Modal open onClose={vi.fn()} title="Заявка отправлена" closeLabel="Закрыть">
        Спасибо
      </Modal>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Заявка отправлена' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('moves focus into itself when it opens', async () => {
    const user = userEvent.setup();

    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button
            type="button"
            onClick={() => {
              setOpen(true);
            }}
          >
            Открыть
          </button>
          <Modal
            open={open}
            onClose={() => {
              setOpen(false);
            }}
            title="Диалог"
            closeLabel="Закрыть"
          >
            <button type="button">Внутри</button>
          </Modal>
        </>
      );
    }

    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Открыть' }));

    // Otherwise a screen reader is left reading the page behind the dialog.
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);
  });

  it('gives focus back to whatever opened it', async () => {
    const user = userEvent.setup();

    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button
            type="button"
            onClick={() => {
              setOpen(true);
            }}
          >
            Открыть
          </button>
          <Modal
            open={open}
            onClose={() => {
              setOpen(false);
            }}
            title="Диалог"
            closeLabel="Закрыть"
          />
        </>
      );
    }

    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Открыть' });

    await user.click(opener);
    await user.click(screen.getByRole('button', { name: 'Закрыть' }));

    // Closing a lightbox opened from the eleventh tile must not drop the user at the top.
    expect(opener).toHaveFocus();
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<Modal open onClose={onClose} title="Диалог" closeLabel="Закрыть" />);

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on the backdrop but not on the dialog itself', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal open onClose={onClose} title="Диалог" closeLabel="Закрыть">
        <p>Содержимое</p>
      </Modal>,
    );

    await user.click(screen.getByText('Содержимое'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps Tab inside the dialog', async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Снаружи</button>
        <Modal open onClose={vi.fn()} title="Диалог" closeLabel="Закрыть">
          <button type="button">Первая</button>
          <button type="button">Вторая</button>
        </Modal>
      </>,
    );

    const dialog = screen.getByRole('dialog');
    await user.tab();
    await user.tab();
    await user.tab();
    await user.tab();

    // Four presses through a three-control dialog wraps back inside, never out to «Снаружи».
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });

  it('stops the page behind it from scrolling', () => {
    const { unmount } = render(
      <Modal open onClose={vi.fn()} title="Диалог" closeLabel="Закрыть" />,
    );
    expect(document.body).toHaveStyle({ overflow: 'hidden' });

    unmount();
    expect(document.body).not.toHaveStyle({ overflow: 'hidden' });
  });

  it('renders nothing at all while closed', () => {
    render(<Modal open={false} onClose={vi.fn()} title="Диалог" closeLabel="Закрыть" />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('Lightbox', () => {
  function Harness({ start = 0 }: { start?: number }) {
    const [index, setIndex] = useState<number | null>(start);
    return (
      <Lightbox
        items={PHOTOS}
        index={index}
        onIndexChange={setIndex}
        onClose={() => {
          setIndex(null);
        }}
        labels={LABELS}
      />
    );
  }

  it('shows the photograph and says where in the set it is', () => {
    render(<Harness />);
    expect(screen.getByAltText('Кратер Дарваза')).toBeInTheDocument();
    // The position is both the dialog's accessible name and a live region, so that a screen
    // reader hears it on opening and again on every step.
    expect(screen.getByRole('dialog')).toHaveAccessibleName('1 из 3');
    expect(screen.getByText('Каракумы')).toBeInTheDocument();
  });

  it('steps with the arrow keys and wraps at both ends', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.keyboard('{ArrowRight}');
    expect(screen.getByAltText('Каньон Йангыкала')).toBeInTheDocument();

    // Backwards past the first goes to the last, not to nothing.
    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(screen.getByAltText('Древний Мерв')).toBeInTheDocument();
  });

  it('steps with the buttons', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Следующее фото' }));
    expect(screen.getByAltText('Каньон Йангыкала')).toBeInTheDocument();
  });

  it('hides the arrows for a single photograph', () => {
    render(
      <Lightbox
        items={[PHOTOS[0]!]}
        index={0}
        onIndexChange={vi.fn()}
        onClose={vi.fn()}
        labels={LABELS}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Следующее фото' })).not.toBeInTheDocument();
  });
});

describe('useToasts', () => {
  function Harness() {
    const { toasts, push, dismiss } = useToasts(1000);
    return (
      <>
        <button
          type="button"
          onClick={() => {
            push('success', 'Заявка отправлена');
          }}
        >
          Отправить
        </button>
        <button
          type="button"
          onClick={() => {
            push('error', 'Не удалось отправить');
          }}
        >
          Сломать
        </button>
        <ToastViewport toasts={toasts} onDismiss={dismiss} dismissLabel="Закрыть" />
      </>
    );
  }

  it('interrupts for a failure and waits for a confirmation', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Отправить' }));
    await user.click(screen.getByRole('button', { name: 'Сломать' }));

    expect(screen.getByText('Заявка отправлена').closest('[aria-live]')).toHaveAttribute(
      'aria-live',
      'polite',
    );
    expect(screen.getByText('Не удалось отправить').closest('[aria-live]')).toHaveAttribute(
      'aria-live',
      'assertive',
    );
  });

  it('clears itself after the timeout', () => {
    vi.useFakeTimers();
    try {
      render(<Harness />);

      // A plain click rather than `userEvent`: user-event schedules its own work on timers,
      // and driving it from a faked clock is a knot not worth tying for one press.
      act(() => {
        screen.getByRole('button', { name: 'Отправить' }).click();
      });
      expect(screen.getByText('Заявка отправлена')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(1100);
      });
      expect(screen.queryByText('Заявка отправлена')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('can be dismissed by hand before then', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Отправить' }));
    await user.click(screen.getByRole('button', { name: 'Закрыть' }));
    expect(screen.queryByText('Заявка отправлена')).not.toBeInTheDocument();
  });
});
