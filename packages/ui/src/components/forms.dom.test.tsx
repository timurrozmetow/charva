import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Checkbox } from './Checkbox';
import { Field } from './Field';
import { FormError } from './FormError';
import { Input, Select, Textarea } from './Input';
import { RadioChipGroup } from './RadioChipGroup';

/**
 * The forms are the part of this project with no prototype behind it at all: the handoff has
 * no `<form>`, no controlled input, no validation, no submit and no error state. Every
 * assertion here is behaviour that has to be invented, which is exactly the behaviour that
 * needs a test.
 */

describe('Field wiring', () => {
  it('associates the label with the control, so clicking it focuses the field', async () => {
    const user = userEvent.setup();
    render(
      <Field label="Телефон">
        <Input />
      </Field>,
    );

    // Found *by its label* — which is what a screen reader does and what the handoff's
    // unassociated <span> labels make impossible.
    const input = screen.getByLabelText('Телефон');
    await user.click(screen.getByText('Телефон'));
    expect(input).toHaveFocus();
  });

  it('describes the control with its hint and its error at once', () => {
    render(
      <Field label="Паспорт" hint="Как в документе" error="Обязательное поле">
        <Input />
      </Field>,
    );

    const input = screen.getByLabelText(/Паспорт/);
    expect(input).toHaveAccessibleDescription('Как в документе Обязательное поле');
    expect(input).toBeInvalid();
  });

  it('marks the control required rather than only drawing an asterisk', () => {
    render(
      <Field label="Имя" required>
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText(/Имя/)).toBeRequired();
  });

  it('leaves a control valid when there is no error', () => {
    render(
      <Field label="Имя">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText('Имя');
    expect(input).toBeValid();
    expect(input).not.toHaveAttribute('aria-describedby');
  });

  it('lets an explicit prop win over the context', () => {
    render(
      <Field label="Имя" error="плохо">
        <Input aria-invalid={false} />
      </Field>,
    );
    expect(screen.getByLabelText('Имя')).toHaveAttribute('aria-invalid', 'false');
  });

  it('keeps a hidden label available to assistive technology', () => {
    render(
      <Field label="Поиск" hideLabel>
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText('Поиск')).toBeInTheDocument();
  });

  it('wires a textarea and a select the same way', () => {
    render(
      <>
        <Field label="Комментарий">
          <Textarea />
        </Field>
        <Field label="Гостей">
          <Select>
            <option value="1">1</option>
          </Select>
        </Field>
      </>,
    );
    expect(screen.getByLabelText('Комментарий').tagName).toBe('TEXTAREA');
    expect(screen.getByLabelText('Гостей').tagName).toBe('SELECT');
  });

  it('works outside a Field, for the controls that have no label of their own', () => {
    // The search bar on the Global homepage is three bare inputs with placeholders.
    render(<Input aria-label="Направление" placeholder="Куда" />);
    expect(screen.getByLabelText('Направление')).toBeInTheDocument();
  });
});

describe('Checkbox', () => {
  it('is a real checkbox that toggles from the keyboard', async () => {
    const user = userEvent.setup();
    render(<Checkbox name="consent">Согласен с обработкой данных</Checkbox>);

    const box = screen.getByRole('checkbox', { name: /Согласен/ });
    expect(box).not.toBeChecked();

    await user.tab();
    expect(box).toHaveFocus();
    await user.keyboard(' ');
    expect(box).toBeChecked();
  });

  it('toggles when the consent sentence itself is clicked', async () => {
    const user = userEvent.setup();
    render(<Checkbox name="consent">Согласен с обработкой данных</Checkbox>);

    await user.click(screen.getByText(/Согласен/));
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('carries a value into the form', () => {
    // The prototypes draw this as a <span>, so the one field with a legal meaning on the
    // whole site is never submitted at all.
    render(
      <form data-testid="form">
        <Checkbox name="consent" value="yes" defaultChecked>
          Согласен
        </Checkbox>
      </form>,
    );
    const form = screen.getByTestId<HTMLFormElement>('form');
    expect(new FormData(form).get('consent')).toBe('yes');
  });

  it('reports itself invalid when it carries an error', () => {
    render(
      <Checkbox name="consent" error="Нужно согласие">
        Согласен
      </Checkbox>,
    );
    expect(screen.getByRole('checkbox')).toBeInvalid();
  });
});

describe('RadioChipGroup', () => {
  const OPTIONS = [
    { value: 'single', label: 'Одноместный' },
    { value: 'double', label: 'Двухместный' },
    { value: 'triple', label: 'Трёхместный' },
  ];

  it('is a labelled group of radios, not a row of divs', () => {
    render(<RadioChipGroup name="room" legend="Тип номера" options={OPTIONS} />);

    expect(screen.getByRole('group', { name: 'Тип номера' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
  });

  it('moves between options with the arrow keys', async () => {
    // Free with real radios. With `<div onClick>` it is a day of work and a test nobody wrote.
    const user = userEvent.setup();
    render(
      <RadioChipGroup name="room" legend="Тип номера" options={OPTIONS} defaultValue="single" />,
    );

    await user.tab();
    expect(screen.getByRole('radio', { name: 'Одноместный' })).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('radio', { name: 'Двухместный' })).toBeChecked();
  });

  it('reports the chosen value by its code, never by its label', () => {
    // The label is translated; the code is what a price or a filter is keyed by.
    const onValueChange = vi.fn();
    render(
      <RadioChipGroup
        name="room"
        legend="Тип номера"
        options={OPTIONS}
        value="single"
        onValueChange={onValueChange}
      />,
    );

    screen.getByRole('radio', { name: 'Двухместный' }).click();
    expect(onValueChange).toHaveBeenCalledWith('double');
  });

  it('keeps the legend readable when the design has no room for it', () => {
    render(<RadioChipGroup name="room" legend="Тип номера" options={OPTIONS} hideLegend />);
    expect(screen.getByRole('group', { name: 'Тип номера' })).toBeInTheDocument();
  });
});

describe('FormError', () => {
  it('stays in the document while empty so the change is announced', () => {
    // A live region inserted at the same moment it gains text is often not announced at all —
    // the browser has to be watching the node before the change.
    const { rerender } = render(<FormError />);
    const region = screen.getByRole('alert');
    expect(region).toBeEmptyDOMElement();

    rerender(<FormError>Не удалось отправить заявку</FormError>);
    expect(screen.getByRole('alert')).toHaveTextContent('Не удалось отправить заявку');
  });
});

describe('ref forwarding', () => {
  /*
   * The one property a form library needs and the only one a screenshot cannot show.
   *
   * `register()` hands a control its `ref`, and that ref is how react-hook-form learns the
   * element exists. Dropped — which is what a plain function component silently does with it —
   * the form validates its own default values forever: every field reports «заполните поле» no
   * matter what was typed, and it reads as a validation bug rather than as a missing ref.
   *
   * This was real. All four controls were written without `forwardRef` in phase 1 and nothing
   * noticed until phase 5 put an actual form on the contact page.
   */
  it('Input hands its ref to the input', () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input ref={ref} />);
    expect(ref.current?.tagName).toBe('INPUT');
  });

  it('Textarea hands its ref to the textarea', () => {
    const ref = createRef<HTMLTextAreaElement>();
    render(<Textarea ref={ref} />);
    expect(ref.current?.tagName).toBe('TEXTAREA');
  });

  it('Select hands its ref to the select, not to the wrapper', () => {
    const ref = createRef<HTMLSelectElement>();
    render(
      <Select ref={ref}>
        <option>Ашхабад</option>
      </Select>,
    );
    expect(ref.current?.tagName).toBe('SELECT');
  });

  it('Checkbox hands its ref to the input behind the drawn box', () => {
    const ref = createRef<HTMLInputElement>();
    render(<Checkbox ref={ref}>Согласен</Checkbox>);
    expect(ref.current?.type).toBe('checkbox');
  });
});
