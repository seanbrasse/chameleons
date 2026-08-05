import type { Template } from '../types';
import type { PlatesOptions } from './manifest';
import type { PlatesTokens } from './tokens';

import { manifest } from './manifest';
import { Template as Component } from './Template';
import { defaultTokens, stylesheet } from './tokens';

const plates: Template<PlatesTokens, PlatesOptions> = {
  manifest,
  defaultTokens,
  stylesheet,
  Component,
};

export default plates;
