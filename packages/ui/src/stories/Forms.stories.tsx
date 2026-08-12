import { type Meta, type StoryObj } from '@storybook/react';
import { useState } from 'react';

import { Button } from '../components/Button';
import { Checkbox } from '../components/Checkbox';
import { Field } from '../components/Field';
import { FormError } from '../components/FormError';
import { Input, Select, Textarea } from '../components/Input';
import { RadioChipGroup } from '../components/RadioChipGroup';

const meta: Meta = { title: 'Forms/Controls' };
export default meta;
type Story = StoryObj;

const TOPICS = [
  { value: 'custom', label: 'Свой маршрут' },
  { value: 'classic', label: 'Классика' },
  { value: 'nature', label: 'Природа' },
  { value: 'history', label: 'История' },
];

/**
 * The contact form, as the design draws it and as the handoff does not build it.
 *
 * There is no `<form>` anywhere in the package: the fields have no labels bound to them, the
 * consent box is a `<span>` and the submit button is an `<a href="#">`.
 */
export const ContactForm: Story = {
  render: function ContactFormStory() {
    const [topic, setTopic] = useState('custom');

    return (
      <form
        className="flex max-w-[640px] flex-col gap-5 rounded-panel border border-line bg-surface p-11"
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <div className="grid grid-cols-2 gap-4 mob:grid-cols-1">
          <Field label="Имя" required>
            <Input name="name" placeholder="Имя и фамилия" autoComplete="name" />
          </Field>
          <Field label="Телефон" required hint="Перезвоним в течение 15 минут">
            <Input name="phone" type="tel" placeholder="+993 12 456 789" autoComplete="tel" />
          </Field>
          <Field label="E-mail">
            <Input name="email" type="email" placeholder="you@example.com" autoComplete="email" />
          </Field>
          <Field label="Гостей">
            <Select name="guests" defaultValue="2">
              <option value="1">1 взрослый</option>
              <option value="2">2 взрослых</option>
              <option value="4">4 взрослых</option>
            </Select>
          </Field>
        </div>

        <RadioChipGroup
          name="topic"
          legend="Интересует"
          options={TOPICS}
          value={topic}
          onValueChange={setTopic}
        />

        <Field label="Комментарий">
          <Textarea name="comment" placeholder="Куда хотите поехать и что важно учесть" />
        </Field>

        <Checkbox name="consent">
          Согласен на обработку персональных данных и получение ответа по указанным контактам
        </Checkbox>

        <Button type="submit" size="md">
          Отправить заявку
        </Button>
      </form>
    );
  },
};

/** Everything wrong at once, which is the state the handoff has no drawing for at all. */
export const Invalid: Story = {
  render: () => (
    <div className="flex max-w-[640px] flex-col gap-5 rounded-panel border border-line bg-surface p-11">
      <FormError>Не удалось отправить заявку. Попробуйте ещё раз через минуту.</FormError>

      <Field label="Телефон" required error="Введите номер в формате +993 6X XXXXXX">
        <Input name="phone" defaultValue="65-123" />
      </Field>

      <Field label="Паспорт" required hint="Как в документе" error="Обязательное поле">
        <Input name="passport" />
      </Field>

      <RadioChipGroup
        name="room"
        legend="Тип номера"
        required
        error="Выберите тип номера"
        options={[
          { value: 'double', label: 'Двухместный' },
          { value: 'triple', label: 'Трёхместный' },
        ]}
      />

      <Checkbox name="consent" error="Без согласия отправка невозможна">
        Согласен на обработку персональных данных
      </Checkbox>
    </div>
  ),
};

/** The same controls on the dark signup card, with no component told anything about it. */
export const OnDark: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => (
    <div data-surface="dark" className="-m-10 bg-dark-alt p-10 [--c-bg:var(--c-dark-alt)]">
      <div className="flex max-w-[560px] flex-col gap-5">
        <Field label="Ady we familiýasy" required>
          <Input name="name" placeholder="Meret Aýdogdyýew" />
        </Field>
        <Field label="Telefon" required>
          <Input name="phone" placeholder="+993 65 123 456" />
        </Field>
        <Field label="Bellik">
          <Textarea name="note" placeholder="Mahram, saglyk aýratynlyklary" />
        </Field>
        <Checkbox name="consent">Şahsy maglumatlarymy gaýtadan işlemäge razylyk berýärin</Checkbox>
        <Button size="md">Ýazylmak</Button>
      </div>
    </div>
  ),
};
