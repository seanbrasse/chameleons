/**
 * The layout document — the spine of the editor (docs/CUSTOMIZATION.md).
 *
 * The ratified direction is pixel-pushing per template, and only the data ports.
 * So a *layout* is a template's own concern: the template defines the slots it
 * can arrange (`LayoutSlot`), ships a default order for them, and renders *from*
 * a stored `LayoutDocument` when the owner has edited one — falling back to the
 * default when they have not. There is no cross-template layout: a document
 * refers to one template's slot ids and means nothing to another, which is
 * exactly the "structure does not port" decision made concrete.
 *
 * This module is the contract and the merge, both pure and template-agnostic (it
 * knows nothing about *which* slots a template has). It starts at the coarse
 * grain the plan calls for — order and visibility of top-level slots — but the
 * node shape carries `props` and `children` so the same document grows into the
 * finer-grained tree the canvas will edit, without a schema break.
 */

/** A node the owner can arrange: one of a template's slots, with its settings. */
export type LayoutNode = {
  /** The template slot this node is. Stable across saves; how a document and a
   *  template find each other. */
  id: string;
  /** Whether the slot renders. Absent means shown. */
  hidden?: boolean;
  /** Settings the template interprets for this slot (variant, spans, style…). */
  props?: Record<string, unknown>;
  /** Child nodes, for a slot that is itself a container. */
  children?: LayoutNode[];
};

export type LayoutDocument = {
  version: 1;
  nodes: LayoutNode[];
};

/** What a template advertises as arrangeable, so the editor can list it. */
export type LayoutSlot = {
  id: string;
  label: string;
};

export const LAYOUT_VERSION = 1 as const;

/** A slot resolved against a stored document: its order fixed, settings merged. */
export type ResolvedSlot = LayoutSlot & {
  hidden: boolean;
  props: Record<string, unknown>;
};

/**
 * The effective arrangement: the template's slots, ordered and settled by the
 * stored document, forward- and backward-compatibly.
 *
 * The rules are what keep a saved layout safe across template changes:
 *
 *  - **Order** follows the document, for the slots it names that still exist.
 *  - A slot the template **gained** since the document was saved (in `slots`,
 *    not in the document) is appended in its default position rather than
 *    vanishing — a new section shows up instead of being silently suppressed.
 *  - A slot the template **dropped** (in the document, not in `slots`) is
 *    discarded — a document never conjures a slot the template no longer has.
 *  - `hidden` and `props` come from the document where present, else the default.
 *
 * With no document (`null`), the slots pass through in their declared order, all
 * shown — which is a template with no saved layout, i.e. today's behaviour.
 */
export function resolveLayout(
  slots: LayoutSlot[],
  document: LayoutDocument | null,
): ResolvedSlot[] {
  const known = new Map(slots.map((slot) => [slot.id, slot]));
  const stored = document?.nodes ?? [];
  const placed = new Set<string>();

  const fromDocument: ResolvedSlot[] = [];
  for (const node of stored) {
    const slot = known.get(node.id);
    if (!slot || placed.has(node.id)) continue; // dropped slot, or a dupe id
    placed.add(node.id);
    fromDocument.push({
      ...slot,
      hidden: node.hidden ?? false,
      props: node.props ?? {},
    });
  }

  // Slots the document never mentioned, in their declared order, appended.
  const appended: ResolvedSlot[] = slots
    .filter((slot) => !placed.has(slot.id))
    .map((slot) => ({ ...slot, hidden: false, props: {} }));

  return [...fromDocument, ...appended];
}

/** The slots that actually render — resolved, minus the hidden. */
export function visibleSlots(slots: LayoutSlot[], document: LayoutDocument | null): ResolvedSlot[] {
  return resolveLayout(slots, document).filter((slot) => !slot.hidden);
}
