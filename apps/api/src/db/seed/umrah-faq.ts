import { and, eq } from 'drizzle-orm';

import { type Database } from '../client';
import * as t from '../schema';

/**
 * The questions a pilgrim asks before handing over a passport.
 *
 * The Umrah homepage has had an accordion for these since phase 6 — written, styled, with the
 * first item opened by default — and `faqs` has never held a single row for that site. Six rows
 * exist for Global and none for the site where somebody is deciding to pay for a pilgrimage and
 * give up their passport number. The section simply did not render, which is why nobody noticed.
 *
 * **Every answer is a restatement of something the site already says.** The package page lists
 * what the trip includes, which documents to bring, how the hotels sit relative to the Haram,
 * how payment is staged and how large the group is; `umrah_trips` holds the dates. An FAQ is
 * that same information arranged as questions, and arranging it that way is the whole value —
 * a person with a question does not read a specification looking for the sentence that answers
 * it.
 *
 * Two things are deliberately *not* answered.
 *
 * **The price.** It is not on this site by decision — it is not even in the public response
 * schema (D-12) — so an FAQ entry naming one would be the one place it leaked. The answer says
 * that an operator quotes, which is true and is also what the enquiry form is for.
 *
 * **Anything the Saudi authorities decide.** Vaccination and entry rules change, this company
 * is not the authority on them, and a confident wrong answer costs somebody a flight. What the
 * site does state is what it requires from the pilgrim — a passport, four photographs and a
 * vaccination certificate — so that is what the answer says, with the rest directed at a
 * person.
 *
 * Turkmen first, because this site's reference language is Turkmen and its readers are Turkmen
 * (D-70). Russian beside it.
 */

interface Entry {
  question: { tm: string; ru: string };
  answer: { tm: string; ru: string };
}

const ENTRIES: Entry[] = [
  {
    question: {
      tm: 'Umra sapary näçe gün dowam edýär?',
      ru: 'Сколько длится поездка?',
    },
    answer: {
      tm: 'On gün: Mekgede bäş gün, Medinede dört gün, galany ýolda. Indiki toparyň takyk senesi baş sahypada — ugramak we dolanmak güni bilen görkezilýär.',
      ru: 'Десять дней: пять в Мекке, четыре в Медине, остальное дорога. Точные даты ближайшей группы — на главной странице, с днём вылета и возвращения.',
    },
  },
  {
    question: {
      tm: 'Bahasy näçe?',
      ru: 'Сколько стоит?',
    },
    answer: {
      tm: 'Bahany saýtda görkezmeýäris: ol topara, otagyň görnüşine we uçar biletiniň şol wagtky bahasyna bagly. Arza galdyryň ýa-da jaň ediň — häzirki bahany aýdarys we näme girýändigini düşündireris.',
      ru: 'Цену на сайте не публикуем: она зависит от группы, типа номера и текущей стоимости авиабилета. Оставьте заявку или позвоните — назовём актуальную и объясним, что в неё входит.',
    },
  },
  {
    question: {
      tm: 'Baha näme girýär?',
      ru: 'Что входит в поездку?',
    },
    answer: {
      tm: 'Aşgabat — Jidda — Aşgabat uçar bileti, umra wizasy we ähli resminamalar, Mekgede we Medinede 4 ★ otel, gündelik üç wagt nahar, Saud Arabystanynda ähli transfer we awtobus, türkmen we rus dilli ýolbaşçy, şeýle hem ihram we ziýarat toplumy.',
      ru: 'Авиабилет Ашхабад — Джидда — Ашхабад, виза на умру и все документы, отель 4 ★ в Мекке и Медине, трёхразовое питание, все трансферы и автобус в Саудовской Аравии, руководитель со знанием туркменского и русского, а также ихрам и набор для зиярата.',
    },
  },
  {
    question: {
      tm: 'Haýsy resminamalar gerek?',
      ru: 'Какие документы нужны?',
    },
    answer: {
      tm: 'Passport, dört surat we sanjym kepilnamasy. Resminamalary ugramakdan öň tabşyrmaly — haçan we nirä tabşyrmalydygyny ýolbaşçymyz aýdyň aýdar. Saud tarapynyň talaplary üýtgäp durýar, şonuň üçin sanawy arza galdyranyňyzdan soň gaýtadan tassyklaýarys.',
      ru: 'Паспорт, четыре фотографии и справка о прививке. Документы сдаются до вылета — когда и куда именно, скажет наш руководитель. Требования саудовской стороны меняются, поэтому после заявки мы подтверждаем список ещё раз.',
    },
  },
  {
    question: {
      tm: 'Otel nirede ýerleşýär?',
      ru: 'Где мы живём в Мекке и Медине?',
    },
    answer: {
      tm: 'Mekgede Haremden 400 metr, Medinede Metjidi Nebewiden 300 metr. Ikisi-de 4 ★. Otag 2–3 adamlyk; isleseňiz bir adamlyk otag hem mümkin.',
      ru: 'В Мекке — в 400 метрах от Харама, в Медине — в 300 метрах от Мечети Пророка. Оба отеля 4 ★. Номер на 2–3 человека; при желании возможен одноместный.',
    },
  },
  {
    question: {
      tm: 'Töleg nähili amala aşyrylýar?',
      ru: 'Как происходит оплата?',
    },
    answer: {
      tm: 'Iki tapgyrda. Öňünden töleg otel we uçar bileti bronlaýar, galan bölegi bolsa ugramakdan on gün öň dolulygyna tölenýär. Arza ýa-da ofisde şertnama bilen topar sanawynda ýeriňiz bellenilýär.',
      ru: 'В два этапа. Предоплата бронирует отель и авиабилет, остаток вносится полностью за десять дней до вылета. Место в списке группы закрепляется заявкой или договором в офисе.',
    },
  },
  {
    question: {
      tm: 'Toparda näçe adam bolýar we kim ugradýar?',
      ru: 'Сколько человек в группе и кто сопровождает?',
    },
    answer: {
      tm: 'Kyrk bäş adam, ýolbaşçy bilen bilelikde. Ýolbaşçy türkmen we rus dillerinde gepleýär we ähli sapar dowamynda, gije-gündiziň dowamynda topar bilen bolýar.',
      ru: 'Сорок пять человек вместе с руководителем. Руководитель говорит по-туркменски и по-русски и находится с группой всю поездку, круглосуточно.',
    },
  },
  {
    question: {
      tm: 'Ýazylyş haçan ýapylýar?',
      ru: 'Когда закрывается запись?',
    },
    answer: {
      tm: 'Ugramakdan iki hepde öň — şol wagtdan resminamalar taýýarlanyp başlanýar. Boş ýerler we ýazylyşyň ýapylýan senesi baş sahypada görkezilýär; ýerler ozal gutarsa, indiki topara ýazylyp bilersiňiz.',
      ru: 'За две недели до вылета — с этого момента начинается оформление документов. Свободные места и дата закрытия записи показаны на главной; если места закончатся раньше, можно записаться в следующую группу.',
    },
  },
];

/**
 * Insert what is missing, by question.
 *
 * Idempotent for the same reason the journal is: it runs from the seeds on a fresh database and
 * from `db:content` against the live one, where nothing may be deleted and an editor's rewrite
 * must survive. Matching on the Turkmen question does that — an entry reworded in the admin
 * counts as a different one and is simply added, which is a visible outcome rather than a silent
 * overwrite of somebody's text.
 */
export async function seedUmrahFaq(db: Database): Promise<number> {
  const existing = await db
    .select({ question: t.faqs.question })
    .from(t.faqs)
    .where(eq(t.faqs.site, 'umrah'));

  const seen = new Set(existing.map((row) => row.question.tm ?? ''));

  const values = ENTRIES.filter((entry) => !seen.has(entry.question.tm)).map((entry, index) => ({
    site: 'umrah' as const,
    question: entry.question,
    answer: entry.answer,
    isPublished: true,
    sortOrder: seen.size + index,
  }));

  if (values.length > 0) await db.insert(t.faqs).values(values);
  return values.length;
}

/** How many are published right now — for the script to report something true. */
export async function countUmrahFaq(db: Database): Promise<number> {
  const rows = await db
    .select({ id: t.faqs.id })
    .from(t.faqs)
    .where(and(eq(t.faqs.site, 'umrah'), eq(t.faqs.isPublished, true)));
  return rows.length;
}
