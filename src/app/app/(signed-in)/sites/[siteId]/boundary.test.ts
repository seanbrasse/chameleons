import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The editor page is a Server Component and every row is a client one, so
 * nothing but serialisable props may cross between them. React enforces this at
 * runtime and nothing else does: `next build` compiles a violation, `tsc` types
 * it, and there is no e2e test that loads the editor because it needs a
 * session.
 *
 * That gap cost real time. `RowList` shipped as a client component taking a
 * `render` function from the page, so every list on the screen threw on render
 * and the editor served a 500 for weeks. Nobody found it because every
 * screenshot taken of the builder was a hand-written harness rather than the
 * real components.
 *
 * This is the cheap structural check that would have caught it: in this folder
 * the parent of every client component is the server page, so a function-typed
 * prop is always a boundary violation.
 */

const DIR = __dirname;

/** Prop declarations look like `name?: (a: B) => C;` inside the props object. */
const FUNCTION_PROP = /^\s*(\w+)\??:\s*\(?[^;]*\)\s*=>\s*[^;]+;/gm;

function clientComponents(): Array<{ file: string; source: string }> {
  return readdirSync(DIR)
    .filter((file) => file.endsWith('.tsx'))
    .map((file) => ({ file, source: readFileSync(join(DIR, file), 'utf8') }))
    .filter(({ source }) => source.startsWith("'use client'"));
}

describe('the server/client boundary', () => {
  it('has client components to check', () => {
    // A rename that emptied this list would make every assertion below vacuous.
    expect(clientComponents().length).toBeGreaterThan(5);
  });

  it('passes no function props from the page to a row', () => {
    const offenders: string[] = [];

    for (const { file, source } of clientComponents()) {
      // Only the props object, which is the part the server fills in. Function
      // types in the body are ordinary client-side code.
      const props = source.slice(source.indexOf('}: {'), source.indexOf('}) {'));
      for (const match of props.matchAll(FUNCTION_PROP)) {
        offenders.push(`${file}: ${match[1]}`);
      }
    }

    expect(
      offenders,
      'A Server Component cannot pass a function to a client component — React ' +
        'throws at render, and nothing in build, tsc or lint will tell you.',
    ).toEqual([]);
  });
});
