import { type ReactNode, useId, useState } from 'react';

import { cn } from '../cn';

export interface AccordionItem {
  /** Stable id. Used for the panel's `aria-labelledby` and to say which row is open. */
  id: string;
  question: ReactNode;
  answer: ReactNode;
}

export interface AccordionProps {
  items: readonly AccordionItem[];
  /** Ids open on first render. The FAQ opens its first row. */
  defaultOpen?: readonly string[];
  /** Controlled open set. Leave undefined for uncontrolled. */
  open?: readonly string[] | undefined;
  onOpenChange?: ((open: readonly string[]) => void) | undefined;
  /** Let more than one row be open. The FAQ design shows exactly one. */
  multiple?: boolean;
  /** Where these questions sit in the document outline. */
  headingLevel?: 2 | 3 | 4;
  className?: string;
}

/**
 * A disclosure list — the contact page FAQ, the ten days of the Umrah programme.
 *
 * The prototype tracks `openFaq` in state and swaps a border colour and a `+`/`–` character,
 * but the answer is always in the DOM and the row is a `<div onClick>`: nothing is announced,
 * nothing is reachable by keyboard, and a screen reader reads all six answers straight through
 * as though the accordion were not there.
 *
 * The plus and minus are drawn from two bars rather than typed. `–` is an en-dash and `+` sits
 * on a different baseline in most faces, so the two states jump by a pixel or two — and this
 * package has already been caught once assuming a character exists in Stolzl.
 */
export function Accordion({
  items,
  defaultOpen = [],
  open,
  onOpenChange,
  multiple = false,
  headingLevel = 3,
  className,
}: AccordionProps) {
  const base = useId();
  const [internal, setInternal] = useState<readonly string[]>(defaultOpen);
  const current = open ?? internal;

  const Heading = `h${String(headingLevel)}` as 'h2' | 'h3' | 'h4';

  const toggle = (id: string) => {
    const isOpen = current.includes(id);
    const next = isOpen ? current.filter((x) => x !== id) : multiple ? [...current, id] : [id];
    if (open === undefined) setInternal(next);
    onOpenChange?.(next);
  };

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {items.map((item) => {
        const isOpen = current.includes(item.id);
        const buttonId = `${base}-${item.id}-button`;
        const panelId = `${base}-${item.id}-panel`;

        return (
          <div
            key={item.id}
            className={cn(
              'rounded-panel-sm border bg-surface transition-colors duration-colour',
              isOpen ? 'border-accent' : 'border-line',
            )}
          >
            <Heading className="m-0">
              <button
                type="button"
                id={buttonId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => {
                  toggle(item.id);
                }}
                className="flex w-full items-center justify-between gap-6 px-8 py-6 text-left text-cardTitle font-medium text-ink mob:px-6 mob:py-5"
              >
                {item.question}
                <span aria-hidden="true" className="relative h-4 w-4 shrink-0 text-accent-text">
                  <span className="absolute left-0 top-1/2 h-[1.5px] w-4 -translate-y-1/2 rounded-full bg-current" />
                  <span
                    className={cn(
                      'absolute left-1/2 top-0 h-4 w-[1.5px] -translate-x-1/2 rounded-full bg-current',
                      'transition-[transform,opacity] duration-caret ease-caret',
                      isOpen && 'scale-y-0 opacity-0',
                    )}
                  />
                </span>
              </button>
            </Heading>

            {/* Unmounted when closed rather than hidden. `hidden` alone still lets Ctrl+F find
                the text and leaves it in the reading order of some assistive technology. */}
            {isOpen && (
              <div
                id={panelId}
                role="region"
                aria-labelledby={buttonId}
                className="px-8 pb-7 text-lead font-light text-body mob:px-6 mob:pb-6"
              >
                {item.answer}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
