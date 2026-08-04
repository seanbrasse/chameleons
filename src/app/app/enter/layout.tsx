import type { ReactNode } from 'react';

import '../../builder.css';

/** The door is outside the signed-in group, so it imports the sheet itself. */
export default function EnterLayout({ children }: { children: ReactNode }) {
  return children;
}
