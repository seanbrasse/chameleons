import type { ContentProblem } from '@/server/domain/validate-issue';

/** The result of a save or publish action, rendered the same way everywhere it appears. */
export function Feedback({
  problem,
  saved,
  published,
  problems,
}: {
  problem?: string;
  saved?: boolean;
  published?: number;
  problems?: ContentProblem[];
}) {
  return (
    <>
      {problem ? (
        <p className="admin-error" role="status">
          {problem}
        </p>
      ) : null}

      {saved ? (
        <p className="admin-ok" role="status">
          Saved.
        </p>
      ) : null}

      {published ? (
        <p className="admin-ok" role="status">
          Published version {published}.
        </p>
      ) : null}

      {problems?.length ? (
        <ul className="admin-list">
          {problems.map((p) => (
            <li key={`${p.where}:${p.problem}`} className="admin-row">
              <span className="admin-row-mono">{p.where}</span>
              <span>{p.problem}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
