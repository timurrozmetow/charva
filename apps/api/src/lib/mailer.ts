import { createTransport, type Transporter } from 'nodemailer';

import { type Env } from '../env';

/**
 * Notification of a submitted form, by e-mail.
 *
 * Question Q-11 was open from phase 3 to phase 9 and decision D-50 kept this file from being
 * written: both forms worked completely — five anti-spam layers, a phone in E.164, an encrypted
 * passport, a price recalculated on the server, a row in the database — but nothing told anybody
 * a form had been filled in, because nobody had chosen a channel and «send it somewhere» is code
 * that ends up configured to a stranger's inbox. The owner chose SMTP on 2026-08-23.
 *
 * Three properties, and each of them is the point rather than a detail.
 *
 * **It never fails a submission.** A lead that reached the database is a lead the business has,
 * whether or not Gmail accepted the message. Sending happens after the row is written and after
 * the reply is sent; a rejection is logged and goes no further. The inbox in the panel is still
 * the authority — this is a nudge towards it (D-50).
 *
 * **It never carries a passport number.** The whole reason that column is sealed with AES-256-GCM
 * and read only through an audited action (D-18) is that it must not sit in places nobody is
 * watching, and an inbox is the least watched place there is. The message says a passport was
 * given, not what it says.
 *
 * **It is off unless fully configured.** Host, credentials and a destination, or nothing at all:
 * a half-configured mailer that throws on every submission is worse than one that was never
 * turned on, because it looks like a broken form.
 */

export interface LeadNotification {
  id: number;
  kind: string;
  name: string;
  phone: string;
  email: string | null;
  guests: number | null;
  topics: string[] | null;
  message: string | null;
  locale: string;
  /** Minor units and currency, when a builder selection was priced. */
  quote: { totalMinor: number; currency: string } | null;
}

export interface SignupNotification {
  id: number;
  fullName: string;
  phone: string;
  peopleCount: number;
  roomType: string | null;
  comment: string | null;
  locale: string;
  /** Whether one was given — never the number itself. */
  hasPassport: boolean;
  /** The SQL datetime string from `umrah_trips`, in UTC. */
  departsAt: string | null;
}

export interface Mailer {
  readonly enabled: boolean;
  lead(notification: LeadNotification): Promise<void>;
  signup(notification: SignupNotification): Promise<void>;
  close(): Promise<void>;
}

/** Somewhere to write to that is not the console, so tests can assert and production can log. */
export interface MailerLogger {
  info: (details: Record<string, unknown>, message: string) => void;
  warn: (details: Record<string, unknown>, message: string) => void;
  error: (details: Record<string, unknown>, message: string) => void;
}

const DISABLED: Mailer = {
  enabled: false,
  lead: () => Promise.resolve(),
  signup: () => Promise.resolve(),
  close: () => Promise.resolve(),
};

export function createMailer(env: Env, logger: MailerLogger): Mailer {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, EMAIL_USER, EMAIL_PASS, NOTIFICATION_EMAIL } = env;

  if (
    SMTP_HOST === undefined ||
    EMAIL_USER === undefined ||
    EMAIL_PASS === undefined ||
    NOTIFICATION_EMAIL === undefined
  ) {
    logger.info(
      { smtpHost: SMTP_HOST ?? null, notify: NOTIFICATION_EMAIL ?? null },
      'mailer off: SMTP_HOST, EMAIL_USER, EMAIL_PASS and NOTIFICATION_EMAIL are all required',
    );
    return DISABLED;
  }

  const transport = createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    // Gmail on 587 is STARTTLS, which is `secure: false` plus an upgrade — not «no TLS». The
    // name is nodemailer's and it means «TLS from the first byte», which is port 465.
    secure: SMTP_SECURE,
    auth: {
      user: EMAIL_USER,
      // Google prints an app password in four groups of four; the spaces are presentation and
      // the server does not want them. Stripping here means the value can be pasted as shown.
      pass: EMAIL_PASS.replace(/\s+/g, ''),
    },
    // One connection reused rather than a handshake per submission. On a small VPS the TLS
    // handshake is the expensive half of sending one short message.
    pool: true,
    maxConnections: 1,
    // A submission is answered before this runs, so a slow relay costs nothing a visitor sees —
    // but it must not hold a socket open all afternoon either.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });

  const send = async (subject: string, text: string, replyTo: string | undefined) => {
    try {
      const info = await transport.sendMail({
        from: `Charva <${EMAIL_USER}>`,
        to: NOTIFICATION_EMAIL,
        subject,
        text,
        // The visitor's own address when they left one, so «reply» answers the person rather
        // than the robot that sent the notification.
        ...(replyTo === undefined ? {} : { replyTo }),
      });
      logger.info({ messageId: info.messageId, subject }, 'notification sent');
    } catch (error) {
      // Deliberately swallowed. See the note at the top: the row is already stored, and the
      // panel is where enquiries are actually read.
      logger.error(
        { err: error instanceof Error ? error.message : String(error), subject },
        'notification not sent',
      );
    }
  };

  const line = (label: string, value: string | number | null | undefined): string =>
    value === null || value === undefined || value === '' ? '' : `${label}: ${String(value)}\n`;

  return {
    enabled: true,

    lead: (n) =>
      send(
        `Заявка №${String(n.id)} — ${n.name}`,
        [
          'Новая заявка с charva-travel.com (Global).\n',
          line('Имя', n.name),
          line('Телефон', n.phone),
          line('E-mail', n.email),
          line('Тип', n.kind),
          line('Гостей', n.guests),
          line('Интересует', n.topics?.join(', ') ?? null),
          n.quote === null
            ? ''
            : line(
                'Расчёт сборщика',
                `${(n.quote.totalMinor / 100).toFixed(2)} ${n.quote.currency}`,
              ),
          line('Язык страницы', n.locale),
          n.message === null || n.message === '' ? '' : `\nСообщение:\n${n.message}\n`,
          '\nОткрыть во «Входящих»: https://admin.charva-travel.com/inbox/leads\n',
        ].join(''),
        n.email ?? undefined,
      ),

    signup: (n) =>
      send(
        `Запись на умру №${String(n.id)} — ${n.fullName}`,
        [
          'Новая запись на умру с umra.charva-travel.com.\n',
          line('Имя', n.fullName),
          line('Телефон', n.phone),
          line('Человек', n.peopleCount),
          line('Тип номера', n.roomType),
          // Never the number. D-18: it is sealed in the column and read only through an
          // audited action, and an inbox is not one.
          line('Паспорт', n.hasPassport ? 'указан (смотреть в панели)' : 'не указан'),
          line('Язык страницы', n.locale),
          line('Вылет', n.departsAt === null ? null : n.departsAt.slice(0, 10)),
          n.comment === null || n.comment === '' ? '' : `\nКомментарий:\n${n.comment}\n`,
          '\nОткрыть во «Входящих»: https://admin.charva-travel.com/inbox/signups\n',
        ].join(''),
        undefined,
      ),

    close: async () => {
      (transport as Transporter).close();
      await Promise.resolve();
    },
  };
}
