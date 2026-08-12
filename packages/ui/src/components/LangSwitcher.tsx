import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from 'react';

import { cn } from '../cn';

import { Icon } from './Icon';

export interface LangOption {
  /** `ru`, `en`, `tr`, `tm`. */
  code: string;
  /** The language's name in that language — «Русский», «Türkçe», «Türkmençe». */
  name: string;
  /** Where this language's copy of the current page lives. */
  href: string;
}

export interface LangLinkProps {
  className: string;
  'aria-current'?: 'true';
  children: ReactNode;
  onClick: () => void;
}

export interface LangSwitcherProps {
  options: readonly LangOption[];
  /** The code currently in the URL. */
  value: string;
  /**
   * Renders one language as a link.
   *
   * This package must not know which router an app uses, and these have to be real links: a
   * language chooser that swaps state without changing the URL cannot be shared, bookmarked,
   * opened in a new tab, or crawled — and `hreflang` has nothing to point at.
   */
  renderLink: (option: LangOption, props: LangLinkProps) => ReactNode;
  /** Names the control — «Язык», «Dil». */
  label: string;
  className?: string;
}

/**
 * The language chooser.
 *
 * The prototypes' version has none of the behaviour a dropdown needs: it does not close on
 * Escape, it does not close when you click elsewhere on the page, focus is not returned to the
 * button, and the arrow keys do nothing. Opening it and then clicking anywhere else leaves it
 * hanging over the content until the page is reloaded.
 *
 * It is a disclosure over a list of links, not a `role="menu"`. A menu promises a particular
 * set of keyboard behaviours and takes its items out of the document's normal reading; this is
 * four links to four translations of the page, and describing it as what it is costs nothing
 * and behaves better.
 */
export function LangSwitcher({ options, value, renderLink, label, className }: LangSwitcherProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  /**
   * Both listeners live on the document rather than on the wrapper.
   *
   * Escape has to work wherever focus happens to be inside the open list, and a `<div>` that
   * listens for key presses is indistinguishable, to a linter and to a reader, from a `<div>`
   * pretending to be a control. The listeners only exist while the list is open.
   */
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node) === true) return;
      // Focus is not returned here: the visitor has just clicked somewhere else, and dragging
      // it back to the button would undo what they did.
      setOpen(false);
    };

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;

      const links = [
        ...(rootRef.current?.querySelectorAll<HTMLElement>('[data-lang-option]') ?? []),
      ];
      if (links.length === 0) return;
      event.preventDefault();

      const at = links.indexOf(document.activeElement as HTMLElement);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      const next =
        at < 0 ? (step === 1 ? 0 : links.length - 1) : (at + step + links.length) % links.length;
      links[next]?.focus();
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    setOpen(true);
  };

  const current = options.find((option) => option.code === value);

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`${label}: ${current?.name ?? value}`}
        onClick={() => {
          setOpen((was) => !was);
        }}
        onKeyDown={onTriggerKeyDown}
        className="flex min-h-tap items-center gap-2 rounded-full px-3 py-2 text-[13px] font-medium text-nav transition-colors duration-colour hover:bg-line-soft"
      >
        <Icon name="globe" size={16} className="text-body" />
        <span className="uppercase">{value}</span>
        <Icon
          name="caretDown"
          size={12}
          className={cn(
            'text-muted transition-transform duration-caret ease-caret',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <ul
          id={listId}
          aria-label={label}
          className={cn(
            'absolute right-0 top-[calc(100%+12px)] z-50 m-0 min-w-[188px] list-none',
            'rounded-media border border-line bg-island p-2 shadow-drop backdrop-blur-drop',
            'animate-drop-in',
          )}
        >
          {options.map((option) => {
            const selected = option.code === value;
            return (
              <li key={option.code}>
                {renderLink(option, {
                  className: cn(
                    'flex min-h-tap items-center justify-between gap-4 rounded-sm px-3 py-2',
                    'transition-colors duration-colour hover:bg-line-soft',
                  ),
                  ...(selected ? { 'aria-current': 'true' as const } : {}),
                  onClick: () => {
                    close(false);
                  },
                  children: (
                    <>
                      <span className="flex flex-col gap-0.5 text-left">
                        <span className="text-[13px] font-semibold text-ink">{option.name}</span>
                        <span className="font-bold uppercase text-label text-muted">
                          {option.code}
                        </span>
                      </span>
                      {selected && <Icon name="check" size={13} className="text-accent-text" />}
                    </>
                  ),
                })}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
