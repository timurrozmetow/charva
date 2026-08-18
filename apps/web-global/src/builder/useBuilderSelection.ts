import { type BuilderSelection, BUILDER_STEPS, MULTI_STEPS } from '@charva/contracts';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useCallback, useMemo } from 'react';

/**
 * The builder's state, kept in the URL and nowhere else.
 *
 * The stack lists Zustand for this, and the URL turns out to be the better store: a
 * half-assembled tour is exactly the thing somebody sends to the person they are travelling
 * with, and a store in memory cannot be sent. Keeping both would be two sources of truth for
 * one selection, which is the failure this project spends most of its effort avoiding.
 *
 * One parameter per step, values comma-separated — `?dest=dest_ashgabat,dest_darvaza&hotel=…`.
 * Readable, diffable, and short enough to paste into a message.
 *
 * Only option *codes* travel. They are stable ASCII and immutable once referenced (D-10), so a
 * link shared today still prices the same tour after somebody renames «3 ★» in the admin — the
 * prototype keys its rate table by the display string, where a rename silently reprices.
 */

const MULTI = new Set<string>(MULTI_STEPS);

export interface BuilderState {
  selection: BuilderSelection;
  step: number;
  /** Toggles an option. Clicking the chosen one again clears it, as the prototype does. */
  pick: (step: string, code: string, exclusive?: ReadonlySet<string>) => void;
  goToStep: (index: number) => void;
  /** How many priced-or-answered steps have an answer, out of the eight that take one. */
  answered: number;
}

const EMPTY: ReadonlySet<string> = new Set();

export function useBuilderSelection(basePath: string): BuilderState {
  const navigate = useNavigate();
  const search: Record<string, unknown> = useSearch({ strict: false });

  const selection = useMemo(() => {
    const out: Record<string, string | string[]> = {};
    for (const step of BUILDER_STEPS) {
      const raw = search[step];
      if (typeof raw !== 'string' || raw === '') continue;
      const codes = raw.split(',').filter(Boolean);
      const first = codes[0];
      if (first === undefined) continue;
      // A single-choice step keeps only the first code, so a hand-edited URL carrying two
      // answers to one question resolves to one rather than to something unrepresentable.
      out[step] = MULTI.has(step) ? codes : first;
    }
    return out;
  }, [search]);

  const stepRaw = search['step'];
  const step = Math.min(
    BUILDER_STEPS.length - 1,
    Math.max(
      0,
      Number(typeof stepRaw === 'string' || typeof stepRaw === 'number' ? stepRaw : 0) || 0,
    ),
  );

  const write = useCallback(
    (next: Record<string, unknown>) => {
      void navigate({
        to: basePath,
        search: (prev: Record<string, unknown>) => {
          const merged: Record<string, unknown> = { ...prev, ...next };
          // An empty answer and a step of zero are the defaults; neither belongs in a URL that
          // somebody is going to paste somewhere.
          return Object.fromEntries(
            Object.entries(merged).filter(
              ([key, value]) =>
                value !== undefined && value !== '' && !(key === 'step' && value === 0),
            ),
          );
        },
        replace: true,
      });
    },
    [navigate, basePath],
  );

  const pick = useCallback(
    (stepCode: string, code: string, exclusive: ReadonlySet<string> = EMPTY) => {
      const current = selection[stepCode as keyof BuilderSelection];

      if (MULTI.has(stepCode)) {
        const codes = current === undefined ? [] : [...(current as readonly string[])];
        const at = codes.indexOf(code);

        if (at >= 0) {
          codes.splice(at, 1);
        } else if (exclusive.has(code)) {
          /*
           * An exclusive answer replaces the step rather than joining it.
           *
           * «Без питания» is not a sixth kind of food, it is the answer that the question does
           * not apply — and the step used to allow it alongside «Халяль», which asks for halal
           * food and for no food. Which options behave this way is a column in
           * `builder_options`, not a code written here: the vocabulary is edited in the admin.
           */
          codes.length = 0;
          codes.push(code);
        } else {
          // And the reverse. Adding any real answer withdraws the «does not apply».
          for (let index = codes.length - 1; index >= 0; index -= 1) {
            if (exclusive.has(codes[index] ?? '')) codes.splice(index, 1);
          }
          codes.push(code);
        }

        write({ [stepCode]: codes.join(',') });
        return;
      }

      // Clicking the chosen option again clears it — the prototype's behaviour, and the only
      // way to un-answer a single-choice step without a «none» option on every one of them.
      write({ [stepCode]: current === code ? '' : code });
    },
    [selection, write],
  );

  const goToStep = useCallback(
    (index: number) => {
      write({ step: Math.min(BUILDER_STEPS.length - 1, Math.max(0, index)) });
    },
    [write],
  );

  /*
   * Eight, not nine.
   *
   * The last step is the form, and a form is not «answered» by picking something. The prototype
   * makes the same choice and its progress line therefore tops out at «8 из 8» while the rail
   * shows nine — which reads as a bug and is not one.
   */
  const answered = BUILDER_STEPS.filter(
    (code) => code !== 'final' && selection[code] !== undefined,
  ).length;

  return { selection, step, pick, goToStep, answered };
}

/** The steps that take an answer. Used for the progress line and the rail's tick marks. */
export const ANSWERABLE_STEPS = BUILDER_STEPS.filter((code) => code !== 'final');
