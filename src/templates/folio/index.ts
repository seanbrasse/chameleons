import type { Template } from '../types';
import type { FolioOptions } from './manifest';
import type { FolioTokens } from './tokens';

import { manifest } from './manifest';
import { Template as Component } from './Template';
import { defaultTokens, stylesheet } from './tokens';

const folio: Template<FolioTokens, FolioOptions> = {
  manifest,
  defaultTokens,
  stylesheet,
  Component,
};

export default folio;
