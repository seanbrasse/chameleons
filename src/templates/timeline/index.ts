import type { Template } from '../types';
import type { TimelineOptions } from './manifest';
import type { TimelineTokens } from './tokens';

import { manifest } from './manifest';
import { Template as Component } from './Template';
import { defaultTokens, stylesheet } from './tokens';

const timeline: Template<TimelineTokens, TimelineOptions> = {
  manifest,
  defaultTokens,
  stylesheet,
  Component,
};

export default timeline;
