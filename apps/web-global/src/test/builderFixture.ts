import { type BuilderConfigResponse, DEFAULT_PRICING_RULES } from '@charva/contracts';

/**
 * A builder configuration shaped like the one the API serves.
 *
 * Trimmed to three options per step — the arithmetic does not care how many there are — but the
 * codes, the numeric values and the rates are the seeded ones, so a test that asserts `1 296 $`
 * is asserting the same number a visitor sees.
 */
export function builderConfig(
  overrides: Partial<BuilderConfigResponse> = {},
): BuilderConfigResponse {
  return {
    rules: DEFAULT_PRICING_RULES,
    steps: [
      {
        code: 'dest',
        kind: 'multi',
        title: 'Куда хотите поехать?',
        hint: 'можно выбрать несколько',
        railLabel: 'Направление',
        isRequired: false,
        options: [
          opt('dest_ashgabat', 'Ашхабад', 'Белый мрамор, музеи'),
          opt('dest_darvaza', 'Дарваза', 'Горящий кратер'),
          opt('dest_merv', 'Мары / Мерв', 'Древний Шёлковый путь'),
        ],
      },
      {
        code: 'dates',
        kind: 'single',
        title: 'Сколько дней в поездке?',
        hint: '',
        railLabel: 'Даты',
        isRequired: false,
        options: [
          opt('nights_3', '3 дня', 'Короткий визит', { numericValue: 3 }),
          opt('nights_7', '7 дней', 'Города + пустыня', { numericValue: 7 }),
          opt('nights_14', '14 дней', 'С Каспием', { numericValue: 14 }),
        ],
      },
      {
        code: 'hotel',
        kind: 'single',
        title: 'Где будете жить?',
        hint: '',
        railLabel: 'Отель',
        isRequired: false,
        options: [
          opt('hotel_3star', '3 ★', 'Просто и чисто', {
            priceModifierMinor: 4600,
            modifierType: 'per_night',
          }),
          opt('hotel_4star', '4 ★', 'Комфорт', {
            priceModifierMinor: 7800,
            modifierType: 'per_night',
          }),
          opt('hotel_5star', '5 ★', 'Премиум', {
            priceModifierMinor: 14_500,
            modifierType: 'per_night',
          }),
        ],
      },
      {
        code: 'food',
        kind: 'multi',
        title: 'Что предпочитаете есть?',
        hint: '',
        railLabel: 'Питание',
        isRequired: false,
        options: [opt('food_halal', 'Халяль', ''), opt('food_national', 'Национальная кухня', '')],
      },
      {
        code: 'transport',
        kind: 'single',
        title: 'На чём передвигаемся?',
        hint: '',
        railLabel: 'Транспорт',
        isRequired: false,
        options: [opt('transport_car', 'Легковой авто', 'До 3 человек')],
      },
      {
        code: 'activities',
        kind: 'multi',
        title: 'Что хотите посмотреть?',
        hint: '',
        railLabel: 'Активности',
        isRequired: false,
        options: [
          opt('act_city_tour', 'Экскурсии по городу', ''),
          opt('act_desert_camp', 'Пустыня и кемпинг', ''),
        ],
      },
      {
        code: 'people',
        kind: 'single',
        title: 'Сколько вас будет?',
        hint: '',
        railLabel: 'Человек',
        isRequired: false,
        options: [
          opt('pax_2', '2', 'Пара', { numericValue: 2 }),
          // «6–10» means eight and «10+» means twelve — the numbers question Q-10 asks about.
          opt('pax_6_10', '6–10', 'Небольшая группа', { numericValue: 8 }),
        ],
      },
      {
        code: 'guide',
        kind: 'single',
        title: 'Нужен гид?',
        hint: '',
        railLabel: 'Гид',
        isRequired: false,
        options: [opt('guide_ru', 'Русский', '')],
      },
      {
        code: 'final',
        kind: 'form',
        title: 'Проверьте тур и оставьте контакты',
        hint: '',
        railLabel: 'Заявка',
        isRequired: true,
        options: [],
      },
    ],
    ...overrides,
  };
}

function opt(
  code: string,
  name: string,
  note: string,
  extra: Partial<BuilderConfigResponse['steps'][number]['options'][number]> = {},
): BuilderConfigResponse['steps'][number]['options'][number] {
  return {
    code,
    name,
    note,
    numericValue: null,
    priceModifierMinor: null,
    modifierType: 'none',
    ...extra,
  };
}
