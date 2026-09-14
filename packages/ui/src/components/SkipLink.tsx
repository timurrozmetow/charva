export interface SkipLinkProps {
  /** The id of the element to jump to — `content` on every site here. */
  targetId: string;
  children: string;
}

/**
 * The first thing in the tab order, and invisible until it is there.
 *
 * Every page on these sites opens with the same navigation island: seven menu entries, a
 * language switcher and a call to action. Without this, a keyboard or screen-reader user tabs
 * through all of them before reaching the page — on every page, every time.
 *
 * `Layout` has carried `<main id="content">` since it was written, and the comment above it says
 * the id is «the skip link's target». The link itself was never written: the target existed for
 * months with nothing pointing at it.
 *
 * Not `sr-only`. A skip link hidden from sight as well as from the tab order helps a screen
 * reader and abandons the sighted keyboard user, who is the person most likely to need it — so
 * it is positioned off the top of the window and comes back the moment it takes focus.
 */
export function SkipLink({ targetId, children }: SkipLinkProps) {
  return (
    <a
      href={`#${targetId}`}
      className="absolute left-4 top-0 z-[200] -translate-y-full rounded-b-panel-sm bg-accent px-5 py-3 text-bodySm font-semibold text-accent-on no-underline transition-transform duration-drop focus-visible:translate-y-0"
    >
      {children}
    </a>
  );
}
