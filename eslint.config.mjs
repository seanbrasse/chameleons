import coreWebVitals from 'eslint-config-next/core-web-vitals';
import typescript from 'eslint-config-next/typescript';

/** A whole string that is a colour. */
const COLOUR =
  '^(#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$|(?:rgba?|hsla?|oklch|color-mix)\\()';

/** A colour anywhere inside one — a template literal is usually a whole declaration. */
const COLOUR_ANYWHERE =
  '#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\\b|(?:rgba?|hsla?|oklch|color-mix)\\(';

/**
 * Templates converge when they can borrow from each other. These rules make
 * borrowing fail rather than merely being discouraged — see plan §20.3. They
 * do not forbid a radius or a shadow; they force it to be declared in the
 * template's own token file, where a human chose it.
 */
const templateIsolation = {
  files: ['src/templates/**/*.{ts,tsx}'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['@/components/ui', '@/components/ui/*', '**/components/ui/*'],
            message:
              'There is no shared UI component library, by design. A shared Card is how every template ends up looking the same (plan §6). Put the component in this template.',
          },
          {
            // `../*/*` reaches up out of this template and down into a sibling.
            // `../types` and `../floor` are one level up and stay allowed.
            group: ['@/templates/*/*', '../*/*', '../../templates/*/*'],
            message:
              'Templates cannot import from each other. Duplicate it; extract only after the third occurrence (plan §6).',
          },
        ],
      },
    ],
  },
};

/**
 * Colour and geometry are the two axes slop lives on. Colour was already
 * disciplined in the original; geometry was not — the source sheet carried 56
 * border-radius declarations across 12 distinct values, exactly one of which
 * went through a token.
 */
const literalsBelongInTokens = {
  files: ['src/**/*.{ts,tsx}'],
  ignores: ['src/templates/*/tokens.ts'],
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector: `Literal[value=/${COLOUR}/]`,
        message:
          'Colour literals belong in the template\'s own tokens.ts, read from there as a custom property.',
      },
      {
        selector: `TemplateElement[value.raw=/${COLOUR_ANYWHERE}/]`,
        message:
          'Colour literals belong in the template\'s own tokens.ts, read from there as a custom property.',
      },
      {
        selector:
          "Property[key.name=/^(borderRadius|boxShadow)$/], Property[key.value=/^(border-radius|box-shadow)$/]",
        message:
          'Radius and shadow are the tell of card-slop. Declare them as tokens in the template that uses them (plan §20.3).',
      },
    ],
  },
};

const config = [
  { ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts', 'playwright-report/**'] },
  ...coreWebVitals,
  ...typescript,
  templateIsolation,
  literalsBelongInTokens,
];

export default config;
