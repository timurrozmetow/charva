import { ApiRequestError } from '@charva/contracts';
import { Button, Field, FormError, Input } from '@charva/ui';
import { useState } from 'react';

import { useSession } from '../auth/SessionProvider';
import { copy } from '../i18n/copy';

/**
 * The only screen a signed-out person can reach.
 *
 * Three failures are told apart, because the fixes differ: wrong password (try again), locked
 * account (wait, or ask the owner), too many attempts from this address (wait). Everything else
 * is the same sentence, which is also what the server says — it will not confirm whether an
 * address has an account.
 */
export function LoginPage() {
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setBusy(true);

    try {
      await signIn(email, password);
    } catch (failure) {
      setError(messageFor(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-bg px-6">
      <div className="w-full max-w-[420px] rounded-panel border border-line bg-surface p-10 mob:p-6">
        <h1 className="text-h3 font-medium text-ink">
          {copy.brand} — {copy.login.title.toLowerCase()}
        </h1>
        <p className="mt-3 text-bodySm text-muted">{copy.login.lead}</p>

        <form onSubmit={(event) => void submit(event)} className="mt-8 flex flex-col gap-5">
          <Field label={copy.login.email} required>
            <Input
              type="email"
              name="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
              }}
            />
          </Field>

          <Field label={copy.login.password} required>
            <Input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
              }}
            />
          </Field>

          {error !== null && <FormError>{error}</FormError>}

          <Button type="submit" busy={busy} busyLabel={copy.login.working} fullWidth>
            {copy.login.submit}
          </Button>
        </form>
      </div>
    </main>
  );
}

function messageFor(failure: unknown): string {
  if (failure instanceof ApiRequestError) {
    if (failure.code === 'locked') return copy.login.locked;
    if (failure.code === 'rate_limited') return copy.login.rateLimited;
  }
  return copy.login.failed;
}
