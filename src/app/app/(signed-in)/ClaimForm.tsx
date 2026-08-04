'use client';

import { useActionState } from 'react';

import { claim, type ClaimState } from './actions';

/** `suffix` is rendered, not enforced — the server decides what a name may be. */
export function ClaimForm({ suffix }: { suffix: string }) {
  const [state, action, pending] = useActionState<ClaimState, FormData>(claim, {});

  return (
    <form action={action} className="admin-form">
      <label className="field">
        <span className="field-label">Your address</span>
        <input
          name="subdomain"
          required
          autoComplete="off"
          spellCheck={false}
          placeholder="yourname"
        />
        <span className="admin-note">
          Your portfolio will be read at <code>yourname{suffix}</code>.
        </span>
      </label>

      {state.problem ? (
        <p className="admin-error" role="status">
          {state.problem}
        </p>
      ) : null}

      <div className="admin-buttons">
        <button type="submit" className="admin-button" disabled={pending}>
          {pending ? 'Claiming…' : 'Claim it'}
        </button>
      </div>
    </form>
  );
}
