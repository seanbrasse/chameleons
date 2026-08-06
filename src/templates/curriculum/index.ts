import type { Template } from '../types';
import type { CurriculumOptions } from './manifest';
import type { CurriculumTokens } from './tokens';

import { manifest } from './manifest';
import { Template as Component } from './Template';
import { defaultTokens, stylesheet } from './tokens';

const curriculum: Template<CurriculumTokens, CurriculumOptions> = {
  manifest,
  defaultTokens,
  stylesheet,
  Component,
};

export default curriculum;
