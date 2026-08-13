import { and, count, eq, sum } from 'drizzle-orm';

import { type Database } from '../../db/client';
import * as t from '../../db/schema';

/**
 * The six figures the chooser prints under its two halves.
 *
 * Every one of them is a literal in the prototype — «32 Маршрута», «46 Отеля», «68 Групп» —
 * printed above nine rows of data that say otherwise. Counted here (D-6), which today answers
 * nine and nine, and question Q-5 asks the owner whether to fill the catalogue or accept that.
 */
export async function choiceStats(db: Database): Promise<{
  global: { tours: number; hotels: number; guestsPerYear: number | null };
  umrah: { groups: number; pilgrims: number };
}> {
  const [tours, hotels, groups, override] = await Promise.all([
    db.select({ value: count() }).from(t.tours).where(eq(t.tours.isPublished, true)),
    db.select({ value: count() }).from(t.hotels).where(eq(t.hotels.isPublished, true)),
    db
      .select({ value: count(), pilgrims: sum(t.umrahGroups.pilgrimsCount) })
      .from(t.umrahGroups)
      .where(eq(t.umrahGroups.isPublished, true)),
    db
      .select()
      .from(t.settings)
      .where(and(eq(t.settings.site, 'global'), eq(t.settings.settingKey, 'stats')))
      .limit(1),
  ]);

  /*
   * The one figure nothing counts.
   *
   * «1 400+ Гостей в год» has no source in the schema: the system stores leads, not arrivals.
   * D-6 allows exactly this case — a marketing number becomes an explicit, named, editable
   * override rather than a literal in a component — so it is read from `settings` and is null
   * when nobody has set one. A component rendering nothing is honest; a component rendering
   * 1 400 because a designer typed it is not.
   */
  const settings = override[0]?.value as { guestsPerYear?: unknown } | undefined;
  const guests = settings?.guestsPerYear;

  return {
    global: {
      tours: tours[0]?.value ?? 0,
      hotels: hotels[0]?.value ?? 0,
      guestsPerYear: typeof guests === 'number' ? guests : null,
    },
    umrah: {
      groups: groups[0]?.value ?? 0,
      pilgrims: Number(groups[0]?.pilgrims ?? 0),
    },
  };
}
