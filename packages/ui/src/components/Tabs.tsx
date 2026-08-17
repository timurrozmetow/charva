import {
  createContext,
  type KeyboardEvent,
  type ReactNode,
  useContext,
  useId,
  useRef,
} from 'react';

import { cn } from '../cn';

import { chipClass } from './Chip';

export interface TabItem {
  /** Stable code. The URL is synchronised to this, so it must not be a translated label. */
  value: string;
  label: ReactNode;
  count?: number;
}

interface TabsState {
  base: string;
  active: string;
}

const TabsContext = createContext<TabsState | null>(null);

export interface TabsProps {
  items: readonly TabItem[];
  value: string;
  onValueChange: (value: string) => void;
  /** Names the tab list — «Группы паломников». */
  label: string;
  /**
   * A fixed id prefix, for when the panel cannot be a child of this component.
   *
   * The Umrah media page is that case: the tabs sit in one section and the mosaic they control
   * in the next, and nesting the second section inside the first to satisfy the component
   * would change the page's width and padding. Given the same string, `TabPanel` builds the
   * matching ids without the context.
   */
  idBase?: string;
  children?: ReactNode;
  className?: string;
  listClassName?: string;
}

/**
 * A real tab list, for the group tabs on the Umrah media page.
 *
 * Tabs rather than filter chips because what changes below is a panel of that group's photos
 * and videos, not a filtered view of one collection — and because the design draws them as
 * tabs. That commitment brings obligations the prototype's `<div onClick>` does not meet:
 * arrow keys move between tabs, Home and End jump to the ends, and only the selected tab is in
 * the tab order, so Tab from the list reaches the panel rather than five more tabs.
 *
 * The panel is a separate `<TabPanel>` rendered as a child, so a page can load the photographs
 * of the group actually being looked at instead of all sixty-eight groups at once.
 */
export function Tabs({
  items,
  value,
  onValueChange,
  label,
  idBase,
  children,
  className,
  listClassName,
}: TabsProps) {
  const generated = useId();
  const base = idBase ?? generated;
  const listRef = useRef<HTMLDivElement>(null);

  // On the tabs themselves, not on the list. Under a roving tabindex the list never holds
  // focus, so a listener there only fires by bubbling — and declaring one makes the list look
  // like an interactive element that ought to be focusable, which it must not be.
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = items.findIndex((item) => item.value === value);
    if (index < 0) return;

    const last = items.length - 1;
    let next: number | undefined;

    if (event.key === 'ArrowRight') next = index === last ? 0 : index + 1;
    else if (event.key === 'ArrowLeft') next = index === 0 ? last : index - 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = last;

    if (next === undefined) return;
    event.preventDefault();

    const target = items[next];
    if (target === undefined) return;
    onValueChange(target.value);
    // Selection follows focus, so the newly selected tab has to actually receive it.
    listRef.current?.querySelector<HTMLButtonElement>(`[data-value="${target.value}"]`)?.focus();
  };

  return (
    <TabsContext.Provider value={{ base, active: value }}>
      <div className={className}>
        <div
          ref={listRef}
          role="tablist"
          aria-label={label}
          className={cn('flex flex-wrap gap-[10px]', listClassName)}
        >
          {items.map((item) => {
            const selected = item.value === value;
            return (
              <button
                key={item.value}
                type="button"
                role="tab"
                id={`${base}-${item.value}-tab`}
                data-value={item.value}
                aria-selected={selected}
                aria-controls={`${base}-${item.value}-panel`}
                // Roving tabindex: one stop for the whole list, arrows do the rest.
                tabIndex={selected ? 0 : -1}
                onKeyDown={onKeyDown}
                onClick={() => {
                  onValueChange(item.value);
                }}
                className={chipClass({ active: selected })}
              >
                {item.label}
                {item.count !== undefined && (
                  <span
                    className={cn('text-[11px] font-bold', selected ? 'opacity-70' : 'text-muted')}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export interface TabPanelProps {
  /** Matches the `value` of the tab this panel belongs to. */
  value: string;
  /** Set to the same string as the tab list's, when the panel is not a child of `<Tabs>`. */
  idBase?: string;
  /**
   * True when the panel already contains something focusable — a form, a list of links.
   *
   * The ARIA authoring practices make the panel itself focusable *only* when its content is
   * not: a grid of photographs would otherwise be skipped entirely by a keyboard user, while a
   * panel holding a form would gain a tab stop before the first field that does nothing.
   */
  hasFocusableContent?: boolean;
  children?: ReactNode;
  className?: string;
}

/**
 * The panel for one tab. Renders nothing unless its tab is the selected one.
 *
 * Not optional, though it looks it: a `role="tab"` carries `aria-controls` pointing at this
 * element's id, and a tab list rendered without a panel points at nothing. That is an invalid
 * ARIA reference — a screen reader announces a tab that controls something it cannot find —
 * and it is what axe reports as critical. Both call sites in this repository shipped without
 * one until phase 8 measured it.
 */
export function TabPanel({
  value,
  idBase,
  hasFocusableContent = false,
  children,
  className,
}: TabPanelProps) {
  const tabs = useContext(TabsContext);
  const base = idBase ?? tabs?.base;

  if (base === undefined) {
    throw new Error('<TabPanel> needs either a <Tabs> ancestor or an idBase matching one');
  }

  // Inside `<Tabs>` the context decides which panel is showing. Given an `idBase` the panel is
  // somewhere else on the page and the page itself passes only the value being shown.
  if (idBase === undefined && tabs?.active !== value) return null;

  return (
    <div
      role="tabpanel"
      id={`${base}-${value}-panel`}
      aria-labelledby={`${base}-${value}-tab`}
      tabIndex={hasFocusableContent ? undefined : 0}
      className={className}
    >
      {children}
    </div>
  );
}
