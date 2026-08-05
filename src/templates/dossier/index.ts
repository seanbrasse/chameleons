import type { Template } from '../types';
import type { DossierOptions } from './manifest';
import type { DossierTokens } from './tokens';

import { manifest } from './manifest';
import { Template as Component } from './Template';
import { defaultTokens, stylesheet } from './tokens';

const dossier: Template<DossierTokens, DossierOptions> = {
  manifest,
  defaultTokens,
  stylesheet,
  Component,
};

export default dossier;
