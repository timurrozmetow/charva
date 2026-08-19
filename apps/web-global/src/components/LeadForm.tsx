import {
  ApiRequestError,
  type BuilderSelection,
  HONEYPOT_FIELD,
  type Lang,
  type LeadRequest,
  leadRequest,
  LEAD_SERVICE_TOPICS,
  LEAD_TRIP_TOPICS,
} from '@charva/contracts';
import {
  Button,
  Checkbox,
  Chip,
  Field,
  FormError,
  Input,
  RadioChipGroup,
  Textarea,
} from '@charva/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { formTokenQuery, type LeadPayload, postLead } from '../api/queries';
import { copyFor, fill } from '../i18n';

export type LeadKind = LeadRequest['kind'];

export interface LeadFormProps {
  lang: Lang;
  /** Which tab, or which page, this submission came from. Fixed by the caller, never a field. */
  kind: LeadKind;
  /** Shown above the fields and prepended to the message, so nothing is added behind the back. */
  contextTitle?: string;
  /** The builder's ninth step attaches its selection; the server prices it and stores that. */
  selection?: BuilderSelection;
  showGuests?: boolean;
  showTopics?: boolean;
  className?: string;
}

/**
 * An optional contract field, as the DOM actually holds it.
 *
 * A text input that was never touched submits `''`, not nothing — so the empty string has to
 * mean «absent» here while still meaning «invalid» to the API, where an empty e-mail address
 * would be a real mistake. The rule itself is not restated: the contract's own schema is asked.
 */
function optionalText(field: z.ZodTypeAny) {
  return z.string().superRefine((value, ctx) => {
    if (value === '') return;
    if (!field.safeParse(value).success) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'invalid' });
    }
  });
}

/** The same, for a field the contract types as a number — `guests`. */
function optionalNumber(field: z.ZodTypeAny) {
  return z.string().superRefine((value, ctx) => {
    if (value === '') return;
    if (!field.safeParse(Number(value)).success) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'invalid' });
    }
  });
}

/**
 * What the browser holds, checked against what the API accepts.
 *
 * Every constraint is read out of `leadRequest` rather than repeated: the minimum length of a
 * name and the range of a party size are the API's rules, and a second copy of them in a form
 * is a second copy that drifts. What is written here is only the difference between a form and
 * a request — strings where the wire has numbers, `''` where the wire has absence, and a
 * checkbox that has to be able to hold `false` before anybody ticks it, which `z.literal(true)`
 * by definition cannot.
 */
const formSchema = z.object({
  name: leadRequest.shape.name,
  phone: leadRequest.shape.phone,
  email: optionalText(leadRequest.shape.email),
  guests: optionalNumber(leadRequest.shape.guests),
  topics: z.array(z.string()),
  message: optionalText(leadRequest.shape.message),
  consent: z.boolean().refine((value) => value),
  [HONEYPOT_FIELD]: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

const EMPTY: FormValues = {
  name: '',
  phone: '',
  email: '',
  guests: '',
  topics: [],
  message: '',
  consent: false,
  [HONEYPOT_FIELD]: '',
};

/**
 * The lead form, written once and mounted five times.
 *
 * There is no form at all in the handoff. Both submit buttons are `<a href="#">`, no input is
 * controlled, the consent box is a 17×17 `<span>` that cannot be ticked, and there is no
 * validation, no pending state, no success state and no failure state anywhere in the package.
 * All of this is designed rather than transcribed.
 *
 * Four of the five anti-spam layers are invisible from here and that is the point (D-19). The
 * honeypot is a real field placed off-screen; the signed token is fetched when the form mounts
 * rather than when it submits, because the whole mechanism is the gap between the two; the rate
 * limit and the duplicate window live on the server. A visitor sees a checkbox and a button.
 */
export function LeadForm({
  lang,
  kind,
  contextTitle,
  selection,
  showGuests = kind === 'tour',
  showTopics = kind === 'tour',
  className,
}: LeadFormProps) {
  const copy = copyFor(lang);

  /*
   * Fetched on mount, deliberately.
   *
   * The token carries the moment it was issued, and a submission arriving less than three
   * seconds later was not typed by a person. Asking for it at submit time would hand every bot
   * a fresh one and turn the layer off.
   */
  const token = useQuery(formTokenQuery());

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: EMPTY,
    // Silent until the first attempt, then live: a message about a field somebody has not
    // reached yet is noise, and a message that persists after they fix it is worse.
    mode: 'onTouched',
  });

  /** The page a submission came from, prepended visibly rather than smuggled in. */
  const message = (values: FormValues): string => {
    const note =
      contextTitle === undefined ? '' : fill(copy.form.aboutPage, { title: contextTitle });
    return [note, values.message.trim()].filter((part) => part !== '').join('\n\n');
  };

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const body = (formToken: string): LeadPayload => ({
        kind,
        name: values.name.trim(),
        phone: values.phone.trim(),
        ...(values.email === '' ? {} : { email: values.email.trim() }),
        ...(showGuests && values.guests !== '' ? { guests: Number(values.guests) } : {}),
        ...(showTopics && values.topics.length > 0 ? { topics: values.topics } : {}),
        ...(message(values) === '' ? {} : { message: message(values) }),
        ...(selection === undefined ? {} : { selection }),
        consent: true,
        formToken,
        [HONEYPOT_FIELD]: values[HONEYPOT_FIELD],
      });

      const issued = token.data ?? (await token.refetch()).data;
      if (issued === undefined) throw new Error('no form token');

      try {
        return await postLead(lang, body(issued.token));
      } catch (error) {
        /*
         * One retry, and only for a token that timed out.
         *
         * A form left open over lunch is the one failure here that happens to real people, and
         * losing what somebody typed to a two-hour clock would be our fault, not theirs. Every
         * other verdict — forged, malformed, submitted inside three seconds — is retried into
         * the same answer, so it is not retried.
         */
        if (error instanceof ApiRequestError && error.fieldErrors['formToken'] === 'expired') {
          const fresh = await token.refetch();
          if (fresh.data !== undefined) return postLead(lang, body(fresh.data.token));
        }
        throw error;
      }
    },
  });

  if (mutation.isSuccess) {
    return (
      <div className={className}>
        <div className="rounded-panel border border-line bg-surface p-11 mob:p-6">
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
              // A new form is a new moment: the token that was just spent carries the old one.
              void token.refetch();
            }}
          >
            {copy.form.success.again}
          </Button>
        </div>
      </div>
    );
  }

  const failed = mutation.isError;
  const failure =
    mutation.error instanceof ApiRequestError && mutation.error.code === 'rate_limited'
      ? copy.form.errors.rateLimited
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
      {contextTitle !== undefined && (
        <p className="mb-6 text-bodySm text-muted">
          {fill(copy.form.aboutPage, { title: contextTitle })}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 mob:grid-cols-1">
        <Field
          label={copy.form.name}
          required
          {...(form.formState.errors.name === undefined ? {} : { error: copy.form.errors.name })}
        >
          <Input
            autoComplete="name"
            placeholder={copy.form.namePlaceholder}
            {...form.register('name')}
          />
        </Field>

        <Field
          label={copy.form.phone}
          required
          {...(form.formState.errors.phone === undefined ? {} : { error: copy.form.errors.phone })}
        >
          <Input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder={copy.form.phonePlaceholder}
            {...form.register('phone')}
          />
        </Field>

        <Field
          label={copy.form.email}
          hint={copy.form.optional}
          {...(form.formState.errors.email === undefined ? {} : { error: copy.form.errors.email })}
        >
          <Input
            type="email"
            autoComplete="email"
            placeholder={copy.form.emailPlaceholder}
            {...form.register('email')}
          />
        </Field>

        {showGuests && (
          <Field
            label={copy.form.guests}
            hint={copy.form.optional}
            {...(form.formState.errors.guests === undefined
              ? {}
              : { error: copy.form.errors.guests })}
          >
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={60}
              placeholder={copy.form.guestsPlaceholder}
              {...form.register('guests')}
            />
          </Field>
        )}
      </div>

      {/*
        Two questions, not one row of five chips.

        All five used to be independent toggles, so «Готовый тур», «Свой маршрут» and «Только
        отель» could be on together — three answers to one question, held at once. The first
        three are now a single choice and the other two stay free, because a visa is something
        you need *as well as* a trip. The grouping itself lives in `contracts`, so the rule is
        one list rather than a convention each form remembers.

        Codes throughout, never the labels beside them: a lead filed under «Виза» could not be
        read once the page is Turkish, and a chip could not be renamed without rewriting what
        people asked for. Decision D-10.
      */}
      {showTopics && (
        <Controller
          control={form.control}
          name="topics"
          render={({ field }) => {
            const services = field.value.filter((code) =>
              (LEAD_SERVICE_TOPICS as readonly string[]).includes(code),
            );
            const trip = field.value.find((code) =>
              (LEAD_TRIP_TOPICS as readonly string[]).includes(code),
            );

            return (
              <div className="mt-6 flex flex-col gap-5">
                <RadioChipGroup
                  name="lead-trip-kind"
                  legend={copy.form.tripKind}
                  options={LEAD_TRIP_TOPICS.map((code) => ({
                    value: code,
                    label: copy.topics[code],
                  }))}
                  value={trip ?? ''}
                  onValueChange={(value) => {
                    // The chosen kind replaces whichever was there; the services ride along
                    // untouched, which is the whole point of keeping them in a second group.
                    field.onChange([value, ...services]);
                  }}
                />

                <fieldset className="m-0 border-0 p-0">
                  <legend className="mb-3 font-bold uppercase text-label text-muted">
                    {copy.form.services}
                  </legend>
                  <div className="flex flex-wrap gap-[10px]">
                    {LEAD_SERVICE_TOPICS.map((code) => {
                      const chosen = services.includes(code);
                      return (
                        <Chip
                          key={code}
                          variant="tint"
                          active={chosen}
                          onClick={() => {
                            const next = chosen
                              ? services.filter((value) => value !== code)
                              : [...services, code];
                            field.onChange(trip === undefined ? next : [trip, ...next]);
                          }}
                        >
                          {copy.topics[code]}
                        </Chip>
                      );
                    })}
                  </div>
                </fieldset>
              </div>
            );
          }}
        />
      )}

      <Field
        label={copy.form.message}
        hint={copy.form.optional}
        className="mt-6"
        {...(form.formState.errors.message === undefined
          ? {}
          : { error: copy.form.errors.message })}
      >
        <Textarea placeholder={copy.form.messagePlaceholder} {...form.register('message')} />
      </Field>

      {/*
        The honeypot — anti-spam layer two.

        Off-screen rather than `display: none`, because a field that is not rendered is a field
        many bots skip. `aria-hidden` and `tabindex="-1"` keep it away from anybody using a
        keyboard or a screen reader, and `autocomplete="off"` stops a browser from helpfully
        filling it in and getting a genuine visitor silently dropped.
      */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-px w-px overflow-hidden">
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          // Не заполняйте это поле.
          {...form.register(HONEYPOT_FIELD)}
        />
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

      <FormError className="mt-5">{failed ? failure : undefined}</FormError>

      <div className="mt-7 flex flex-wrap items-center gap-5">
        <Button type="submit" busy={mutation.isPending} busyLabel={copy.form.sending}>
          {copy.form.submit}
        </Button>
        <p className="text-bodySm font-light text-muted">{copy.form.replyNote}</p>
      </div>
    </form>
  );
}
