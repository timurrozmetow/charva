import { type Meta, type StoryObj } from '@storybook/react';

import { contrastRatio, requiredRatio } from '../color';
import { CONTRAST_CORRECTIONS, CONTRAST_PAIRS, type ContrastPair } from '../tokens';

/**
 * The tokens, shown rather than described.
 *
 * The contrast table is the one that matters at review: five colours in the handoff do not
 * clear WCAG AA and were darkened, and this is where that decision is looked at rather than
 * argued about. Question Q-7.
 */
const meta: Meta = {
  title: 'Foundations/Tokens',
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj;

function Swatch({ name, value }: { name: string; value: string }) {
  return (
    <div className="flex items-center gap-4">
      <span
        aria-hidden="true"
        style={{ background: value }}
        className="h-12 w-12 shrink-0 rounded-sm border border-line"
      />
      <span className="flex flex-col">
        <span className="text-bodySm font-medium text-ink">{name}</span>
        <span className="font-bold uppercase text-label text-muted">{value}</span>
      </span>
    </div>
  );
}

/** Every theme role, read from the document exactly as a component reads it. */
export const Roles: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-6 tab:grid-cols-2 mob:grid-cols-1">
      {[
        'bg',
        'surface',
        'field',
        'island',
        'ink',
        'body',
        'muted',
        'nav',
        'accent',
        'accent-hover',
        'accent-text',
        'accent-active',
        'on-accent',
        'dark',
        'dark-alt',
        'on-dark',
        'danger',
      ].map((role) => (
        <Swatch key={role} name={role} value={`var(--c-${role})`} />
      ))}
    </div>
  ),
};

/** The type scale. Switch the theme to see the hero size change with it. */
export const Type: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <p className="m-0 font-medium text-hero text-ink">Hero — 82 / 72 / 64</p>
      <p className="m-0 font-medium text-h1 text-ink">H1 — 63</p>
      <p className="m-0 font-medium text-h2Lg text-ink">H2 large — 50</p>
      <p className="m-0 font-medium text-h2 text-ink">H2 — 44</p>
      <p className="m-0 font-medium text-h3 text-ink">H3 — 33</p>
      <p className="m-0 font-medium text-cardTitle text-ink">Card title — 24</p>
      <p className="m-0 font-light text-lead text-body">Lead — 18/1.65</p>
      <p className="m-0 font-light text-body text-body">Body — 15/1.7</p>
      <p className="m-0 font-bold uppercase text-eyebrow text-accent-text">Eyebrow — 11/700</p>
    </div>
  ),
};

/**
 * Every text colour against every surface it appears on, measured.
 *
 * The same list `tokens.test.ts` walks on each build, rendered so the numbers can be looked at
 * beside the colours they describe.
 */
export const Contrast: Story = {
  render: () => (
    <table className="w-full border-collapse text-bodySm">
      <thead>
        <tr className="border-b border-line text-left">
          <th className="py-3 font-bold uppercase text-label text-muted">Sample</th>
          <th className="py-3 font-bold uppercase text-label text-muted">Pair</th>
          <th className="py-3 font-bold uppercase text-label text-muted">Ratio</th>
          <th className="py-3 font-bold uppercase text-label text-muted">Needs</th>
          <th className="py-3 font-bold uppercase text-label text-muted">Where</th>
        </tr>
      </thead>
      <tbody>
        {CONTRAST_PAIRS.map((pair: ContrastPair, index: number) => {
          const ratio = contrastRatio(pair.fg, pair.bg);
          const need = requiredRatio(pair.size, pair.bold ?? false);
          return (
            <tr key={index} className="border-b border-line">
              <td className="py-3 pr-4">
                <span
                  style={{
                    background: pair.bg,
                    color: pair.fg,
                    fontSize: pair.size,
                    fontWeight: pair.bold === true ? 700 : 400,
                  }}
                  className="inline-block rounded-xs px-3 py-2"
                >
                  Türkmenistan
                </span>
              </td>
              <td className="py-3 pr-4 text-muted">
                {pair.fg} on {pair.bg}
              </td>
              <td className="py-3 pr-4 font-medium text-ink">{ratio.toFixed(2)}</td>
              <td className="py-3 pr-4 text-muted">{need.toFixed(1)}</td>
              <td className="py-3 text-muted">{pair.where}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  ),
};

/** The five colours that were darkened, mockup beside correction. Question Q-7. */
export const Corrections: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      {CONTRAST_CORRECTIONS.map((fix) => (
        <div key={fix.token} className="flex flex-col gap-2 border-b border-line pb-6">
          <p className="m-0 font-bold uppercase text-label text-muted">{fix.token}</p>
          <div className="flex gap-4">
            <span
              style={{ background: fix.on, color: fix.mockup }}
              className="rounded-xs px-4 py-3 text-bodySm"
            >
              {fix.mockup} — {fix.was.toFixed(2)}:1
            </span>
            <span
              style={{ background: fix.on, color: fix.corrected }}
              className="rounded-xs px-4 py-3 text-bodySm"
            >
              {fix.corrected} — {fix.now.toFixed(2)}:1
            </span>
          </div>
          <p className="m-0 text-bodySm font-light text-body">{fix.note}</p>
        </div>
      ))}
    </div>
  ),
};
