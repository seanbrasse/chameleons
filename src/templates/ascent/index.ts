import type { Template } from '../types';
import type { AscentOptions } from './manifest';
import type { AscentTokens } from './tokens';

import { manifest } from './manifest';
import { Template as Component } from './Template';
import { defaultTokens, stylesheet } from './tokens';

const ascent: Template<AscentTokens, AscentOptions> = {
  manifest,
  defaultTokens,
  stylesheet,
  Component,
};

export default ascent;
