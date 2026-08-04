import { signOut } from './actions';

export function SignOut() {
  return (
    <form action={signOut}>
      <button type="submit" className="admin-button admin-button-quiet">
        Sign out
      </button>
    </form>
  );
}
