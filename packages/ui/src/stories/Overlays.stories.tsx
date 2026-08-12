import { type Meta, type StoryObj } from '@storybook/react';
import { useState } from 'react';

import { Button } from '../components/Button';
import { Lightbox } from '../components/Lightbox';
import { Modal } from '../components/Modal';
import { MosaicGrid } from '../components/MosaicGrid';
import { ToastViewport, useToasts } from '../components/Toast';

const meta: Meta = { title: 'Overlays/Dialogs' };
export default meta;
type Story = StoryObj;

/**
 * A one-pixel transparent GIF, so the stories have something to show without shipping a
 * photograph into the repository. The real slots are filled from `content_slots`.
 */
const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';

const PHOTOS = [
  { id: '1', src: PIXEL, alt: 'Кратер Дарваза, Каракумы', caption: 'Кратер Дарваза, Каракумы' },
  { id: '2', src: PIXEL, alt: 'Каньон Йангыкала на закате', caption: 'Каньон Йангыкала' },
  { id: '3', src: PIXEL, alt: 'Древний Мерв', caption: 'Древний Мерв' },
];

export const Dialog: Story = {
  render: function DialogStory() {
    const [open, setOpen] = useState(false);

    return (
      <>
        <Button
          onClick={() => {
            setOpen(true);
          }}
        >
          Открыть диалог
        </Button>
        <Modal
          open={open}
          onClose={() => {
            setOpen(false);
          }}
          title="Заявка отправлена"
          closeLabel="Закрыть"
        >
          <div className="flex flex-col gap-5 px-11 pb-10 pt-6">
            <p className="m-0 text-body font-light text-body">
              Менеджер перезвонит в течение пятнадцати минут по номеру, который вы указали.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false);
              }}
            >
              Понятно
            </Button>
          </div>
        </Modal>
      </>
    );
  },
};

/**
 * Every gallery tile in the handoff is an `<a href="#">`, on both sites. Clicking a
 * photograph does nothing at all; this is the whole of that interaction.
 */
export const PhotoViewer: Story = {
  render: function PhotoViewerStory() {
    const [index, setIndex] = useState<number | null>(null);

    return (
      <>
        <MosaicGrid
          items={PHOTOS.map((photo, position) => ({
            id: photo.id,
            spanCols: position === 0 ? 2 : 1,
            spanRows: position === 0 ? 2 : 1,
            content: (
              <button
                type="button"
                onClick={() => {
                  setIndex(position);
                }}
                className="h-full w-full bg-tint-soft transition-opacity duration-colour hover:opacity-80"
              >
                <span className="sr-only">Открыть: {photo.alt}</span>
              </button>
            ),
          }))}
        />

        <Lightbox
          items={PHOTOS}
          index={index}
          onIndexChange={setIndex}
          onClose={() => {
            setIndex(null);
          }}
          labels={{
            close: 'Закрыть',
            previous: 'Предыдущее фото',
            next: 'Следующее фото',
            counter: (current, total) => `${String(current)} из ${String(total)}`,
          }}
        />
      </>
    );
  },
};

export const Toasts: Story = {
  render: function ToastsStory() {
    const { toasts, push, dismiss } = useToasts();

    return (
      <>
        <div className="flex gap-4">
          <Button
            onClick={() => {
              push('success', 'Заявка отправлена');
            }}
          >
            Успех
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              push('error', 'Не удалось отправить заявку');
            }}
          >
            Ошибка
          </Button>
        </div>
        <ToastViewport toasts={toasts} onDismiss={dismiss} dismissLabel="Закрыть" />
      </>
    );
  },
};
