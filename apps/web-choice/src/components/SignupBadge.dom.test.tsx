import { type UmrahTrip } from '@charva/contracts';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SignupBadge } from './SignupBadge';

/**
 * The badge, including the two states nobody drew.
 *
 * The prototype writes `seatsLeft: 12` as a literal and has exactly one state. Once the
 * departure passes, its countdown clamps to zeros and the pill keeps promising twelve seats
 * indefinitely — and that happens the day the first group leaves, not in some edge case.
 */

function trip(overrides: Partial<UmrahTrip> = {}): UmrahTrip {
  return {
    id: 1,
    departAt: '2030-01-01T06:00:00.000Z',
    returnAt: '2030-01-11T06:00:00.000Z',
    signupClosesAt: '2029-12-18T06:00:00.000Z',
    durationDays: 10,
    seatsTotal: 45,
    seatsTaken: 33,
    seatsLeft: 12,
    seatsPercent: 73.3,
    status: 'open',
    signupOpen: true,
    hotelMekka: '',
    hotelMedina: '',
    ...overrides,
  };
}

describe('SignupBadge', () => {
  it('counts the seats left rather than printing a literal', () => {
    render(<SignupBadge trip={trip()} lang="ru" />);
    expect(screen.getByText(/12 мест/)).toBeInTheDocument();
  });

  it('declines «место» correctly for one seat', () => {
    render(<SignupBadge trip={trip({ seatsLeft: 1 })} lang="ru" />);
    expect(screen.getByText(/1 место/)).toBeInTheDocument();
  });

  it('says the group is full instead of offering zero seats', () => {
    render(<SignupBadge trip={trip({ status: 'full', seatsLeft: 0 })} lang="ru" />);
    expect(screen.getByText('Группа набрана')).toBeInTheDocument();
    expect(screen.queryByText(/0 мест/)).not.toBeInTheDocument();
  });

  it('says the list is closed while the group has not yet left', () => {
    render(<SignupBadge trip={trip({ status: 'closed' })} lang="ru" />);
    expect(screen.getByText('Запись закрыта')).toBeInTheDocument();
  });

  it('says the group is travelling once it has departed — question Q-4', () => {
    render(<SignupBadge trip={trip({ status: 'departed' })} lang="ru" />);
    expect(screen.getByText('Группа в пути')).toBeInTheDocument();
  });

  it('says the next group is coming when there is no departure at all — question Q-4', () => {
    // The state the prototype cannot represent, and the one the site is in for the fortnight
    // between a group leaving and the next being announced.
    render(<SignupBadge trip={null} lang="ru" />);
    expect(screen.getByText('Следующая группа скоро')).toBeInTheDocument();
  });

  it('pulses only while something is genuinely open', () => {
    const { container: live } = render(<SignupBadge trip={trip()} lang="ru" />);
    expect(live.querySelector('.motion-safe\\:animate-pulse')).not.toBeNull();

    const { container: still } = render(
      <SignupBadge trip={trip({ status: 'departed' })} lang="ru" />,
    );
    expect(still.querySelector('.motion-safe\\:animate-pulse')).toBeNull();
  });

  it('speaks Turkmen on the Turkmen page', () => {
    render(<SignupBadge trip={trip()} lang="tm" />);
    expect(screen.getByText(/12 orun/)).toBeInTheDocument();
  });
});
