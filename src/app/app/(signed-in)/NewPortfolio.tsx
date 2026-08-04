'use client';

import { useActionState } from 'react';

import { startPortfolio, type NewSiteState } from './actions';

export function NewPortfolio() {
  const [state, action, pending] = useActionState<NewSiteState, FormData>(
    () => startPortfolio(),
    {},
  );

  return (
    <form action={action}>
      {state.problem ? (
        <p className="admin-error" role="status">
          {state.problem}
        </p>
      ) : null}

      <div className="admin-buttons">
        <button type="submit" className="admin-button admin-primary" disabled={pending}>
          {pending ? 'Creating…' : 'New portfolio'}
        </button>
      </div>
    </form>
  );
}
