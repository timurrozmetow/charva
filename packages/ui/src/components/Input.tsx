import {
  forwardRef,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

import { cn } from '../cn';

import { useField } from './Field';
import { Icon } from './Icon';

/**
 * The field shell, shared by all three controls.
 *
 * `bg-field` is the recessed surface — the page colour inside a card on light, a faint cream
 * tint on dark — which is how the design draws it on the contact page and on the dark signup
 * card with the same intent and two different literals.
 *
 * No `outline: none`. The prototypes set it on every input and put nothing back, so a keyboard
 * user has no idea where they are; the global `:focus-visible` ring in styles.css is the
 * replacement, and the border darkening on focus is additional rather than instead.
 */
const CONTROL = [
  'w-full rounded-input border border-line-field bg-field',
  'px-[17px] py-[15px] text-[15px] font-light leading-normal text-ink',
  'placeholder:text-muted placeholder:font-light',
  'transition-colors duration-colour',
  'hover:border-line-chip focus:border-accent',
  'disabled:cursor-not-allowed disabled:opacity-50',
  'aria-[invalid=true]:border-danger',
].join(' ');

/** React allows "grammar" and "spelling" here; none of our forms use them, but the type must. */
type AriaInvalid = InputHTMLAttributes<HTMLInputElement>['aria-invalid'];

/** Wiring pulled from an enclosing `Field`, with explicit props always winning. */
function useControlProps(explicit: {
  id?: string | undefined;
  required?: boolean | undefined;
  'aria-invalid'?: AriaInvalid;
  'aria-describedby'?: string | undefined;
}) {
  const field = useField();
  if (field === null) return explicit;

  return {
    ...explicit,
    id: explicit.id ?? field.id,
    required: explicit.required ?? field.required,
    'aria-invalid': explicit['aria-invalid'] ?? (field.invalid ? true : undefined),
    'aria-describedby': explicit['aria-describedby'] ?? field.describedBy,
  };
}

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

/*
 * All three controls forward their ref, and that is not a nicety.
 *
 * `register()` from react-hook-form returns `{name, onChange, onBlur, ref}`, and the ref is how
 * the library learns the element exists at all. Spread onto a plain function component it is
 * silently dropped — React warns and moves on — and the form then validates its own default
 * values forever: every field reports «заполните поле» however much the visitor typed. It looks
 * exactly like a validation bug and is not one, which is why it is worth a paragraph.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    className,
    id,
    required,
    'aria-invalid': ariaInvalid,
    'aria-describedby': describedBy,
    ...rest
  },
  ref,
) {
  const wired = useControlProps({
    id,
    required,
    'aria-invalid': ariaInvalid,
    'aria-describedby': describedBy,
  });
  return <input ref={ref} className={cn(CONTROL, className)} {...wired} {...rest} />;
});

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    className,
    id,
    required,
    'aria-invalid': ariaInvalid,
    'aria-describedby': describedBy,
    ...rest
  },
  ref,
) {
  const wired = useControlProps({
    id,
    required,
    'aria-invalid': ariaInvalid,
    'aria-describedby': describedBy,
  });
  return (
    <textarea
      ref={ref}
      // The design's own `resize: vertical`, kept: a textarea the user cannot grow is a
      // textarea they will fight, and horizontal resizing breaks the grid.
      className={cn(CONTROL, 'min-h-[130px] resize-y', className)}
      {...wired}
      {...rest}
    />
  );
});

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

/**
 * A native `<select>` with the platform arrow replaced by the design's caret.
 *
 * Native rather than a custom listbox on purpose: this is a form control on a public site
 * reached from phones on a slow connection, and the platform picker is better than anything
 * worth building here. `appearance-none` removes the arrow; the caret is drawn beside it and
 * ignores pointer events so clicks still fall through to the control.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    className,
    id,
    required,
    'aria-invalid': ariaInvalid,
    'aria-describedby': describedBy,
    children,
    ...rest
  },
  ref,
) {
  const wired = useControlProps({
    id,
    required,
    'aria-invalid': ariaInvalid,
    'aria-describedby': describedBy,
  });
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(CONTROL, 'appearance-none pr-12', className)}
        {...wired}
        {...rest}
      >
        {children}
      </select>
      <Icon
        name="caretDown"
        size={14}
        className="pointer-events-none absolute right-[17px] top-1/2 -translate-y-1/2 text-muted"
      />
    </div>
  );
});
