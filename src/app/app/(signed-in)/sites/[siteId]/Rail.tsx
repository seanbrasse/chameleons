import type { ReactNode } from 'react';

/**
 * The editor's section index.
 *
 * The structural half of the redesign. The page was eight equal headings in one
 * column, so nothing showed where you were, how much was left, or that
 * publishing ends a sequence rather than being one more form. Grouping the
 * links the way the flow actually runs — design, then content, then publish —
 * makes that visible without the user having to scroll to infer it.
 *
 * Counts rather than badges: what a section needs to know is whether it has
 * anything in it yet.
 */
export function Rail({ groups }: { groups: RailGroup[] }) {
  return (
    <nav className="admin-rail" aria-label="Sections">
      {groups.map((group) => (
        <div className="admin-rail-group" key={group.label}>
          <p className="admin-rail-label">{group.label}</p>
          {group.links.map((link) => (
            <a href={`#${link.id}`} key={link.id}>
              {link.label}
              {link.count === undefined ? null : (
                <span className="admin-rail-count">{link.count}</span>
              )}
            </a>
          ))}
        </div>
      ))}
    </nav>
  );
}

export type RailGroup = {
  label: string;
  links: Array<{ id: string; label: string; count?: ReactNode }>;
};
