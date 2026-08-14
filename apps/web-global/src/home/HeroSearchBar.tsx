import { type BuilderStep, type Lang } from '@charva/contracts';
import { Button, Select } from '@charva/ui';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

import { builderConfigQuery } from '../api/queries';
import { copyFor } from '../i18n';
import { path } from '../lib/routes';

export interface HeroSearchBarProps {
  lang: Lang;
  className?: string;
}

/** The three questions the bar asks, in the order the design draws them. */
const FIELDS = [
  { step: 'dest', label: 'destination' },
  { step: 'dates', label: 'duration' },
  { step: 'people', label: 'guests' },
] as const satisfies readonly { step: BuilderStep; label: 'destination' | 'duration' | 'guests' }[];

/**
 * The search bar over the hero — question Q-9, answered by making it work.
 *
 * In the handoff it is three `<div>`s with hard-coded values («Ашхабад · Дарваза», «14 — 21
 * сентября», «2 гостя») and a button to `#`. There is no results page anywhere in the package
 * and none is planned, so «search» here can only ever have meant one thing: start the builder
 * with these three steps already answered. That is what it does — and the three answers come
 * from the builder's own configuration, so a destination offered here is by construction a
 * destination the builder can price.
 *
 * The dates field asks for a length rather than a range. The prototype's «14 — 21 сентября» is
 * a date range the builder has no step for and the price does not depend on; offering a
 * calendar that changes nothing would be the same lie in a more expensive form. Exact dates are
 * what the manager confirms, and the form asks for them in words.
 */
export function HeroSearchBar({ lang, className }: HeroSearchBarProps) {
  const copy = copyFor(lang);
  const navigate = useNavigate();
  const config = useQuery(builderConfigQuery(lang));
  const [chosen, setChosen] = useState<Partial<Record<string, string>>>({});

  const optionsFor = (step: string) =>
    config.data?.steps.find((candidate) => candidate.code === step)?.options ?? [];

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();

        // Only what was actually chosen: an unanswered step must stay unanswered, or the
        // builder opens showing a selection nobody made.
        const search: Record<string, string> = {};
        for (const field of FIELDS) {
          const value = chosen[field.step];
          if (value !== undefined && value !== '') search[field.step] = value;
        }

        void navigate({ to: path.builder(lang), search });
      }}
      className={className}
    >
      <div className="flex items-stretch gap-px overflow-hidden rounded-[20px] bg-cream-frame backdrop-blur-[14px] mob:flex-col">
        {FIELDS.map((field) => (
          <label key={field.step} className="flex flex-1 flex-col gap-1 bg-surface px-6 py-[18px]">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">
              {copy.home.search[field.label]}
            </span>
            <Select
              value={chosen[field.step] ?? ''}
              onChange={(event) => {
                setChosen((prev) => ({ ...prev, [field.step]: event.target.value }));
              }}
              // Bare inside the bar: the cell is the control's chrome, and a second border
              // inside it is the design's own arrangement.
              className="border-0 bg-transparent px-0 py-0 text-[15px] font-semibold text-ink"
            >
              <option value="">{copy.home.search.any}</option>
              {optionsFor(field.step).map((option) => (
                <option key={option.code} value={option.code}>
                  {option.name}
                </option>
              ))}
            </Select>
          </label>
        ))}

        <Button type="submit" arrow className="rounded-none px-9 mob:rounded-b-[20px]">
          {copy.home.search.submit}
        </Button>
      </div>
    </form>
  );
}
