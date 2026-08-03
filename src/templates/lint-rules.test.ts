import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

/**
 * The §20.3 rules are the whole mechanical defence against templates
 * converging, and a rule that silently stops matching looks exactly like a
 * clean codebase. Two of these did not fire when first written.
 */

const eslint = new ESLint({ cwd: process.cwd() });

/** Lint a snippet as if it were a file inside a template. */
async function ruleIdsFor(code: string, filePath = 'src/templates/probe/probe.ts') {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).map((m) => m.ruleId);
}

describe('template isolation', () => {
  it('rejects a shared UI component library', async () => {
    const ids = await ruleIdsFor("import { Card } from '@/components/ui/card';\nexport { Card };");
    expect(ids).toContain('no-restricted-imports');
  });

  it('rejects one template importing another', async () => {
    const ids = await ruleIdsFor("import { x } from '../timeline/tokens';\nexport { x };");
    expect(ids).toContain('no-restricted-imports');
  });

  it('allows the shared contract and floor', async () => {
    const ids = await ruleIdsFor(
      "import type { Template } from '../types';\nexport type T = Template<unknown, unknown>;",
    );
    expect(ids).not.toContain('no-restricted-imports');
  });
});

describe('literals belong in tokens', () => {
  it.each([
    ['hex', "export const a = '#ff0000';"],
    ['colour function', "export const a = 'rgba(0,0,0,.5)';"],
    ['hex inside a template literal', 'export const a = `border: 1px solid #abc`;'],
    ['border radius', "export const a = { borderRadius: '8px' };"],
    ['box shadow', "export const a = { boxShadow: '0 1px 2px black' };"],
  ])('rejects %s', async (_label, code) => {
    expect(await ruleIdsFor(code)).toContain('no-restricted-syntax');
  });

  it("exempts a template's own tokens file", async () => {
    const ids = await ruleIdsFor(
      "export const a = '#ff0000';",
      'src/templates/timeline/tokens.ts',
    );
    expect(ids).not.toContain('no-restricted-syntax');
  });
});
