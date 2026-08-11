import { type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ReactNode } from 'react';

import { cn } from '../cn';

export type ButtonVariant = 'solid' | 'dark' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * `min-h-tap` is README §10's 44px minimum. The small button is 41px of padding and line box
 * without it, which is under the bar on exactly the control that appears in every header.
 */
const BASE = [
  'group inline-flex select-none items-center justify-center gap-3 rounded-full',
  'min-h-tap text-center no-underline',
  'transition-all duration-colour ease-slide',
  'disabled:pointer-events-none disabled:opacity-45',
  'aria-disabled:pointer-events-none aria-disabled:opacity-45',
].join(' ');

/**
 * Hover states are the design's, counted rather than guessed: eleven of the fifteen sand
 * buttons in the handoff hover to cream keeping the same dark label, so that is the rule. The
 * four that invert to brown are the navigation CTA, which passes its own hover classes.
 *
 * The outline hover — a full sand fill — is likewise the prototypes' own
 * `background:#DFA059;color:#3A2A18;border-color:#DFA059`.
 */
const VARIANT: Record<ButtonVariant, string> = {
  solid: 'bg-accent text-accent-on hover:bg-dark-on',
  dark: 'bg-dark-alt text-dark-on hover:bg-accent hover:text-accent-on',
  outline:
    'border border-line-strong bg-transparent text-ink hover:border-accent hover:bg-accent hover:text-accent-on',
  ghost: 'bg-transparent text-ink hover:bg-line-soft hover:text-accent-text',
};

/**
 * All three sizes are 13px. The design never changes a button's type size — only its padding,
 * its tracking and, at the smallest size, its capitalisation: the navigation CTA is the one
 * button in the package that is not uppercase.
 */
const SIZE: Record<ButtonSize, string> = {
  sm: 'px-6 py-3 text-[13px] font-bold tracking-[0.04em]',
  md: 'px-8 py-[18px] text-[13px] font-black uppercase tracking-[0.1em]',
  lg: 'px-[34px] py-[19px] text-[13px] font-black uppercase tracking-[0.12em]',
};

/**
 * The `| undefined` on each member is not noise. Under `exactOptionalPropertyTypes` a
 * destructured optional prop cannot be handed on to another optional prop without it, and
 * every one of these is forwarded from `Button` into `buttonClass`.
 */
export interface ButtonStyleProps {
  variant?: ButtonVariant | undefined;
  size?: ButtonSize | undefined;
  fullWidth?: boolean | undefined;
  className?: string | undefined;
}

/**
 * The class list on its own.
 *
 * Exported because a router `<Link>` often has to look like a button, and forwarding arbitrary
 * props through a polymorphic `as` costs more type safety than `<Link className={buttonClass()}>`
 * costs keystrokes.
 */
export function buttonClass({
  variant = 'solid',
  size = 'md',
  fullWidth = false,
  className,
}: ButtonStyleProps = {}): string {
  return cn(BASE, VARIANT[variant], SIZE[size], fullWidth && 'w-full', className);
}

interface ButtonContentProps {
  children?: ReactNode;
  /** Append the design's trailing arrow, which nudges right on hover. */
  arrow?: boolean | undefined;
  busy?: boolean | undefined;
  /** Announced while `busy`. The spinner alone says nothing to a screen reader. */
  busyLabel?: string | undefined;
}

/**
 * The spinner is a bordered circle rather than an icon so it inherits `currentColor` and works
 * on every variant. Under `prefers-reduced-motion` the global rule freezes it — that is the
 * point of `busyLabel` and `aria-busy`, which carry the state without motion.
 */
function ButtonBody({ children, arrow, busy, busyLabel }: ButtonContentProps) {
  return (
    <>
      {busy === true && (
        <>
          <span
            aria-hidden="true"
            className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
          {busyLabel !== undefined && <span className="sr-only">{busyLabel}</span>}
        </>
      )}
      {children}
      {arrow === true && (
        <span
          aria-hidden="true"
          className="transition-transform duration-colour group-hover:translate-x-1.5"
        >
          →
        </span>
      )}
    </>
  );
}

export interface ButtonProps
  extends
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'>,
    ButtonStyleProps,
    ButtonContentProps {}

export function Button({
  variant,
  size,
  fullWidth,
  className,
  children,
  arrow,
  busy = false,
  busyLabel,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      // Defaulting to "button". A bare <button> inside a form submits it, and the handoff's
      // filter chips and slider controls all live inside forms.
      type={type}
      disabled={disabled === true || busy}
      aria-busy={busy || undefined}
      className={buttonClass({ variant, size, fullWidth, className })}
      {...rest}
    >
      <ButtonBody arrow={arrow} busy={busy} busyLabel={busyLabel}>
        {children}
      </ButtonBody>
    </button>
  );
}

export interface ButtonLinkProps
  extends
    Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className'>,
    ButtonStyleProps,
    Omit<ButtonContentProps, 'busy' | 'busyLabel'> {}

/**
 * The same thing as an anchor, for `tel:`, `mailto:` and outbound links.
 *
 * In-app navigation uses the router's own `Link` with `buttonClass()`; a real `<a href>` there
 * would reload the application.
 */
export function ButtonLink({
  variant,
  size,
  fullWidth,
  className,
  children,
  arrow,
  ...rest
}: ButtonLinkProps) {
  return (
    <a className={buttonClass({ variant, size, fullWidth, className })} {...rest}>
      <ButtonBody arrow={arrow}>{children}</ButtonBody>
    </a>
  );
}
