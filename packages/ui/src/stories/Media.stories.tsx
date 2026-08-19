import { type Meta, type StoryObj } from '@storybook/react';

import { Carousel } from '../components/Carousel';
import { Heading } from '../components/Heading';
import { ImageSlot } from '../components/ImageSlot';
import { MosaicGrid } from '../components/MosaicGrid';

const meta: Meta = { title: 'Media/Photographs' };
export default meta;
type Story = StoryObj;

const SLOTS = [
  { key: 'g-hero-1', brief: 'Газовый кратер Дарваза ночью — широкий кадр 21:9', span: 2 },
  { key: 'g-tour-1', brief: 'Ашхабад, белый мрамор и подсветка ночью', span: 1 },
  { key: 'g-tour-2', brief: 'Ковровый узор, макро', span: 1 },
  { key: 'g-hero-2', brief: 'Каньон Йангыкала на закате — широкий кадр 21:9', span: 2 },
  { key: 'g-tour-3', brief: 'Древний Мерв, глинобитные стены на рассвете', span: 1 },
  { key: 'g-tour-4', brief: 'Ахалтекинский конь, портрет в профиль', span: 1 },
  { key: 'g-tour-5', brief: 'Юрточный лагерь у Дарвазы, вечер', span: 1 },
];

/**
 * The unfilled state, which is the state the whole project is in.
 *
 * There is not one photograph in the design package — around 151 slots carrying a sentence of
 * Russian art direction each. The branded rectangle keeps every page renderable and every
 * layout real until they arrive, and turns the gap into a checklist. Decision D-21,
 * question Q-1.
 */
export const Slots: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      <ImageSlot
        slotKey="g-hero-1"
        brief={SLOTS[0]?.brief ?? ''}
        showBrief
        recommended={{ width: 2560, height: 1100 }}
        ratio="21/9"
      />
      <div className="grid grid-cols-3 gap-6 mob:grid-cols-1">
        {SLOTS.slice(1, 4).map((slot) => (
          <ImageSlot
            key={slot.key}
            slotKey={slot.key}
            brief={slot.brief}
            showBrief
            ratio="4/3"
            recommended={{ width: 1200, height: 900 }}
          />
        ))}
      </div>
    </div>
  ),
};

/** The same slots without their briefs, which is how a visitor would see them. */
export const SlotsQuiet: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-6 mob:grid-cols-1">
      {SLOTS.slice(1, 4).map((slot) => (
        <ImageSlot key={slot.key} slotKey={slot.key} brief={slot.brief} ratio="4/3" />
      ))}
    </div>
  ),
};

/**
 * The mosaic, packed.
 *
 * Change the number of items and nothing leaves a hole; the prototype's spans are laid out by
 * hand against the unfiltered set of fourteen and fall apart at the first filter.
 */
export const Mosaic: Story = {
  render: () => (
    <MosaicGrid
      items={SLOTS.map((slot) => ({
        id: slot.key,
        spanCols: slot.span,
        spanRows: slot.span,
        content: <ImageSlot slotKey={slot.key} brief={slot.brief} className="h-full" />,
      }))}
    />
  ),
};

/**
 * One carousel for all four sliders.
 *
 * Hover it, tab into it, or press the stop button: all three pause it. Turn on
 * `prefers-reduced-motion` and it does not move at all.
 */
export const HeroSlider: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => (
    <div className="-m-10">
      <Carousel
        className="h-[560px]"
        intervalMs={4000}
        labels={{
          region: 'Слайдер главной страницы',
          slide: (index, total) => `Слайд ${String(index)} из ${String(total)}`,
          goTo: (index, label) =>
            `Перейти к слайду ${String(index)}${label === undefined ? '' : `, ${label}`}`,
          pause: 'Остановить показ',
          play: 'Продолжить показ',
        }}
        slides={[
          { id: 'darvaza', label: 'Дарваза', brief: SLOTS[0]?.brief },
          { id: 'yangykala', label: 'Йангыкала', brief: SLOTS[3]?.brief },
          { id: 'merv', label: 'Мерв', brief: SLOTS[4]?.brief },
        ].map((slide) => ({
          id: slide.id,
          label: slide.label,
          content: (
            <div data-surface="dark" className="relative h-full">
              <ImageSlot slotKey={slide.id} brief={slide.brief ?? ''} className="h-full" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-scrim-strong to-transparent p-12">
                {/* No `text-dark-on`: the wrapper above is already a dark surface, and the
                    class would only have joined the heading's own `text-ink` and lost to it. */}
                <Heading level={2} size="hero" className="max-w-[900px]">
                  {slide.label}
                </Heading>
              </div>
            </div>
          ),
        }))}
      />
    </div>
  ),
};
