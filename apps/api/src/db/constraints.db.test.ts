import mysql from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { assertResettable, schemaNameFrom } from './reset';
import { TEST_DATABASE_URL } from './test-setup';

/**
 * The rules are the database's, not the application's.
 *
 * Every assertion here is a statement the API could send, and every one that MySQL rejects is a
 * rule that survives a bug, a script, a manual `UPDATE` from a console and a future developer
 * who has not read this file. That is the difference between a constraint and a convention, and
 * it is the acceptance criterion for this phase.
 */

let connection: mysql.Connection;

/** True when MySQL refused the statement. */
async function rejects(sql: string, params: unknown[] = []): Promise<boolean> {
  try {
    await connection.query(sql, params);
    return false;
  } catch {
    return true;
  }
}

const TOUR =
  'INSERT INTO tours (slug, title, category, days, cities, price_from_minor) VALUES (?, ?, ?, ?, ?, ?)';
const HOTEL =
  'INSERT INTO hotels (slug, name, city, category, stars, price_from_minor) VALUES (?, ?, ?, ?, ?, ?)';
const TRIP =
  'INSERT INTO umrah_trips (depart_at, return_at, seats_total, seats_taken, duration_days, is_current) VALUES (?, ?, ?, ?, ?, ?)';

beforeAll(async () => {
  connection = await mysql.createConnection({ uri: TEST_DATABASE_URL, timezone: 'Z' });
});

afterAll(async () => {
  await connection.end();
});

beforeEach(async () => {
  for (const table of ['tours', 'hotels', 'umrah_trips', 'reviews', 'ziyarat_places', 'media']) {
    await connection.query(`DELETE FROM \`${table}\``);
  }
});

describe('translatable columns', () => {
  it('rejects a language the site does not offer', async () => {
    // The reason JSON columns type cleanly at all (D-5): a Turkish string on an Umrah row would
    // render nowhere, and a German one on a Global row is simply a mistake.
    expect(await rejects(TOUR, ['a', '{"de":"Hallo"}', 'classic', 3, 2, 100])).toBe(true);
    expect(
      await rejects('INSERT INTO ziyarat_places (slug, name, city) VALUES (?, ?, ?)', [
        'b',
        '{"tr":"Mescid"}',
        'mekge',
      ]),
    ).toBe(true);
  });

  it('requires the site default language', async () => {
    expect(await rejects(TOUR, ['c', '{"en":"Tour"}', 'classic', 3, 2, 100])).toBe(true);
    expect(await rejects(TOUR, ['d', '{"ru":"Тур"}', 'classic', 3, 2, 100])).toBe(false);
  });

  it('rejects a bare string where an object belongs', async () => {
    expect(await rejects(TOUR, ['e', '"Тур"', 'classic', 3, 2, 100])).toBe(true);
  });

  it('accepts a partially translated row, which is the normal state', async () => {
    // Months of it, realistically — question Q-3. A schema that demanded all three languages
    // would mean nothing could be published until the translator finished.
    expect(await rejects(TOUR, ['f', '{"ru":"Тур","en":"Tour"}', 'classic', 3, 2, 100])).toBe(
      false,
    );
  });

  it('accepts NULL in an optional translatable column', async () => {
    expect(
      await rejects(
        'INSERT INTO tours (slug, title, summary, category, days, cities, price_from_minor) VALUES (?, ?, NULL, ?, ?, ?, ?)',
        ['g', '{"ru":"Тур"}', 'classic', 3, 2, 100],
      ),
    ).toBe(false);
  });
});

describe('hotels', () => {
  it('will not let a camp have a star rating', async () => {
    // The contradiction the column pair exists for: the prototype shows the yurt camp as «3★»
    // on its card and «Кемп» in the filter, two facts about one row that cannot both be true.
    expect(
      await rejects(HOTEL, ['camp', '{"ru":"Лагерь"}', '{"ru":"Дарваза"}', 'camp', 3, 100]),
    ).toBe(true);
    expect(
      await rejects(
        'INSERT INTO hotels (slug, name, city, category, price_from_minor) VALUES (?, ?, ?, ?, ?)',
        ['camp2', '{"ru":"Лагерь"}', '{"ru":"Дарваза"}', 'camp', 100],
      ),
    ).toBe(false);
  });

  it('will not let a hotel be starless', async () => {
    expect(
      await rejects(
        'INSERT INTO hotels (slug, name, city, category, price_from_minor) VALUES (?, ?, ?, ?, ?)',
        ['h1', '{"ru":"Отель"}', '{"ru":"Ашхабад"}', 'hotel', 100],
      ),
    ).toBe(true);
  });

  it('keeps stars inside the range the catalogue uses', async () => {
    expect(
      await rejects(HOTEL, ['h2', '{"ru":"Отель"}', '{"ru":"Ашхабад"}', 'hotel', 2, 100]),
    ).toBe(true);
    expect(
      await rejects(HOTEL, ['h3', '{"ru":"Отель"}', '{"ru":"Ашхабад"}', 'hotel', 5, 100]),
    ).toBe(false);
  });
});

describe('umrah_trips', () => {
  it('refuses more pilgrims than places', async () => {
    // The seats bar divides by `seats_total`; a row where taken exceeds total renders a bar
    // past 100% and a caption that reads as a mistake to every visitor.
    expect(await rejects(TRIP, ['2026-09-18 06:00:00', '2026-09-28 06:00:00', 45, 50, 10, 0])).toBe(
      true,
    );
    expect(await rejects(TRIP, ['2026-09-18 06:00:00', '2026-09-28 06:00:00', 45, -1, 10, 0])).toBe(
      true,
    );
  });

  it('refuses a return before the departure', async () => {
    expect(await rejects(TRIP, ['2026-09-28 06:00:00', '2026-09-18 06:00:00', 45, 0, 10, 0])).toBe(
      true,
    );
  });

  it('allows exactly one current departure', async () => {
    // MySQL has no partial index, so the flag is projected into a generated column that is
    // NULL when unset — and NULLs do not collide in a UNIQUE key. Two current trips would
    // leave the countdown, the seats bar and the signup form describing different groups.
    expect(await rejects(TRIP, ['2026-09-18 06:00:00', '2026-09-28 06:00:00', 45, 33, 10, 1])).toBe(
      false,
    );
    expect(await rejects(TRIP, ['2027-01-10 06:00:00', '2027-01-20 06:00:00', 45, 0, 10, 1])).toBe(
      true,
    );
    // Any number of trips may exist as long as only one is flagged.
    expect(await rejects(TRIP, ['2027-01-10 06:00:00', '2027-01-20 06:00:00', 45, 0, 10, 0])).toBe(
      false,
    );
  });
});

describe('ranges', () => {
  it('keeps a rating between one and five', async () => {
    const review = 'INSERT INTO reviews (author_name, rating, body) VALUES (?, ?, ?)';
    expect(await rejects(review, ['X', 7, '{"ru":"текст"}'])).toBe(true);
    expect(await rejects(review, ['X', 0, '{"ru":"текст"}'])).toBe(true);
    expect(await rejects(review, ['X', 5, '{"ru":"текст"}'])).toBe(false);
  });

  it('keeps a focal point inside the frame', async () => {
    const insert =
      'INSERT INTO media (storage_key, mime, size_bytes, checksum, focal_x, focal_y) VALUES (?, ?, ?, ?, ?, ?)';
    expect(await rejects(insert, ['a.webp', 'image/webp', 100, 'aa', 1500, 500])).toBe(true);
    expect(await rejects(insert, ['b.webp', 'image/webp', 100, 'bb', 250, 500])).toBe(false);
  });

  it('refuses a zero-byte upload', async () => {
    expect(
      await rejects(
        'INSERT INTO media (storage_key, mime, size_bytes, checksum) VALUES (?, ?, ?, ?)',
        ['c.webp', 'image/webp', 0, 'cc'],
      ),
    ).toBe(true);
  });
});

describe('uniqueness', () => {
  it('refuses the same file twice', async () => {
    // The same photograph will be attached to a tour, a gallery tile and an OG card; storing
    // it three times fills a VPS disk that also has to hold transcoded video.
    const insert =
      'INSERT INTO media (storage_key, mime, size_bytes, checksum) VALUES (?, ?, ?, ?)';
    expect(await rejects(insert, ['d.webp', 'image/webp', 100, 'same'])).toBe(false);
    expect(await rejects(insert, ['e.webp', 'image/webp', 100, 'same'])).toBe(true);
  });

  it('refuses a duplicate slug', async () => {
    expect(await rejects(TOUR, ['dup', '{"ru":"Тур"}', 'classic', 3, 2, 100])).toBe(false);
    expect(await rejects(TOUR, ['dup', '{"ru":"Другой"}', 'nature', 5, 3, 200])).toBe(true);
  });
});

describe('strict mode', () => {
  it('refuses a string too long for its column instead of truncating it', async () => {
    // Without STRICT_TRANS_TABLES this is a warning and a silently shortened value, which for
    // a slug means a broken URL that looks fine in the admin.
    expect(await rejects(TOUR, ['x'.repeat(200), '{"ru":"Тур"}', 'classic', 3, 2, 100])).toBe(true);
  });
});

describe('the reset guard', () => {
  it('refuses to drop a schema belonging to another project', () => {
    // Seven other databases live on this machine. `DROP DATABASE` aimed at one of them by a
    // stale DATABASE_URL is not recoverable, so the prefix check runs before anything else.
    for (const schema of ['silkgrain', 'bakar', 'directorhub_test', 'mysql', '']) {
      expect(() => {
        assertResettable(schema, 'charva');
      }).toThrow();
    }
  });

  it('allows the project own schemas', () => {
    expect(() => {
      assertResettable('charva', 'charva');
    }).not.toThrow();
    expect(() => {
      assertResettable('charva_test', 'charva');
    }).not.toThrow();
  });

  it('reads the schema name out of the URL', () => {
    expect(schemaNameFrom('mysql://root:pw@127.0.0.1:3308/charva_test')).toBe('charva_test');
  });
});
