import {
  ApiRequestError,
  HONEYPOT_FIELD,
  type Lang,
  ROOM_TYPES,
  type UmrahSignupRequest,
  umrahSignupRequest,
} from '@charva/contracts';
import { Button, Checkbox, Chip, Field, FormError, Input, Textarea } from '@charva/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { formTokenQuery, postSignup } from '../api/queries';
import { copyFor, fill } from '../i18n';

export interface SignupFormProps {
  lang: Lang;
  /** False once the list closes or the group leaves; the API refuses either way. */
  open: boolean;
  className?: string;
}

/** An optional contract field, as the DOM holds it: `''` means «not filled in». */
function optionalText(field: z.ZodTypeAny) {
  return z.string().superRefine((value, ctx) => {
    if (value === '') return;
    if (!field.safeParse(value).success) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'invalid' });
    }
  });
}

/**
 * What the browser holds, checked against what the API accepts.
 *
 * Every rule is read out of `umrahSignupRequest` rather than restated. What is written here is
 * only the difference between a form and a request: strings where the wire has a number, `''`
 * where it has absence, and a checkbox that must be able to hold `false` before anybody ticks
 * it — which `z.literal(true)` by definition cannot.
 */
const formSchema = z.object({
  fullName: umrahSignupRequest.shape.fullName,
  phone: umrahSignupRequest.shape.phone,
  passportNumber: optionalText(umrahSignupRequest.shape.passportNumber),
  peopleCount: z.string().superRefine((value, ctx) => {
    const parsed = umrahSignupRequest.shape.peopleCount.safeParse(
      value === '' ? undefined : Number(value),
    );
    if (!parsed.success) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'invalid' });
  }),
  roomType: z.string(),
  comment: optionalText(umrahSignupRequest.shape.comment),
  consent: z.boolean().refine((value) => value),
  [HONEYPOT_FIELD]: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

const EMPTY: FormValues = {
  fullName: '',
  phone: '',
  passportNumber: '',
  peopleCount: '1',
  roomType: 'double',
  comment: '',
  consent: false,
  [HONEYPOT_FIELD]: '',
};

/**
 * A place on the pilgrimage.
 *
 * The handoff's version submits nothing: the button is an `<a href="#">`, the consent box is a
 * 17×17 `<span>` that cannot be ticked, and the only live state on the page is which room chip
 * is highlighted. All of this is designed.
 *
 * Two things here that the Global lead form does not have.
 *
 * **The passport number is optional and says why.** A manager can take it by telephone, and
 * asking for a passport number in a web form before anybody has spoken to the pilgrim is a
 * decision the owner has not made. When it is given it is encrypted with AES-256-GCM before it
 * reaches the column, returned by nothing, and every decryption writes a row to `audit_log`
 * (D-18). The hint under the field says so, because a person handing over a passport number
 * deserves to know where it goes. The retention period and the exact wording are question Q-13.
 *
 * **The form refuses when the list is closed.** The API refuses too — a disabled button in a
 * browser is a courtesy, not a rule, and a closed list that still accepts submissions produces
 * people who believe they are going.
 */
export function SignupForm({ lang, open, className }: SignupFormProps) {
  const copy = copyFor(lang);
  const token = useQuery(formTokenQuery());

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: EMPTY,
    mode: 'onTouched',
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const body = (formToken: string): UmrahSignupRequest => ({
        fullName: values.fullName.trim(),
        phone: values.phone.trim(),
        ...(values.passportNumber === '' ? {} : { passportNumber: values.passportNumber.trim() }),
        peopleCount: Number(values.peopleCount),
        ...(values.roomType === ''
          ? {}
          : { roomType: values.roomType as UmrahSignupRequest['roomType'] }),
        ...(values.comment === '' ? {} : { comment: values.comment.trim() }),
        consent: true,
        formToken,
        [HONEYPOT_FIELD]: values[HONEYPOT_FIELD],
      });

      const issued = token.data ?? (await token.refetch()).data;
      if (issued === undefined) throw new Error('no form token');

      try {
        return await postSignup(lang, body(issued.token));
      } catch (error) {
        // One retry, and only for a token that timed out — the one failure that happens to
        // real people, and the one where losing what somebody typed would be our fault.
        if (error instanceof ApiRequestError && error.fieldErrors['formToken'] === 'expired') {
          const fresh = await token.refetch();
          if (fresh.data !== undefined) return postSignup(lang, body(fresh.data.token));
        }
        throw error;
      }
    },
  });

  if (mutation.isSuccess) {
    return (
      <div className={className}>
        <h3 className="text-h3 font-medium text-ink">{copy.form.success.title}</h3>
        <p className="mt-3 text-body font-light text-body">
          {fill(copy.form.success.text, { phone: form.getValues('phone') })}
        </p>
        <Button
          variant="outline"
          className="mt-7"
          onClick={() => {
            form.reset(EMPTY);
            mutation.reset();
            // A new form is a new moment: the token just spent carries the old one.
            void token.refetch();
          }}
        >
          {copy.form.success.again}
        </Button>
      </div>
    );
  }

  const failure =
    mutation.error instanceof ApiRequestError
      ? mutation.error.code === 'rate_limited'
        ? copy.form.errors.rateLimited
        : mutation.error.code === 'conflict'
          ? copy.form.errors.closed
          : copy.form.errors.failed
      : copy.form.errors.failed;

  return (
    <form
      noValidate
      onSubmit={(event) => {
        void form.handleSubmit((values) => {
          mutation.mutate(values);
        })(event);
      }}
      className={className}
    >
      <div className="grid grid-cols-2 gap-4 mob:grid-cols-1">
        <Field
          label={copy.form.fullName}
          required
          {...(form.formState.errors.fullName === undefined
            ? {}
            : { error: copy.form.errors.fullName })}
        >
          <Input
            autoComplete="name"
            placeholder={copy.form.fullNamePlaceholder}
            {...form.register('fullName')}
          />
        </Field>

        <Field
          label={copy.form.phone}
          required
          {...(form.formState.errors.phone === undefined ? {} : { error: copy.form.errors.phone })}
        >
          {/* `+993 6X XXXXXX` is what the API validates with libphonenumber; the placeholder
              shows the shape rather than a mask that fights anybody pasting a number. */}
          <Input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder={copy.form.phonePlaceholder}
            {...form.register('phone')}
          />
        </Field>

        <Field
          label={copy.form.passport}
          hint={copy.form.passportHint}
          {...(form.formState.errors.passportNumber === undefined
            ? {}
            : { error: copy.form.errors.passport })}
        >
          <Input
            autoComplete="off"
            placeholder={copy.form.passportPlaceholder}
            {...form.register('passportNumber')}
          />
        </Field>

        <Field
          label={copy.form.peopleCount}
          required
          {...(form.formState.errors.peopleCount === undefined
            ? {}
            : { error: copy.form.errors.peopleCount })}
        >
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={20}
            placeholder={copy.form.peopleCountPlaceholder}
            {...form.register('peopleCount')}
          />
        </Field>
      </div>

      <Controller
        control={form.control}
        name="roomType"
        render={({ field }) => (
          <fieldset className="mt-6 border-0 p-0">
            <legend className="font-bold uppercase text-label text-muted">
              {copy.form.roomType}
            </legend>
            <div className="mt-3 flex flex-wrap gap-[9px]">
              {ROOM_TYPES.map((code) => (
                <Chip
                  key={code}
                  variant="tint"
                  active={field.value === code}
                  onClick={() => {
                    // A code, so «2 adamlyk» can be renamed without changing what was booked.
                    field.onChange(field.value === code ? '' : code);
                  }}
                >
                  {copy.form.rooms[code]}
                </Chip>
              ))}
            </div>
          </fieldset>
        )}
      />

      <Field
        label={copy.form.comment}
        hint={copy.form.optional}
        className="mt-6"
        {...(form.formState.errors.comment === undefined
          ? {}
          : { error: copy.form.errors.comment })}
      >
        {/* The handoff labels this `Bellik / Комментарий` — Russian on a Turkmen page, and one
            of the four insertions question Q-3 lists. The label is Turkmen; the Russian page
            has its own. */}
        <Textarea placeholder={copy.form.commentPlaceholder} {...form.register('comment')} />
      </Field>

      {/* The honeypot — off-screen rather than unrendered, because a field that is not there is
          a field many bots skip. Never reachable by keyboard or screen reader. */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-px w-px overflow-hidden">
        <input type="text" tabIndex={-1} autoComplete="off" {...form.register(HONEYPOT_FIELD)} />
      </div>

      <Checkbox
        className="mt-6"
        {...(form.formState.errors.consent === undefined
          ? {}
          : { error: copy.form.errors.consent })}
        {...form.register('consent')}
      >
        {copy.form.consent}
      </Checkbox>
      <p className="mt-1 pl-[29px] text-bodySm font-light text-muted">{copy.form.consentHint}</p>

      <FormError className="mt-5">
        {mutation.isError ? failure : !open ? copy.form.errors.closed : undefined}
      </FormError>

      <div className="mt-7 flex flex-wrap items-center gap-5">
        <Button type="submit" busy={mutation.isPending} disabled={!open}>
          {copy.form.submit}
        </Button>
        <p className="text-bodySm font-light text-muted">{copy.form.replyNote}</p>
      </div>
    </form>
  );
}
