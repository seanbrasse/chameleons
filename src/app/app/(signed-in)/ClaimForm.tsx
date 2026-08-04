'use client';

import { useActionState } from 'react';

import { claim, type ClaimState } from './actions';

/** `suffix` is rendered, not enforced — the server decides what a name may be. */
export function ClaimForm({ suffix }: { suffix: string }) {
  const [state, action, pending] = useActionState<ClaimState, FormData>(claim, {});

  return (
    <form action={action} className="admin-form">
      <label className="admin-field" htmlFor="subdomain">
        <span>Your address</span>
        <span className="admin-field-row">
          <input
            id="subdomain"
            name="subdomain"
            required
            autoComplete="off"
            spellCheck={false}
            placeholder="yourname"
          />
          <span aria-hidden="true">{suffix}</span>
        </span>
      </label>

      {state.problem ? (
        <p className="admin-error" role="status">
          {state.problem}
        </p>
      ) : null}

      <button type="submit" className="admin-button" disabled={pending}>
        {pending ? 'Claiming…' : 'Claim it'}
      </button>
    </form>
  );
}
