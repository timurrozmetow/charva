import { type ReactNode, useEffect, useRef, useState } from 'react';

import { cn } from '../cn';
import { useFocusTrap, useScrollLock } from '../hooks/useFocusTrap';

import { Container } from './Container';
import { Divider } from './Divider';

export interface NavItem {
  /** Stable key — `tours`, `builder`, `ziyarat`. Also what `activeKey` is matched against. */
  key: string;
  label: ReactNode;
  href: string;
}

export interface NavLinkProps {
  className: string;
  'aria-current'?: 'page';
  children: ReactNode;
  onClick?: () => void;
}

export interface SiteNavLabels {
  /** Names the navigation landmark — «Основная навигация». */
  nav: string;
  openMenu: string;
  closeMenu: string;
  /** Names the sheet itself, which is a dialog once it traps focus — «Меню». */
  menu: string;
}

export interface SiteNavProps {
  items: readonly NavItem[];
  /** `key` of the current page's item. Undefined on pages with no menu entry, like Contact. */
  activeKey?: string;
  /** The logo, already wrapped in the app's own link to its home page. */
  logo: ReactNode;
  /** The sand call to action at the right end. */
  cta?: ReactNode;
  langSwitcher?: ReactNode;
  /** Renders one menu entry; the app supplies its router's link component. */
  renderLink: (item: NavItem, props: NavLinkProps) => ReactNode;
  labels: SiteNavLabels;
  /**
   * Floats the island over the page instead of standing above it.
   *
   * For the two homepages, whose first element is a full-bleed photograph. The prototype does
   * this with `margin:-78px 0 0` on the hero — pulling the picture up under the island — which
   * is the same result reached by measuring the island in pixels and hoping it never changes
   * size. Taking the nav out of flow instead needs no number at all.
   */
  overlay?: boolean;
  className?: string;
}

const ITEM =
  'flex min-h-tap items-center whitespace-nowrap rounded-full px-[15px] py-[10px] text-bodySm text-nav transition-[background-color,color] duration-chip hover:bg-tint';

const ITEM_ACTIVE = 'bg-tint-strong font-semibold text-accent-active';

/**
 * The navigation island, shared by both public sites.
 *
 * One component, not two. The markup in `Charva Nav` and `Charva Umrah Nav` is identical and
 * the differences are entirely colour — the item colour, the border, the caret — all of which
 * are theme variables here, so neither site knows the other exists.
 *
 * It scrolls away with the page. It used to be `sticky`, which the prototypes cannot express
 * either way — they are single static frames — so that was a decision, and this is the
 * opposite one.
 *
 * On the two homepages it floats over the photograph rather than standing on cream above it —
 * see `overlay`.
 *
 * Below `navbar:` — 1239px, its own breakpoint and not `tab:` — the menu collapses into a sheet,
 * which the design describes in prose and does not draw: the prototypes are fixed at
 * `min-width: 1280px` with no media query anywhere in the package. The sheet traps focus and
 * closes on Escape, because a menu overlaying the page that a keyboard user can tab out of is
 * worse than no menu.
 *
 * The island runs out of room two hundred pixels before the page does — seven Russian labels, a
 * logo, a language switcher and a call to action on one row — so it collapses on its own
 * schedule. At `tab:` it was still trying: «Сборщик туров» wrapped to two lines from 1240 and
 * the bar grew to 65 pixels, and below 1180 the logo was squeezed out of existence entirely.
 */
export function SiteNav({
  items,
  activeKey,
  logo,
  cta,
  langSwitcher,
  renderLink,
  labels,
  overlay = false,
  className,
}: SiteNavProps) {
  const [open, setOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  /*
   * The page behind an open menu does not scroll.
   *
   * The sheet already traps focus, which is half of behaving like a dialog; the other half was
   * missing, so on a phone a finger dragged the page underneath while the menu sat on top of
   * it. `Modal` has locked the scroll since it was written — this is the same hook, and the
   * sheet simply never asked for it.
   */
  useScrollLock(open);

  useFocusTrap(sheetRef, {
    active: open,
    onEscape: () => {
      setOpen(false);
    },
  });

  // A route change is a reason to close: without this the sheet stays open over the page the
  // visitor just navigated to.
  const activeRef = useRef(activeKey);
  useEffect(() => {
    if (activeRef.current !== activeKey) {
      activeRef.current = activeKey;
      setOpen(false);
    }
  }, [activeKey]);

  const link = (item: NavItem, extra?: string) =>
    renderLink(item, {
      className: cn(ITEM, item.key === activeKey && ITEM_ACTIVE, extra),
      ...(item.key === activeKey ? { 'aria-current': 'page' as const } : {}),
      children: item.label,
      onClick: () => {
        setOpen(false);
      },
    });

  return (
    // A `header` rather than a `div`: this is the site banner, and a page with no banner
    // landmark leaves a screen-reader user nothing to jump between but `main` and the footer.
    <header
      className={cn(
        'z-[100] pt-[18px]',
        overlay ? 'absolute inset-x-0 top-0' : 'relative',
        className,
      )}
    >
      <Container width="island" className="px-10 tab:px-6 mob:px-4">
        <nav
          aria-label={labels.nav}
          className={cn(
            'flex items-center gap-6 rounded-full border border-line bg-island py-[10px] pl-[22px] pr-[14px]',
            'shadow-island backdrop-blur-island tab:gap-3 tab:pl-4',
          )}
        >
          {/*
            The logo never shrinks.

            It was a flex child with nothing stopping it, and the menu beside it is `flex-1` —
            so between 1180 and 1024 pixels the browser took the width it needed out of the one
            element that would give: 57px at 1280, 48 at 1150, 24 at 1100, and at 1024 the
            logo was zero pixels wide and simply gone. The site had no mark on it at exactly
            the widths of an iPad in landscape and a window snapped to half a 1080p screen.
          */}
          <span className="shrink-0">{logo}</span>

          <Divider orientation="vertical" className="h-[26px] navbar:hidden" />

          <ul className="m-0 flex flex-1 list-none justify-center gap-0.5 p-0 navbar:hidden">
            {items.map((item) => (
              <li key={item.key}>{link(item)}</li>
            ))}
          </ul>

          {/* Pushes the controls right once the menu itself is gone. */}
          <span className="hidden flex-1 navbar:block" />

          {langSwitcher}
          <span className="navbar:hidden">{cta}</span>

          <button
            type="button"
            aria-expanded={open}
            aria-label={open ? labels.closeMenu : labels.openMenu}
            onClick={() => {
              setOpen((was) => !was);
            }}
            className="hidden h-tap w-tap place-items-center rounded-full text-ink transition-colors duration-colour hover:bg-line-soft navbar:grid"
          >
            {/*
              Three bars, the middle one folding away as the outer two cross.

              All three are pinned to the same `top-1/2` and moved with `translateY`, and that is
              the whole of the fix: the outer bars used to travel by swapping `top-0` for
              `top-1/2` and `bottom-0` for `top-1/2`. Swapping which edge positions an element
              means the old property becomes `auto`, and `auto` does not interpolate — so the
              bars *jumped* to the middle and only the rotation animated. `transition-all` was
              hiding it by claiming to animate everything.

              The offsets are the geometry: the box is 16px, the bars 1.5px, so a centred bar
              sits at `-0.75px` and the outer two are ±7.25 from there — which is 8px up and
              6.5px down.
            */}
            <span aria-hidden="true" className="relative block h-4 w-5">
              <span
                className={cn(
                  'absolute left-0 top-1/2 h-[1.5px] w-5 rounded-full bg-current',
                  'transition-transform duration-drop ease-drop',
                  open ? '-translate-y-[0.75px] rotate-45' : '-translate-y-2',
                )}
              />
              <span
                className={cn(
                  'absolute left-0 top-1/2 h-[1.5px] w-5 -translate-y-1/2 rounded-full bg-current transition-opacity duration-drop',
                  open && 'opacity-0',
                )}
              />
              <span
                className={cn(
                  'absolute left-0 top-1/2 h-[1.5px] w-5 rounded-full bg-current',
                  'transition-transform duration-drop ease-drop',
                  open ? '-translate-y-[0.75px] -rotate-45' : 'translate-y-[6.5px]',
                )}
              />
            </span>
          </button>
        </nav>

        {open && (
          <div
            ref={sheetRef}
            /*
             * Announced as what it behaves like.
             *
             * Focus cannot leave it and the page cannot scroll, which is a modal whether or not
             * it says so — and a screen-reader user who finds themselves unable to get out of an
             * unannounced container has no way to know it is deliberate.
             */
            role="dialog"
            aria-modal="true"
            aria-label={labels.menu}
            className={cn(
              'mt-3 hidden rounded-panel border border-line bg-island p-4 shadow-drop',
              // Out of the bar above it — the sheet is full width, so the top edge is what
              // stays put and the panel unrolls downwards. See `LangSwitcher` for the reasoning.
              'origin-top backdrop-blur-drop animate-drop-in navbar:block',
            )}
          >
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {items.map((item) => (
                <li key={item.key}>{link(item, 'w-full')}</li>
              ))}
            </ul>
            {cta !== undefined && <div className="mt-4">{cta}</div>}
          </div>
        )}
      </Container>
    </header>
  );
}
