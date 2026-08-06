import type { Template } from '../types';
import type { BylineOptions } from './manifest';
import type { BylineTokens } from './tokens';

import { manifest } from './manifest';
import { Template as Component } from './Template';
import { defaultTokens, stylesheet } from './tokens';

const byline: Template<BylineTokens, BylineOptions> = {
  manifest,
  defaultTokens,
  stylesheet,
  Component,
};

export default byline;
