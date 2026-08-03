'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import type { Asset, Education, Experience, Project } from '@/content/types';
import { formatMonth, formatRange, isoRange } from '@/lib/format';

/** Cards per notch of wheel travel. Tuned so a normal flick moves about one. */
const WHEEL = 0.0016;

/** How fast the eased position closes on the target, per second. */
const EASE = 9;

/**
 * How long after the reader stops before the carousel settles onto a card.
 * Long enough that consecutive wheel notches read as one gesture, short enough
 * that letting go feels like it lands rather than drifts.
 */
const SETTLE = 160;

/**
 * The timeline and the carousel, which are one component because they share one
 * position. The timeline marks where the card nearest the middle sits in the
 * career; the carousel drifting moves the marker, and stopping it stops the
 * marker with it.
 */
export function Work({
  projects,
  experiences,
  education,
}: {
  projects: Project[];
  experiences: Experience[];
  education: Education[];
}) {
  const count = projects.length;

  /**
   * The carousel travels in date order, oldest to newest.
   *
   * The database pulls the starred project to the front of the list, ahead of
   * the date sort. That made the carousel open on it — which is wanted — but it
   * also made index order disagree with date order, so the timeline cursor
   * jumped instead of sweeping cleanly from the first year to the last. Sorting
   * by date here fixes the travel; the star is honoured separately, as the
   * position the carousel *starts* on, so it still leads on load without bending
   * the order the timeline reads.
   */
  const ordered = useMemo(
    () => [...projects].sort((a, b) => a.date.localeCompare(b.date)),
    [projects],
  );
  const start = useMemo(() => {
    const starred = ordered.findIndex((project) => project.starred);
    // No pin: open on the most recent, which is last in date order.
    return starred >= 0 ? starred : Math.max(ordered.length - 1, 0);
  }, [ordered]);

  const [active, setActive] = useState(start);
  const [detail, setDetail] = useState<Project | null>(null);
  const [gallery, setGallery] = useState(false);
  const drag = useRef<{ x: number; from: number } | null>(null);
  const dragged = useRef(false);

  const employers = useMemo(
    () => Object.fromEntries(experiences.map((item) => [item.id, item])),
    [experiences],
  );

  /**
   * Position is a float, not an index.
   *
   * A carousel that steps between integers can only ever jump; the cards are
   * either here or there, and a transition tweens between two states. Drifting
   * means position is continuous — 1.37 is a real place — and every card's
   * transform is a function of its distance from it. That is what produces
   * cards sliding steadily past each other rather than snapping.
   *
   * It lives in a ref and is written to the DOM directly from the animation
   * frame. Re-rendering four cards sixty times a second to move them is the
   * expensive way to do this, and React would be reconciling a tree whose only
   * change is a transform string. Only the *rounded* position goes into state,
   * because that is the one thing anything else needs to know.
   */
  const position = useRef(start);
  const target = useRef(start);
  const stage = useRef<HTMLDivElement>(null);
  const cursor = useRef<HTMLSpanElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const settle = useRef(0);
  /**
   * Card spacing, mirrored from CSS. `paint()` runs sixty times a second and
   * cannot afford a `getComputedStyle` per frame, so `fit()` — which already
   * runs on every resize, and so on every breakpoint crossing — reads it once
   * and leaves it here.
   */
  const spacing = useRef(0.62);

  /**
   * Where each project sits on the timeline, as a percentage. Shared between
   * the line, which draws a dot per project, and the cursor, which slides
   * between those dots as the carousel moves — they have to agree, so they
   * come from one calculation rather than two.
   */
  const geometry = useMemo(
    () => timelineGeometry(experiences, ordered, education),
    [experiences, ordered, education],
  );

  // Layout is a pure function of position, so it can be called from the frame
  // loop and from a jump, and the two cannot disagree.
  const paint = useCallback(() => {
    const node = stage.current;
    if (!node) return;

    const cards = node.querySelectorAll<HTMLElement>('.project-card');

    // Signed distance from the middle, wrapped, so the first card sits beside
    // the last rather than against an empty edge.
    // Wrapped, so the carousel is a cycle: the newest card sits beside the
    // oldest and there is no end to run into in either direction.
    const offsets = Array.from(cards, (_, index) => {
      let offset = (index - position.current) % count;
      if (offset > count / 2) offset -= count;
      if (offset < -count / 2) offset += count;
      return offset;
    });

    /**
     * Depth is a rank, not a threshold on distance.
     *
     * Thresholds cannot promise a card count. With four cards the two furthest
     * are equidistant every time the carousel is halfway between two of them —
     * both land on the same side of any cutoff, and four cards are on screen
     * instead of three. Ranking sorts that out by construction: nearest is the
     * front, the next two are its neighbours, everything else is hidden, and
     * that holds at every position and for any number of projects.
     */
    const rank = offsets
      .map((offset, index) => ({ index, distance: Math.abs(offset) }))
      .sort((a, b) => a.distance - b.distance)
      .map((entry) => entry.index);

    cards.forEach((card, index) => {
      const offset = offsets[index];
      const distance = Math.abs(offset);
      const scale = Math.max(1 - distance * 0.13, 0.7);

      // Both axes. The card hangs from `top: 50%`, so the Y half-offset is what
      // centres it — writing only the X translate here left the card centred
      // horizontally and dropped a half-height below the middle.
      card.style.transform =
        `translate(calc(-50% + ${offset * spacing.current * 100}%), -50%) scale(${scale})`;
      card.style.zIndex = String(Math.round(100 - distance * 10));

      /**
       * Opacity comes from that rank, and CSS owns it.
       *
       * Ramping opacity off raw distance means a card is only fully solid at
       * the exact instant it is dead centre. Every other moment the front card
       * is slightly transparent and the one behind shows through it, which is a
       * permanent crossfade — the card on top never looks like it is on top.
       *
       * Rank is discrete and changes once, when two cards swap places. So the
       * depth goes in an attribute and the stylesheet transitions between the
       * three values: the front card sits at full strength for the whole time
       * it is the front card, and the exchange is a short crossfade at the
       * moment the order actually changes.
       *
       * Transform stays per-frame. Only opacity is transitioned, and only
       * because the value it smooths is a step rather than a stream.
       */
      const place = rank.indexOf(index);
      const depth = place === 0 ? '0' : place <= 2 ? '1' : '2';
      if (card.dataset.depth !== depth) card.dataset.depth = depth;

      // `toggleAttribute`, not `dataset.centre = undefined`. Assigning
      // undefined to a dataset property stringifies it, so the attribute is
      // present with the value "undefined" and still matches `[data-centre]`.
      card.toggleAttribute('data-centre', depth === '0');
    });

    // The cursor sits between the two projects the position is between, which
    // is what makes it track the carousel rather than snap to whichever card
    // happens to be nearest.
    //
    // Wrapped, not clamped. `position.current` is unbounded — it runs negative
    // past the first card and beyond the last, because the carousel is a cycle
    // with no end (see `seek`). Clamping it to [0, n-1] pinned the cursor at an
    // end the moment the reader scrolled off it, and it stayed pinned there
    // even as the cards cycled back to the middle: the line lied about where the
    // carousel was. Folding the position into [0, n) instead keeps the cursor on
    // the card actually showing, wherever the endless scroll has wandered to.
    if (cursor.current && geometry.marks.length > 0) {
      const n = geometry.marks.length;
      const wrapped = ((position.current % n) + n) % n;
      const lower = Math.floor(wrapped) % n;
      const upper = (lower + 1) % n;
      const blend = wrapped - Math.floor(wrapped);

      /**
       * Between two adjacent projects the cursor glides, so it tracks the cards
       * sliding past. But the step from the last project back to the first is a
       * wrap, and on a linear line the two ends are the whole timeline apart —
       * newest at one end, oldest at the other. Gliding across it drew the cursor
       * sweeping all the way back over the line, which reads as the carousel
       * running backwards to the start rather than cycling round to it.
       *
       * A cycle has no middle between its ends, so that seam is a jump, not a
       * journey: the cursor snaps to whichever end the carousel has settled
       * nearer to — the card actually coming to the centre — instead of tweening
       * between them. Every other step still glides.
       */
      const seam = lower === n - 1 && upper === 0;
      const left = seam
        ? geometry.marks[blend < 0.5 ? lower : upper].left
        : geometry.marks[lower].left +
          (geometry.marks[upper].left - geometry.marks[lower].left) * blend;
      cursor.current.style.left = `${left}%`;
    }
  }, [count, geometry]);

  /**
   * The card's width is a function of the height available to it.
   *
   * A full-width 16:9 well means the image is exactly `width * 9/16` tall, so
   * asking how wide the card should be and asking how much room there is are
   * the same question — and CSS cannot answer it, because a percentage width
   * cannot be derived from a parent's height. Measuring the stage is the only
   * honest way round, and a ResizeObserver does it without polling.
   *
   * The body's height is read from the DOM rather than assumed, so changing the
   * card's copy or padding cannot silently push the image out of the frame.
   */
  useEffect(() => {
    const node = stage.current;
    if (!node) return;

    const body = node.querySelector<HTMLElement>('.project-body');

    /**
     * Converges rather than computing once.
     *
     * The body's height depends on the card's width — a narrower card wraps the
     * summary onto another line — and the width depends on the body's height.
     * A single pass measures the body at whatever width the card happened to
     * have and lands wrong, which is what left the card taller than the stage.
     *
     * So the body is observed too, and each pass re-measures. The 2px deadband
     * is what stops that becoming a loop: once a change is smaller than a
     * couple of pixels nothing is written, no resize fires, and it settles.
     */
    const region = node.closest<HTMLElement>('.work');
    // The timeline, not the heading. The heading is screen-reader-only now, so
    // it is out of flow and its top is not where the block's content starts —
    // anchoring on it would count the block's own slack as chrome.
    const head = region?.querySelector<HTMLElement>('.timeline');

    const fit = () => {
      if (!region || !head) return;

      const chrome = body ? body.offsetHeight : 96;

      /**
       * The height budget, taken from the region rather than from the stage.
       *
       * The stage's own height is now written by this function, so reading it
       * back to decide how tall it should be is circular. The work region is a
       * grid track that fills the screen, so its height is independent of
       * anything here — subtract the parts of it that are not the stage and
       * what is left is the stage's budget.
       *
       * Measured from the timeline down and from the region's bottom up, never
       * from the region's top. The block is bottom-aligned, so the space above
       * it is slack, and counting that as chrome would shrink the card to make
       * room for the emptiness the shrinking creates.
       */
      const regionBox = region.getBoundingClientRect();
      const stageBox = node.getBoundingClientRect();
      const above = stageBox.top - head.getBoundingClientRect().top;
      const below = regionBox.bottom - stageBox.bottom;

      // A little back, so a rounding error cannot put the card over the edge.
      const budget = regionBox.height - above - below;
      const available = budget - chrome - 4;
      // The tunables live in the stylesheet, because all of them change at a
      // breakpoint. Read on every pass, so crossing one is picked up.
      const style = getComputedStyle(node);
      const read = (name: string, fallback: number) =>
        parseFloat(style.getPropertyValue(name)) || fallback;

      spacing.current = read('--spacing', 0.62);
      const locked = read('--locked', 0) === 1;

      const byWidth = Math.min(
        node.clientWidth * read('--card-fraction', 0.62),
        read('--card-max', 700),
      );

      /**
       * Off the lock, the budget is the viewport rather than the region.
       *
       * The region is sized by its own content there — which includes the card
       * — so measuring it is circular, and taking width alone is what left the
       * contact details hanging off the bottom of a phone. The document is the
       * honest frame: everything above the stage plus everything below it is
       * fixed by the copy, so what is left of the viewport is what the card may
       * have.
       *
       * Positions are converted to document coordinates before subtracting, so
       * the answer does not depend on where the page happens to be scrolled to
       * when a resize fires.
       *
       * Self-correcting in both directions. Too tall and this shrinks the card,
       * which shortens the document, which is measured again next pass; too
       * short and it grows into the slack. The deadband is what stops that
       * settling into a wobble.
       */
      if (!locked) {
        /**
         * Fill width: on a phone the card is sized from the viewport width
         * (`--card-vw`) rather than the stage's, so it reads as the near-full
         * poster the reader asked for. It is still capped by the height budget
         * below, so the whole page — contact details included — stays on one
         * screen: when the height cannot hold the full-width card, the cap scales
         * it down instead of letting the page scroll. Unset on wider layouts,
         * where the width comes from the stage as before.
         */
        const fillVw = read('--card-vw', 0);

        const fromTop = stageBox.top + window.scrollY;
        /**
         * Heights, not positions.
         *
         * Every earlier attempt at this measured how far down something sat and
         * got the same answer wrong three ways: the root's `scrollHeight` is
         * clamped to the viewport, the frame carries `min-height: 100dvh`, and
         * the footer is pushed to the bottom by an auto margin. All three report
         * where the empty space ends rather than where the content does, so the
         * slack gets counted as chrome, the budget comes out short, and the card
         * shrinks to make room for the emptiness that shrinking creates.
         *
         * Adding up what is actually below the stage cannot be fooled by any of
         * them: the rest of `main` is the controls, and the footer's own height
         * is its height wherever it has been pushed to.
         */
        const region = node.closest('main');
        const footer = document.querySelector<HTMLElement>('.site-footer');
        const beneath =
          (region ? region.getBoundingClientRect().bottom - stageBox.bottom : 0) +
          (footer?.offsetHeight ?? 0);

        /**
         * A floor, not a hard bound. On a very short window — or at large text
         * sizes, or 400% zoom — the page genuinely cannot hold all of this, and
         * squeezing the card to nothing to avoid a scrollbar would trade a
         * scrollbar for an unreadable card. Below this it stops shrinking and
         * the page scrolls, which is what WCAG 1.4.10 asks for anyway.
         *
         * 78 rather than 84 because rounding the card onto a 16px grid costs up
         * to fifteen pixels of width, and at 360x640 that was the difference
         * between fitting and overflowing by three.
         */
        const room = Math.max(window.innerHeight - fromTop - beneath - chrome - 4, 78);

        // Fill width takes the target straight from the viewport; otherwise it
        // is the stage-relative `byWidth`. Either way the height budget caps it.
        const desiredWidth = fillVw > 0 ? window.innerWidth * fillVw : byWidth;
        const only = toGrid(Math.min(desiredWidth, room * (16 / 9)));
        // No slack added: the card *is* this height now, so a margin here is
        // just height the page does not have, and `even` already rounds up.
        node.style.setProperty('--card-h', `${even(wellHeight(only) + chrome)}px`);
        if (Math.abs(only - (parseFloat(node.style.getPropertyValue('--card-w')) || 0)) < 2) return;
        node.style.setProperty('--card-w', `${only}px`);
        paint();
        return;
      }

      const byHeight = Math.max(available, 80) * (16 / 9);
      /**
       * Three cards wide, not one: the neighbours sit `--spacing` out and
       * scaled down, so the stack covers about `2 * spacing + 0.87` card widths
       * and spills well past the text column it is centred in. Bounding on the
       * column alone let the outer cards run off a narrow screen.
       *
       * Only while locked, where all three have to be on screen at once. Below
       * it the neighbours are meant to be mostly off the edge, and applying
       * this would crush the card to a third of its width to keep cards visible
       * that nobody is trying to see.
       */
      const bySpan = (window.innerWidth - 48) / (2 * spacing.current + 0.87);
      const next = toGrid(Math.min(byHeight, byWidth, bySpan));

      /**
       * Written every pass, deadband or not: the copy can rewrap without the
       * width moving, and the stage's height has to follow the body it holds.
       * Two pixels over, so a rounded height cannot leave the card a pixel
       * proud of the stage it is centred in.
       *
       * Clamped to the budget, because on a window barely over the scroll-lock
       * threshold the budget is genuinely smaller than the smallest card. The
       * stage is a fixed height now, so an unclamped value cannot be absorbed
       * the way a flexible one was — the block grows past its grid track and
       * climbs into the intro above it. Clamping lets the card overflow the
       * stage instead, which is what a too-short window did before.
       */
      const height = even(wellHeight(next) + chrome);
      node.style.setProperty('--card-h', `${even(Math.min(height, Math.max(budget, 0)))}px`);

      const current = parseFloat(node.style.getPropertyValue('--card-w')) || 0;
      if (Math.abs(next - current) < 2) return;

      node.style.setProperty('--card-w', `${next}px`);
      paint();
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(node);
    if (body) observer.observe(body);
    // The region carries the budget, so a viewport change has to be seen here
    // — the stage is a fixed height now and no longer resizes on its own.
    if (region) observer.observe(region);

    /**
     * Off the lock the budget is the viewport's height, and nothing being
     * observed necessarily changes when that does — a rotation or a browser
     * toolbar sliding away can leave every element the same size and every box
     * in a different place.
     */
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', fit);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', fit);
      window.removeEventListener('orientationchange', fit);
    };
  }, [paint]);

  useEffect(paint, [paint]);

  /**
   * The loop no longer advances anything. It closes the gap between where the
   * carousel is and where the reader has asked it to be, and then stops.
   *
   * Keeping the eased follow rather than writing the target straight to the
   * cards is what preserves the feel of the old drift: a wheel notch is a
   * discrete event, and applying it directly would make the carousel jump by
   * that much instantly. Easing turns a series of notches into continuous
   * travel, and a flick that lands several notches at once still resolves as
   * one smooth move.
   *
   * It cancels itself when the gap closes, so an idle page runs no frames.
   */
  const run = useCallback(() => {
    if (frame.current) return;

    let last = performance.now();
    const step = (now: number) => {
      // Elapsed time, not a fixed step, or the carousel closes twice as fast
      // on a 120Hz display as it does on a 60Hz one.
      const delta = Math.min((now - last) / 1000, 0.1);
      last = now;

      const gap = target.current - position.current;
      if (Math.abs(gap) < 0.0005) {
        position.current = target.current;
        paint();
        frame.current = 0;
        return;
      }

      position.current += gap * Math.min(delta * EASE, 1);
      paint();

      const rounded = ((Math.round(position.current) % count) + count) % count;
      setActive((current) => (current === rounded ? current : rounded));

      frame.current = requestAnimationFrame(step);
    };

    frame.current = requestAnimationFrame(step);
  }, [paint, count]);

  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
      window.clearTimeout(settle.current);
    },
    [],
  );

  /**
   * Move the carousel. The target is not clamped — it runs off either end and
   * the paint wraps it, which is what makes the cycle endless in both
   * directions rather than stopping at the oldest project.
   */
  const seek = useCallback(
    (to: number) => {
      target.current = to;
      setActive(((Math.round(to) % count) + count) % count);
      run();
    },
    [count, run],
  );

  /**
   * The wheel drives it, but only where the page has no scrolling of its own to
   * give up. On the locked one-screen layout there is nothing else a vertical
   * wheel could do, so taking it is free. Below that breakpoint the page is an
   * ordinary scrolling document and hijacking the wheel would trap the reader
   * in the carousel — there, horizontal intent still works and so does drag.
   */
  /**
   * Settle onto a card once the reader stops.
   *
   * A wheel has no end event, so "stopped" is the absence of another notch for
   * a while. Every notch pushes the timer back, which is what keeps a long
   * scroll from snapping mid-gesture; when they stop, the carousel closes on
   * the nearest card rather than resting between two of them with both half
   * faded.
   */
  const snapSoon = useCallback(() => {
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => seek(Math.round(target.current)), SETTLE);
  }, [seek]);

  const onWheel = useCallback(
    (event: React.WheelEvent) => {
      const pageScrolls = document.documentElement.scrollHeight > window.innerHeight;
      const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY);
      if (pageScrolls && !horizontal) return;

      const amount = horizontal ? event.deltaX : event.deltaY;
      seek(target.current + amount * WHEEL);
      snapSoon();
    },
    [seek, snapSoon],
  );

  const go = useCallback(
    (delta: number) => seek(Math.round(target.current) + delta),
    [seek],
  );

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowRight') go(1);
    else if (event.key === 'ArrowLeft') go(-1);
    else if (event.key === 'Home') seek(0);
    else if (event.key === 'End') seek(count - 1);
    else return;
    event.preventDefault();
  };

  /**
   * Left and Right turn the carousel from anywhere on the page, not only when
   * it has focus.
   *
   * The container is focusable and `onKeyDown` handles the keys once it is
   * tabbed to — but a pointer click is deliberately kept from focusing it (see
   * the pointer-down handler), so a reader who never tabbed in would press an
   * arrow and nothing would happen. This document-level listener closes that
   * gap: the arrows do what a reader plainly expects them to.
   *
   * It stands aside where the keys already mean something else — while a dialog
   * is open (the modal gallery moves between images with the same arrows), while
   * a form control or editable element holds focus, and while the container
   * itself is focused, where `onKeyDown` already runs and reacting again would
   * turn it twice. Only the horizontal keys are taken; Up and Down are left to
   * scroll the page on the layouts that scroll.
   */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (detail || gallery) return;

      const active = document.activeElement as HTMLElement | null;
      if (
        active &&
        (root.current?.contains(active) ||
          active.isContentEditable ||
          active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.tagName === 'SELECT')
      ) {
        return;
      }

      if (event.key === 'ArrowRight') go(1);
      else if (event.key === 'ArrowLeft') go(-1);
      else return;
      event.preventDefault();
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detail, gallery, go]);

  /**
   * A swipe is paged, not free.
   *
   * The card follows the finger for feedback, but only as far as the neighbour
   * on either side — a gesture moves at most one card. On release it commits to
   * that neighbour if the swipe passed the halfway mark, or bounces back to the
   * card it started on; either way the target is a whole card, so the ease lands
   * on one and the carousel never rests between two.
   */
  const onPointerMove = (event: React.PointerEvent) => {
    const start = drag.current;
    if (!start) return;
    const dx = event.clientX - start.x;
    if (!dragged.current) {
      // Ignore jitter until the movement is clearly a drag, so a tap that
      // wobbles a pixel still opens the card rather than nudging the carousel.
      if (Math.abs(dx) <= 6) return;
      dragged.current = true;
      // Hold the gesture even if the finger wanders off the card — on a phone a
      // horizontal swipe drifts vertically, and losing the pointer there would
      // strand the carousel mid-slide with no release to settle it.
      root.current?.setPointerCapture?.(event.pointerId);
    }
    const width = stage.current?.clientWidth ?? 1;
    const delta = Math.max(-1, Math.min(1, ((event.clientX - start.x) / width) * 2.2));
    seek(start.from - delta);
  };

  const settleDrag = () => {
    if (!drag.current) return;
    const from = drag.current.from;
    const swiped = dragged.current; // left set for onClickCapture; not reset here
    drag.current = null;
    // A tap that never became a drag just settles onto the whole card it is on
    // (in case a wheel was mid-ease), and leaves the click to open the project.
    if (!swiped) {
      seek(from);
      return;
    }
    // Past the halfway mark commits to the neighbour; short of it bounces back.
    // `from` is a whole card and the step is at most one, so this always lands
    // the carousel on a single card — never between two.
    const moved = target.current - from;
    const step = Math.abs(moved) >= 0.5 ? Math.sign(moved) : 0;
    seek(from + step);
  };

  return (
    <>
      <Timeline
        geometry={geometry}
        activeProject={ordered[active]}
        cursorRef={cursor}
        onPick={seek}
      />

      <div
        ref={root}
        className="carousel"
        role="group"
        aria-roledescription="carousel"
        aria-label="Selected work"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onWheel={onWheel}
        onPointerDown={(event) => {
          // Stops the container taking focus from a pointer, so the focus ring
          // is only ever the keyboard's. `:focus-visible` is meant to do this
          // on its own and does not for a `tabindex` container in Chrome — a
          // click leaves the ring up for the whole time the reader is dragging
          // through the cards. Keyboard focus still lands here and is still
          // shown, which is the part that matters.
          //
          // Mouse only. On touch, cancelling the default action here also
          // cancels the pan the browser was about to start, so a finger that
          // came to scroll the page finds it frozen. `touch-action: pan-y` is
          // what governs there, and it needs the default left alone.
          if (event.pointerType === 'mouse') event.preventDefault();
          window.clearTimeout(settle.current);
          dragged.current = false;
          // From a whole card, so paging is measured against a settled position
          // even if a wheel or a previous swipe was still easing when this began.
          drag.current = { x: event.clientX, from: Math.round(target.current) };
        }}
        // A drag has to swallow the click that follows it. Without this, pulling
        // the carousel sideways also counts as a click on whichever card the
        // pointer went down on, and scrubbing opens a dialog every time.
        onClickCapture={(event) => {
          if (!dragged.current) return;
          dragged.current = false;
          event.preventDefault();
          event.stopPropagation();
        }}
        onPointerMove={onPointerMove}
        onPointerUp={settleDrag}
        // A cancel (the browser taking the gesture for a vertical scroll, a
        // system edge-swipe, an interrupted touch) must settle too — clearing
        // the drag without snapping was what left the carousel parked between
        // two cards on the phone.
        onPointerCancel={settleDrag}
      >
        <div className="carousel-stage" ref={stage}>
          {ordered.map((project, index) => {
            let offset = (index - active + count) % count;
            if (offset > count / 2) offset -= count;
            const near = Math.abs(offset) <= 1;

            return (
              <article
                key={project.id}
                className="project-card"
                role="group"
                aria-roledescription="slide"
                aria-label={`${index + 1} of ${count}`}
                aria-hidden={!near || undefined}
                // The visible ring is interactive, the hidden stack is not.
                // Gating on `active` alone made the two neighbours inert too,
                // and `inert` swallows pointer events — so the dimmed cards
                // beside the front one could not be clicked at all.
                inert={!near}
              >
                {/* The front card opens the detail; a neighbour scrolls itself
                    to the middle. A button rather than a click handler on the
                    article, so it is reachable, announced and activated by
                    keyboard without any of that being reimplemented.

                    `offset` is the card's signed distance from the front (-1,
                    0 or +1 for the visible three), so `go(offset)` steps the
                    carousel the short way onto a neighbour and wraps at the
                    ends, rather than seeking its raw index and scrolling the
                    long way round. The neighbours are out of the tab order —
                    the arrow keys and the dots already move the carousel, and a
                    tab stop per side card would just say the same thing twice. */}
                <button
                  type="button"
                  className="project-open"
                  tabIndex={index === active ? undefined : -1}
                  onClick={() => (index === active ? setDetail(project) : go(offset))}
                >
                  <span className="sr-only">
                    {index === active ? `Open ${project.title}` : `Show ${project.title}`}
                  </span>
                </button>

                <CardFace
                  project={project}
                  employer={project.experienceId ? employers[project.experienceId] : undefined}
                  near={near}
                  /* Plays only while this is the front card AND nothing is open
                     over it: opening a project pauses its looping card preview
                     so the clip is not running behind the modal while the
                     modal's own copy plays. It resumes, from where it left off,
                     when the modal closes. */
                  playing={index === active && detail === null}
                />
              </article>
            );
          })}

          {/* Small chevrons flanking the card, so it reads as swipeable where a
              stack of peeking neighbours is not obvious — chiefly the phone,
              where the CSS shows them. Real controls too: each steps the
              carousel, and the label is what a screen reader announces. */}
          <button
            type="button"
            className="carousel-nav carousel-nav-prev"
            aria-label="Previous project"
            onClick={(event) => {
              event.stopPropagation();
              go(-1);
            }}
          >
            <span aria-hidden="true">‹</span>
          </button>
          <button
            type="button"
            className="carousel-nav carousel-nav-next"
            aria-label="Next project"
            onClick={(event) => {
              event.stopPropagation();
              go(1);
            }}
          >
            <span aria-hidden="true">›</span>
          </button>
        </div>

        <div className="carousel-controls">
          <ol className="carousel-dots">
            {ordered.map((project, index) => (
              <li key={project.id}>
                <button
                  type="button"
                  className="carousel-dot"
                  aria-current={index === active || undefined}
                  aria-label={`Show ${project.title}`}
                  onClick={() => seek(index)}
                />
              </li>
            ))}
          </ol>

          <button type="button" className="gallery-button" onClick={() => setGallery(true)}>
            All projects
          </button>
        </div>
      </div>

      <Dialog open={detail !== null} onClose={() => setDetail(null)} label={detail?.title ?? ''}>
        {detail ? (
          <ProjectDetail
            project={detail}
            employer={detail.experienceId ? employers[detail.experienceId] : undefined}
          />
        ) : null}
      </Dialog>

      <Dialog open={gallery} onClose={() => setGallery(false)} label="All projects" wide>
        <Gallery
          projects={projects}
          employers={employers}
          onOpen={(project) => {
            setGallery(false);
            setDetail(project);
          }}
        />
      </Dialog>
    </>
  );
}

/* -------------------------------------------------------------------------
   Timeline
------------------------------------------------------------------------- */

type Geometry = ReturnType<typeof timelineGeometry>;

/**
 * Card widths are rounded down to a multiple of this.
 *
 * The well is 16:9, so a width divisible by 16 makes its height a whole number
 * of pixels — and a card whose parts are whole pixels is a card whose centring
 * translate is one too. Rounding down rather than to nearest, because every
 * bound this is applied to is a maximum.
 */
const GRID = 16;

/**
 * The card's rule, both sides. `box-sizing` is border-box everywhere, so the
 * well is this much narrower than the card — and it is the well that has to
 * divide by 16, not the card. Coupled to `.project-card`'s border-width in the
 * stylesheet; if that changes, this does.
 */
const BORDER = 2;

/** An even number at least as large, so `translate(-50%)` is a whole pixel. */
function even(value: number) {
  return Math.ceil(value / 2) * 2;
}

/** A card width whose 16:9 well is a whole number of pixels tall. */
function toGrid(bound: number) {
  return Math.max(Math.floor((bound - BORDER) / GRID) * GRID, GRID) + BORDER;
}

/** The well's height, given that card width. Exact by construction. */
function wellHeight(cardWidth: number) {
  return ((cardWidth - BORDER) * 9) / 16;
}

/**
 * The least whitespace two labels on the line may sit apart, when the
 * stylesheet has not said.
 *
 * Read from `--join-gutter` at measure time rather than fixed here, because the
 * right answer changes with what a label *is*. Set against a company name it is
 * the gap between two runs of text and wants to be generous; below the width
 * where the names are hidden a label is a lone badge, and 20px of clearance
 * around a 28px square is enough to push two badges 45px apart onto separate
 * rows for no reason a reader could see. That regression cost a phone-sized
 * viewport its no-scroll layout, which is how it was found.
 */
const GUTTER = 20;

/** The same, for year ticks, which are shorter and can sit closer. */
const YEAR_GAP = 4;

/** Months since epoch, for placing a date on a line. */
function monthsOf(iso: string) {
  const [year, month] = iso.split('-').map(Number);
  return year * 12 + (month - 1);
}

/**
 * Where everything sits on the line, as percentages.
 *
 * Computed once and shared, because the line draws a dot per project and the
 * cursor slides between those dots — two calculations that disagree by a
 * rounding error would show as a cursor that never quite lands on a mark.
 *
 * Positions are elapsed time, not one slot per item: a degree that ran four
 * years and a job that ran seven months should not occupy the same width.
 */
function timelineGeometry(
  experiences: Experience[],
  projects: Project[],
  education: Education[],
) {
  const schools = [...education].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const ordered = [...experiences].sort((a, b) => a.startDate.localeCompare(b.startDate));

  /**
   * The line runs from the earliest thing on it to the latest, rather than from
   * the degree to the last project.
   *
   * It used to start at the one education record, which was safe only because
   * there was exactly one and it necessarily came first. With a list, the first
   * school is whichever started first — and with an empty list the line has to
   * start at the first job instead, rather than at `NaN`.
   */
  const starts = [
    ...schools.map((school) => monthsOf(school.startDate)),
    ...ordered.map((item) => monthsOf(item.startDate)),
  ];
  const min = starts.length > 0 ? Math.min(...starts) : 0;
  const max = Math.max(
    min,
    ...projects.map((project) => monthsOf(project.date)),
    ...experiences.map((item) => monthsOf(item.endDate ?? item.startDate)),
    ...schools.map((school) => monthsOf(school.endDate ?? school.startDate)),
  );

  /**
   * The line warps to project density: a year with more projects on it is drawn
   * wider than a year with few.
   *
   * A to-scale axis gives every calendar year the same width, so a year that
   * shipped four projects looks no wider than an empty one and its marks crowd
   * into the same span as the lone mark in a quiet year. Weighting each year by
   * how many projects fall in it spends the line where the work is: busy years
   * get the most room and their projects spread far enough apart to tell apart,
   * while quiet stretches — a degree, a gap between jobs — compress to a thin run
   * of context.
   *
   * Each year's weight is a small base, so an empty year still exists and the
   * line stays unbroken, plus one for every project in it. The weights add up
   * into the year boundaries, so a year's share of the line is its share of the
   * total weight, and within a year a date interpolates by month. The mapping
   * stays monotonic — later is always further right — so it is a warp, not a
   * scramble.
   */
  const firstYear = Math.floor(min / 12);
  const lastYear = Math.floor(max / 12);

  const projectsInYear = new Map<number, number>();
  for (const project of projects) {
    const year = Math.floor(monthsOf(project.date) / 12);
    projectsInYear.set(year, (projectsInYear.get(year) ?? 0) + 1);
  }

  // Warp by project density, but floor every year wide enough that its label
  // fits even on a phone. Each year gets `MIN_YEAR` percent of the line outright
  // — so a quiet year (a gap, or a job year that shipped nothing public, like
  // 2023) still has room for its label — and the rest is shared out by how many
  // projects the year holds, so a busy year still runs several times longer. The
  // floor is capped so a very long career still leaves room to vary.
  const yearCount = lastYear - firstYear + 1;
  let countedProjects = 0;
  for (let year = firstYear; year <= lastYear; year += 1) {
    countedProjects += projectsInYear.get(year) ?? 0;
  }

  const MIN_YEAR = Math.min(5.5, 70 / yearCount); // percent of the line per year
  const densityBudget = Math.max(100 - MIN_YEAR * yearCount, 0);
  const yearWidth = (year: number) =>
    MIN_YEAR +
    (countedProjects > 0
      ? densityBudget * ((projectsInYear.get(year) ?? 0) / countedProjects)
      : densityBudget / yearCount);

  // Cumulative start of each year, in percent; the widths sum to 100.
  const startBefore = new Map<number, number>();
  let acc = 0;
  for (let year = firstYear; year <= lastYear; year += 1) {
    startBefore.set(year, acc);
    acc += yearWidth(year);
  }

  const place = (t: number) => {
    const year = Math.min(Math.max(Math.floor(t / 12), firstYear), lastYear);
    const before = startBefore.get(year) ?? 0;
    const monthFrac = Math.min(Math.max((t - year * 12) / 12, 0), 1);
    return before + monthFrac * yearWidth(year);
  };

  const at = (iso: string) => place(monthsOf(iso));

  // Where the career (the first job) begins on the warped line. The years before
  // it carry no projects, so the density warp already draws them thin; the
  // lighter rule up to here just signposts that compressed run of context.
  const careerStart = ordered.length > 0 ? monthsOf(ordered[0].startDate) : min;
  const lead = place(careerStart);

  // A tick per whole year. Which of these actually show is decided per-viewport
  // by the pixel-measured thinning in `Timeline` (see `stack`), so every year is
  // emitted here and the crowded ones are hidden where the line has no room —
  // rather than dropped now against a width this code cannot see.
  const years = [];
  for (let year = Math.ceil(min / 12); year * 12 <= max; year += 1) {
    years.push({ year, left: place(year * 12) });
  }

  return {
    /** Where the career begins on the warped line, as a percentage. The rule is
     *  drawn in two pieces so the pre-career context can be shown lighter. */
    lead,
    ticks: years,
    /**
     * Schools and companies, as one list of the same thing.
     *
     * A school is a join like any other as far as the line is concerned: a tick
     * where something started, a name, a line under it, a range, and a mark.
     * That is why a school can carry a logo now — it was never the badge that
     * refused to draw one, it was the education record having nowhere to put it.
     *
     * Sorted together by start date rather than schools-then-jobs, because
     * overlapping them is normal: a degree finished after the first job started
     * should still sit where it started. Ids are prefixed so a school and a
     * company that happen to share one cannot collide as React keys or in the
     * open-tooltip state.
     *
     * Each join carries its own dates, rather than the line drawing the badges
     * and a parallel list carrying the ranges. Two lists of the same things is
     * two places to change and one place to forget; the badge is the thing you
     * point at, so the dates belong on it.
     */
    joins: [
      ...schools.map((item) => ({
        id: `school-${item.id}`,
        label: item.school,
        sub: item.credential,
        logo: item.logo as Asset | undefined,
        /**
         * A real range once there is one, and the old non-committal phrasing
         * until then.
         *
         * A job with no end date is a job you still have, and 'Present' says
         * so. A school with no end date is far more often one whose end date
         * has not been typed in yet — and rendering that as 'Sep 2017 —
         * Present' tells a reader you are currently enrolled, which is a claim
         * about someone's life made out of a blank field. 'from Sep 2017' says
         * only what is known.
         */
        range: item.endDate
          ? formatRange(item.startDate, item.endDate)
          : `from ${formatMonth(item.startDate)}`,
        iso: isoRange(item.startDate, item.endDate),
        left: at(item.startDate),
        start: item.startDate,
      })),
      ...ordered.map((item) => ({
        id: `job-${item.id}`,
        label: item.company,
        sub: item.role,
        logo: item.logo as Asset | undefined,
        range: formatRange(item.startDate, item.endDate),
        iso: isoRange(item.startDate, item.endDate),
        left: at(item.startDate),
        start: item.startDate,
      })),
    ].sort((a, b) => a.start.localeCompare(b.start)),
    marks: projects.map((project, index) => ({
      index,
      id: project.id,
      title: project.title,
      date: project.date,
      left: at(project.date),
    })),
  };
}

/**
 * The career as one continuous line: a rule end to end, a tick where each thing
 * started, and the projects distributed along it. Not a bar per job — the line
 * is the career, and cutting it into segments makes the gaps between jobs look
 * like part of the design rather than like nothing happening.
 */
function Timeline({
  geometry,
  activeProject,
  cursorRef,
  onPick,
}: {
  geometry: Geometry;
  activeProject?: Project;
  cursorRef: React.RefObject<HTMLSpanElement | null>;
  onPick: (index: number) => void;
}) {
  const track = useRef<HTMLDivElement>(null);

  /**
   * Which badge is showing its dates.
   *
   * `sticky` is the difference between a hover and a tap. A pointer that moves
   * away should take the tooltip with it; a tap has no "away" to move to, so
   * clicking pins it until something else is clicked. One state rather than
   * two, because a hover and a tap cannot both be showing at once.
   */
  const [open, setOpen] = useState<{ id: string; sticky: boolean } | null>(null);

  // A pinned tooltip closes the way a menu does — on anything else, or on
  // Escape. Without this a tap on a phone leaves it up with no way back.
  useEffect(() => {
    if (!open?.sticky) return;

    const away = (event: PointerEvent) => {
      if (!(event.target as Element | null)?.closest?.('.timeline-join')) setOpen(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(null);
    };

    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  /**
   * Which row each label sits in.
   *
   * Two joins eight months apart are about ninety pixels apart on a nine-year
   * line, and the labels they carry are wider than that — PayPal and Intuit
   * Mailchimp overlapped by a third of a label. No amount of type tuning fixes
   * that, because the positions are the data: the line is time, and July 2022
   * and April 2023 really are that close together.
   *
   * So a label that will not fit beside its neighbour moves up a row and grows
   * a leader back down to its own tick. Greedy, left to right, first row with
   * clearance wins — which keeps everything on row 0 when there is room and
   * only stacks the ones that genuinely collide.
   *
   * Widths are measured rather than estimated. A label's width depends on the
   * font that actually loaded, and guessing it is how a layout that passes on
   * one machine overlaps on another.
   */
  useEffect(() => {
    const node = track.current;
    if (!node) return;

    const stack = () => {
      const joins = [...node.querySelectorAll<HTMLElement>('.timeline-join')];
      // The band, not the track, is what percentages resolve against — it is
      // inset on wide screens — so its width is what turns a join's `left`
      // percentage into the pixel centre the collision and nudge math need.
      const band = node.querySelector<HTMLElement>('.timeline-band');
      const width = band?.clientWidth ?? node.clientWidth;
      if (joins.length === 0 || width === 0) return;

      // How far the band is held back from each edge of the track. A label
      // centred on an end tick may spill this far past the band before it hits
      // the track edge, which is the room that lets the first and last labels
      // sit under their marks instead of being nudged off them.
      const inset = Math.max(0, (node.clientWidth - width) / 2);

      const gutter =
        parseFloat(getComputedStyle(node).getPropertyValue('--join-gutter')) || GUTTER;

      // The right edge of the last label placed in each row, in pixels.
      const edges: number[] = [];
      // A row has to be at least as tall as the tallest thing standing in it,
      // or lifting a label by one row leaves it short of clearing the one
      // below and overflowing the top of the track.
      let tallest = 0;

      for (const join of joins) {
        const label = join.querySelector<HTMLElement>('.timeline-company');
        const box = label?.getBoundingClientRect();
        const center = (parseFloat(join.style.left) / 100) * width;
        const half = (box?.width ?? 0) / 2;

        /**
         * Keep the centred label on the track.
         *
         * Centred on its tick, the first label (at 0%) hangs half its width off
         * the left edge and the last could hang off the right. `--nudge` is the
         * push, in pixels, that brings a clipping label back inside — zero for
         * the labels that already fit, which is most of them. The tick does not
         * move with it, so a clamped label points slightly to one side of its
         * mark rather than being cut in half, the honest trade at a line's ends.
         */
        // Clamp against the track, not the band: a centred label may use the
        // band's own margin, so it only needs pushing when it would leave the
        // track itself. `center + inset` is the label's centre in track space.
        let nudge = 0;
        const trackCenter = center + inset;
        if (trackCenter - half < 0) nudge = -(trackCenter - half);
        else if (trackCenter + half > node.clientWidth) nudge = node.clientWidth - (trackCenter + half);

        // The label's real span after the nudge — this, not the centred span,
        // is what can collide, because the nudge is exactly what moved a flush
        // edge label off centre and into its neighbour's space.
        const start = center - half + nudge;
        const end = center + half + nudge + gutter;

        let row = edges.findIndex((edge) => start >= edge);
        if (row === -1) row = edges.length;
        edges[row] = end;
        tallest = Math.max(tallest, box?.height ?? 0);

        join.style.setProperty('--row', String(row));
        join.style.setProperty('--nudge', `${Math.round(nudge)}px`);
      }

      node.style.setProperty('--rows', String(edges.length));
      node.style.setProperty('--row-h', `${Math.ceil(tallest) + 4}px`);

      /**
       * Years, thinned.
       *
       * The warp crushes the quiet years together — several into a narrow run —
       * and a handful of labels in fifty pixels is not a scale, it is a smudge.
       * Any year that would collide with the last one kept is dropped, left to
       * right, so what survives is a legible sample that gets denser where the
       * line has room.
       *
       * The latest year is always kept: it is the line's right anchor, and on a
       * narrow band (the phone, where the band spans the whole width) it was the
       * casualty of a plain left-to-right pass — 2026 fell to 2025 sitting a few
       * pixels to its left. So the last label is reserved first, an earlier label
       * that would touch it is dropped, and the first label always survives too.
       *
       * Measured in three passes rather than one: everything is un-hidden
       * first, then every box is read, then the decisions are written. Reading
       * and writing in the same loop would measure some of them against the
       * layout the earlier ones had already changed.
       */
      const years = [...node.querySelectorAll<HTMLElement>('.timeline-year')];
      for (const year of years) year.removeAttribute('data-crowded');

      const boxes = years.map((year) => year.getBoundingClientRect());
      const count = years.length;

      if (count > 0) {
        // Keep years from the right — the recent, dense end where the work is —
        // so when a narrow band cannot hold every label it is the compressed old
        // years that thin, never a recent one (2024, 2025). Both endpoints are
        // pinned: the latest anchors the right, the first marks the start. With
        // the two-digit labels on a phone this rarely has to drop anything.
        const keep = new Array<boolean>(count).fill(false);
        keep[0] = true;
        keep[count - 1] = true;

        // Walk right to left, keeping a year whenever it clears the last one kept.
        let nextLeft = boxes[count - 1].left;
        for (let index = count - 2; index >= 1; index -= 1) {
          if (boxes[index].right <= nextLeft - YEAR_GAP) {
            keep[index] = true;
            nextLeft = boxes[index].left;
          }
        }

        // The pinned first year can still butt against whatever was kept just to
        // its right; drop that neighbour so the start stays clean.
        for (let index = 1; index < count - 1; index += 1) {
          if (keep[index] && boxes[index].left < boxes[0].right + YEAR_GAP) keep[index] = false;
        }

        years.forEach((year, index) => {
          if (!keep[index]) year.setAttribute('data-crowded', '');
        });
      }
    };

    stack();
    const observer = new ResizeObserver(stack);
    observer.observe(node);
    return () => observer.disconnect();
  }, [geometry]);

  return (
    <div className="timeline">
      {/* The rule, the years and the marks are decoration — a position on a
          line is not information anyone can hear, and each is hidden
          individually. The joins are not: they are buttons now, and a
          focusable control inside an `aria-hidden` subtree is unreachable by
          keyboard while still being in the tab order. */}
      <div className="timeline-track" ref={track}>
        {/* The positioned band. Everything on the line lives in here, and on a
            wide screen it is inset from the track's edges — the labels centre on
            their ticks, so the first and last need room to sit under their mark
            instead of hanging off the end. The inset is zero on a phone, where
            the labels are hidden and only the narrow badges remain, so nothing
            is given away to a margin that is not needed. Percentages resolve
            against this band's width, which is why the inset moves the whole
            line inward rather than distorting it. */}
        <div className="timeline-band">
          {/* Two pieces, because the scale changes between them. The lighter one
              covers the years before the first job, which are compressed. */}
          <span
            aria-hidden="true"
            className="timeline-rule timeline-rule-lead"
            style={{ left: 0, width: `${geometry.lead}%` }}
          />
        <span
          aria-hidden="true"
          className="timeline-rule"
          style={{ left: `${geometry.lead}%`, width: `${100 - geometry.lead}%` }}
        />

        {/* An arrowhead capping the right end, in the accent, so the line reads
            as pointing to now rather than simply stopping. Decoration. */}
        <span aria-hidden="true" className="timeline-cap" />

        {geometry.ticks.map((tick) => (
          <span
            key={tick.year}
            aria-hidden="true"
            className="timeline-year"
            style={{ left: `${tick.left}%` }}
          >
            {/* Full year on a roomy screen; two digits on a phone, where the
                narrow band cannot hold nine four-digit labels without them
                colliding — half the width lets every year stay on. Only one is
                ever displayed, so the collision measurement reads the right one. */}
            <span className="timeline-year-full">{tick.year}</span>
            <span className="timeline-year-short">&rsquo;{String(tick.year).slice(-2)}</span>
          </span>
        ))}

        {/* An ordered list, because the order is the meaning — this is a
            sequence in time, and it should say so without the rule needing to
            be described. */}
        <ol className="timeline-joins">
          {geometry.joins.map((join) => {
            const showing = open?.id === join.id;

            return (
              <li key={join.id} className="timeline-join" style={{ left: `${join.left}%` }}>
                <button
                  type="button"
                  className="timeline-company"
                  /* The whole fact, in one string. The name and role are hidden
                     by CSS on a narrow screen and the dates are never rendered
                     as text, so nothing here can be assembled from what happens
                     to be on screen. */
                  aria-label={`${join.label} — ${join.sub}, ${join.range}`}
                  onPointerEnter={(event) => {
                    // Mouse only. A touch fires this on tap and would show the
                    // tooltip and then immediately pin it.
                    if (event.pointerType !== 'mouse') return;
                    setOpen((current) => (current?.sticky ? current : { id: join.id, sticky: false }));
                  }}
                  onPointerLeave={() => setOpen((current) => (current?.sticky ? current : null))}
                  onClick={() =>
                    setOpen((current) =>
                      current?.id === join.id && current.sticky
                        ? null
                        : { id: join.id, sticky: true },
                    )
                  }
                  onFocus={() =>
                    setOpen((current) =>
                      current?.id === join.id ? current : { id: join.id, sticky: false },
                    )
                  }
                  onBlur={() => setOpen((current) => (current?.sticky ? current : null))}
                >
                  {/* Name over mark, both centred on the tick. The name reads
                      first and labels the mark under it, and the column is
                      centred so a wide name and a square badge share one axis
                      rather than hanging off the left of the tick. The role is
                      not here — it is a hover away in the tooltip, and putting
                      it back would be saying it twice and doubling the row. */}
                  <span className="timeline-name">{join.label}</span>
                  <Badge name={join.label} logo={join.logo} />
                </button>

                {/* Flipped past halfway, so a tooltip on a late join opens back
                    across the line it belongs to rather than off the edge of a
                    phone — where the page clips overflow and it would simply
                    not be there. */}
                <span
                  className="timeline-detail"
                  data-open={showing || undefined}
                  data-flip={join.left > 50 || undefined}
                  aria-hidden="true"
                >
                  <span className="timeline-detail-company">{join.label}</span>
                  <span className="timeline-detail-role">{join.sub}</span>
                  <time dateTime={join.iso}>{join.range}</time>
                </span>
              </li>
            );
          })}
        </ol>

        {/* Each project's mark is a control now, not decoration: clicking it
            moves the carousel to that project, and hovering, focusing or tapping
            it names the project and its date above the tick. These are the
            accessible way into a project from the line, which is why the
            screen-reader-only list that used to sit below is gone — it would be
            the same buttons said twice. The tooltip flips to an edge anchor near
            the ends of the line so it does not run off the screen. */}
        {geometry.marks.map((mark) => {
          const edge = mark.left < 10 ? 'start' : mark.left > 90 ? 'end' : undefined;
          return (
            <button
              key={mark.id}
              type="button"
              className="timeline-mark"
              style={{ left: `${mark.left}%` }}
              aria-label={`${mark.title}, ${formatMonth(mark.date)}`}
              aria-current={activeProject?.id === mark.id || undefined}
              onClick={() => onPick(mark.index)}
            >
              <span className="timeline-mark-tip" data-edge={edge} aria-hidden="true">
                {mark.title} · {formatMonth(mark.date)}
              </span>
            </button>
          );
        })}

          {/* Rides the carousel's continuous position, so it slides between two
              projects rather than snapping to whichever is nearest. Placed from
              the animation frame, which is why it is a ref. */}
          <span ref={cursorRef} aria-hidden="true" className="timeline-cursor" />
        </div>
      </div>

      <p className="timeline-now" aria-live="polite">
        {activeProject ? `${activeProject.title} · ${formatMonth(activeProject.date)}` : ''}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------
   Dialogs
------------------------------------------------------------------------- */

/**
 * A native `<dialog>`. The focus trap, the Escape key, the inert background and
 * the top layer are all the platform's — reimplementing any of them is how
 * modals end up leaking focus to the page behind.
 */
function Dialog({
  open,
  onClose,
  label,
  wide,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="dialog"
      data-wide={wide || undefined}
      aria-label={label}
      onClose={onClose}
      // The backdrop is part of the dialog's own box, so a click lands on the
      // dialog itself — comparing the target is what separates "clicked
      // outside" from "clicked the panel".
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="dialog-panel">
        <button type="button" className="dialog-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        {children}
      </div>
    </dialog>
  );
}

/* -------------------------------------------------------------------------
   Gallery
------------------------------------------------------------------------- */

function Gallery({
  projects,
  employers,
  onOpen,
}: {
  projects: Project[];
  employers: Record<string, Experience>;
  onOpen: (project: Project) => void;
}) {
  const [company, setCompany] = useState('all');
  const [order, setOrder] = useState<'newest' | 'oldest'>('newest');

  const companies = useMemo(() => {
    const seen = new Map<string, string>();
    for (const project of projects) {
      const employer = project.experienceId ? employers[project.experienceId] : undefined;
      seen.set(employer?.id ?? 'personal', employer?.company ?? 'Personal');
    }
    return [...seen].map(([id, name]) => ({ id, name }));
  }, [projects, employers]);

  const shown = useMemo(() => {
    const filtered = projects.filter((project) => {
      if (company === 'all') return true;
      return (project.experienceId ?? 'personal') === company;
    });
    return [...filtered].sort((a, b) =>
      order === 'newest' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date),
    );
  }, [projects, company, order]);

  return (
    <>
      <h2 className="dialog-title">All projects</h2>

      <div className="gallery-filters">
        <label className="field">
          <span className="field-label">Company</span>
          <select value={company} onChange={(event) => setCompany(event.target.value)}>
            <option value="all">All</option>
            {companies.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field-label">Sort</span>
          <select
            value={order}
            onChange={(event) => setOrder(event.target.value as 'newest' | 'oldest')}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>

        {/* Announced, so a filter that empties the list is not silence. */}
        <p className="gallery-count" aria-live="polite">
          {shown.length} of {projects.length}
        </p>
      </div>

      <ul className="gallery-grid">
        {shown.map((project) => {
          const employer = project.experienceId ? employers[project.experienceId] : undefined;
          return (
            <li key={project.id}>
              <button type="button" className="gallery-item" onClick={() => onOpen(project)}>
                <span className="gallery-item-meta">
                  {employer ? <Badge name={employer.company} logo={employer.logo} /> : null}
                  {employer ? employer.company : 'Personal'} · {formatMonth(project.date)}
                </span>
                <span className="gallery-item-title">{project.title}</span>
                <span className="gallery-item-summary">{project.summary}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

/* -------------------------------------------------------------------------
   Badges
------------------------------------------------------------------------- */

/**
 * Initials, for an employer with no logo file.
 *
 * Capitalised words only, so "University at Buffalo" is UB rather than UAB —
 * the connector is not part of how anyone shortens the name. One-word names
 * keep one letter; "PP" for PayPal would be inventing an abbreviation nobody
 * uses.
 */
function monogram(name: string) {
  return name
    .split(/\s+/)
    .filter((word) => /^[A-Z]/.test(word))
    .slice(0, 2)
    .map((word) => word[0])
    .join('');
}

/**
 * A company's mark.
 *
 * Draws a monogram unless the experience carries a real logo asset. That
 * default is deliberate: a company logo is a trademark, and Intuit and PayPal
 * both publish guidelines governing how theirs may be shown. This site does not
 * fetch one, approximate one, or ship one it was not given — supply an `Asset`
 * on the experience and it renders instead.
 *
 * Decorative either way. The company's name is set beside it in every place
 * this appears, so the mark is never the only thing carrying the fact.
 */
function Badge({ name, logo }: { name: string; logo?: Asset }) {
  if (logo) {
    return (
      <img
        className="badge"
        src={logo.src}
        alt=""
        width={logo.width}
        height={logo.height}
        aria-hidden="true"
      />
    );
  }

  return (
    <span className="badge badge-mono" aria-hidden="true">
      {monogram(name)}
    </span>
  );
}

/* -------------------------------------------------------------------------
   Cards
------------------------------------------------------------------------- */

/**
 * Whether the visitor has asked for less movement.
 *
 * Read at render rather than in CSS, because a stylesheet cannot stop a video
 * playing — `autoplay` has to actually not be set. `useSyncExternalStore` keeps
 * the answer in the platform rather than in a second copy React owns, and the
 * server has no opinion at all.
 */
const QUIET = '(prefers-reduced-motion: reduce)';

function watchMotion(onChange: () => void) {
  const query = window.matchMedia(QUIET);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function useReducedMotion() {
  return useSyncExternalStore(
    watchMotion,
    () => window.matchMedia(QUIET).matches,
    () => false,
  );
}

/**
 * One asset in the 16:9 well — the shared renderer behind the card's single
 * shot and the modal's gallery, so framing, video behaviour and the well are
 * defined once rather than twice.
 */
/**
 * `viewer` is the difference between the card and the opened modal.
 *
 * On the card a video is a preview — a moving thumbnail — so it behaves like an
 * image: muted, looping, autoplaying, no controls. In the modal you have
 * deliberately opened the thing to watch it, so it gets the native controls
 * (play/pause, scrub, and a volume control to turn the sound on) and does not
 * loop or autoplay with sound, because a browser will not allow sound without a
 * gesture and a viewer wants to press play rather than have it start silently.
 */
/**
 * The last playhead of each card clip, so one that scrolls out of the visible
 * ring and back resumes instead of starting over.
 *
 * A card video unmounts when it leaves the ring — that is the render saving —
 * and a fresh element would otherwise begin at zero. Recording where it was and
 * restoring it on the way back is what turns "unmount" into "pause", which is
 * the difference between resuming and replaying. Module scope so it survives the
 * unmount; client-only and keyed by clip, so it holds a couple of numbers for
 * the life of the page.
 *
 * The modal shares this now, in both directions: opening a project's card seeks
 * the modal's copy to where the card was and closing it hands the position back,
 * so the same clip is one continuous playback across the two surfaces rather
 * than two viewings of it.
 */
const clipTime = new Map<string, number>();

/**
 * The mute choice per clip, shared *reactively* between a card and its modal so
 * a change on either surface shows up on the other — mute in the opened card and
 * it stays muted back in the carousel, unmute in the carousel and it opens
 * unmuted, in both directions. It is a tiny external store rather than a plain
 * Map so both `Media` instances (the card and the modal's copy) re-render when
 * the value changes; `useClipMuted` subscribes to it.
 *
 * An entry is cleared when a card leaves the visible ring and unmounts, so a
 * clip scrolled away and back starts muted again rather than surprising with
 * audio — the modal, which shares a live card, keeps the card's current choice.
 */
const clipMuted = new Map<string, boolean>();
const clipMutedListeners = new Set<() => void>();

function readClipMuted(id: string): boolean {
  // Default muted: a clip must never make noise on its own.
  return clipMuted.get(id) ?? true;
}

function writeClipMuted(id: string, value: boolean) {
  if (clipMuted.get(id) === value) return;
  clipMuted.set(id, value);
  clipMutedListeners.forEach((notify) => notify());
}

/** Drop a clip's choice so it starts muted next time — called when a card unmounts. */
function forgetClipMuted(id: string) {
  if (!clipMuted.has(id)) return;
  clipMuted.delete(id);
  clipMutedListeners.forEach((notify) => notify());
}

function subscribeClipMuted(notify: () => void) {
  clipMutedListeners.add(notify);
  return () => {
    clipMutedListeners.delete(notify);
  };
}

/** The shared mute value for one clip, and a setter, both wired to the store. */
function useClipMuted(id: string): [boolean, (value: boolean) => void] {
  const muted = useSyncExternalStore(
    subscribeClipMuted,
    () => readClipMuted(id),
    () => true,
  );
  return [muted, (value: boolean) => writeClipMuted(id, value)];
}

/** Arrow leaving a box — the "opens into a detail view" glyph for the card hint. */
function OpenIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </svg>
  );
}

/** Speaker glyph for the card's mute toggle — waves when on, a cross when off. */
function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11 5 6 9H2v6h4l5 4V5z" fill="currentColor" stroke="none" />
      {muted ? (
        <path d="m16 9 5 6M21 9l-5 6" />
      ) : (
        <>
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M18.5 5.5a9 9 0 0 1 0 13" />
        </>
      )}
    </svg>
  );
}

function Media({
  shot,
  viewer = false,
  play = false,
  active = true,
}: {
  shot: Asset;
  viewer?: boolean;
  play?: boolean;
  /**
   * Modal only: whether this is the gallery image currently on screen. The
   * gallery keeps every image's element mounted and toggles this rather than
   * swapping the element out, so a clip's own playhead survives stepping to
   * another image and back — it simply pauses while it is off screen and
   * resumes from where it was, no seeking required.
   */
  active?: boolean;
}) {
  const reduced = useReducedMotion();
  const video = useRef<HTMLVideoElement>(null);
  const isVideo = shot.media === 'video';
  // A clip the editor marked as having no audio: it stays muted and its toggle
  // is shown disabled, so nobody presses an unmute that would change nothing.
  const silent = isVideo && shot.hasAudio === false;

  /**
   * The mute choice is shared between this card and its modal through
   * `useClipMuted`, so toggling on either surface holds on the other. It starts
   * muted — audio that begins on its own as a card drifts into place is exactly
   * what nobody asked for, and muted is what lets the card autoplay at all — and
   * the choice is forgotten when the card unmounts (see below), so scrolling
   * back to a clip never surprises with audio.
   */
  const [muted, setMuted] = useClipMuted(shot.id);

  /**
   * When the card leaves the ring its choice is dropped, so it comes back muted.
   * Only the card does this; the modal shares a still-mounted card and must not
   * wipe the choice when it closes — that is precisely the value the card needs
   * to resume with.
   */
  useEffect(() => {
    if (viewer) return;
    return () => forgetClipMuted(shot.id);
  }, [viewer, shot.id]);

  /**
   * A card video plays only while its card is the front one, and it is driven
   * from here rather than by the `autoPlay` attribute.
   *
   * The same element stays mounted as a card slides between front and
   * neighbour, and `autoPlay` acts once, at mount — so it cannot start a clip
   * that becomes the front card later, nor stop one that stops being it. Play
   * and pause are called directly on the `play` flag instead. Reduced motion
   * keeps it paused: a clip starting itself is exactly what that setting asks
   * not to happen. The modal drives its own playback through the native
   * controls, so this stands aside there.
   *
   * Mute is set on the element here too, not left to the attribute: React does
   * not reliably reflect the `muted` prop to the DOM property, and the property
   * is what actually silences a playing clip.
   */
  useEffect(() => {
    const el = video.current;
    if (!el || !isVideo) return;

    // The modal plays only the image on screen. The first seek — to the card's
    // recorded playhead, so opening continues the carousel's clip — is done once
    // in onLoadedMetadata; it is deliberately not repeated here, or stepping
    // away to another image and back would snap the clip to that opening
    // position instead of where the reader had watched to. Off screen the clip
    // pauses and its element stays mounted, so its own playhead is preserved
    // natively. Autoplay is allowed because opening the modal is a user gesture;
    // reduced motion leaves it paused for the controls to start.
    if (viewer) {
      el.muted = silent || muted;
      if (active && !reduced) el.play().catch(() => {});
      else el.pause();
      return;
    }

    el.muted = silent || muted;
    if (play && !reduced) el.play().catch(() => {});
    else el.pause();
  }, [play, viewer, isVideo, reduced, muted, silent, shot.id, active]);

  /**
   * The per-image framing, as inline style so it wins over the stylesheet's
   * default. `object-position` is only meaningful under `cover`; on `contain`
   * it is harmless, and the focal point is nulled in the database there anyway
   * unless a zoom is set. A `scale` past 1 magnifies the image toward that same
   * focal point and the frame around it clips the overflow — that clip is the
   * crop. Video is left whole: a clip is composed in its own frame.
   */
  const focal = shot.focalPoint
    ? `${shot.focalPoint.x * 100}% ${shot.focalPoint.y * 100}%`
    : undefined;
  const zoom = !isVideo && shot.scale && shot.scale > 1 ? shot.scale : undefined;
  const framing: React.CSSProperties = {
    objectFit: shot.fit ?? (isVideo ? 'cover' : 'contain'),
    objectPosition: focal,
    transform: zoom ? `scale(${zoom})` : undefined,
    transformOrigin: zoom ? (focal ?? 'center') : undefined,
  };

  if (isVideo) {
    /**
     * The modal is a player, the card is a preview.
     *
     * Both start muted — a clip should never make noise on its own. The modal
     * carries the native controls, and its volume/unmute button is how a
     * viewer turns the sound on when they want it. The front card carries its
     * own corner toggle instead (below), so a clip can be heard from the
     * carousel without opening it. Neither surface autoplays through the
     * attribute: the modal waits for a gesture, and the card's looping preview
     * is started by the effect above only when it is the front card. Native
     * controls appear on the card under reduced motion, where a play button is
     * the honest alternative to a clip that will not move on its own — and they
     * carry their own mute, so the corner toggle stands aside there.
     */
    const showMute = !viewer && !reduced && play;
    return (
      <span className="project-shot-frame">
        <video
          ref={video}
          className="project-shot"
          src={shot.src}
          poster={shot.poster}
          aria-label={shot.alt}
          width={640}
          height={360}
          style={framing}
          muted={silent || muted}
          playsInline
          loop={!viewer}
          controls={viewer || reduced}
          preload="metadata"
          /* Both surfaces record the playhead. The modal shows one image at a
             time and swaps the element out to move between them, so without this
             a clip would unmount when the reader steps to the next image and
             remount at the start when they come back. Recording it means it
             resumes where it was — the same way a card clip resumes after
             scrolling out of the ring — whichever surface last played it. */
          onTimeUpdate={(event) => clipTime.set(shot.id, event.currentTarget.currentTime)}
          /* Restore that playhead once the duration is known: on the card after
             it scrolls out of the ring and back, on the modal after opening or
             stepping away to another image and returning. */
          onLoadedMetadata={(event) => {
            const el = event.currentTarget;
            const at = clipTime.get(shot.id);
            if (at && Number.isFinite(el.duration) && at < el.duration) el.currentTime = at;
          }}
          /* Catches mute changes the native controls make — the modal's, and the
             card's own under reduced motion — and shares them, so a mute chosen
             there holds on the other surface too. The corner toggle below writes
             the same store, and our own `el.muted = muted` echoes back here as a
             no-op (the shared setter ignores an unchanged value). */
          onVolumeChange={(event) => {
            // A silent clip is held muted; its native control changing nothing
            // must not write a mute choice back to the shared store.
            if (!silent) setMuted(event.currentTarget.muted);
          }}
        />
        {showMute ? (
          <button
            type="button"
            className="shot-mute"
            /* A silent clip shows the control disabled and in its muted state, so
               it reads as "there is nothing to unmute" rather than a toggle that
               does nothing when pressed. */
            disabled={silent}
            aria-label={silent ? 'This video has no audio' : muted ? 'Unmute video' : 'Mute video'}
            aria-pressed={silent ? false : !muted}
            /* Sits above the card's invisible open-button, and stops the click
               from reaching it — toggling sound must not also open the modal. */
            onClick={(event) => {
              event.stopPropagation();
              if (silent) return;
              setMuted(!muted);
            }}
          >
            <SpeakerIcon muted={silent || muted} />
          </button>
        ) : null}
      </span>
    );
  }

  return (
    <span className="project-shot-frame">
      <img
        className="project-shot"
        src={shot.src}
        alt={shot.alt}
        width={640}
        height={360}
        style={framing}
      />
    </span>
  );
}

/**
 * The card's shot: the first image, and only the first. The card is a fixed
 * shape in a moving carousel — it is a glance, not a viewer — so it shows the
 * one image the admin ordered to the front and leaves the rest to the modal.
 */
function Shot({ project, play = false }: { project: Project; play?: boolean }) {
  const [shot] = project.images;

  if (!shot) {
    return (
      <div className="project-shot-empty" aria-hidden="true">
        No screenshot yet
      </div>
    );
  }

  return <Media shot={shot} play={play} />;
}

/**
 * Every image, once the card has been opened.
 *
 * This lives only in the modal on purpose: the extra images are detail, and
 * detail is what opening the card is for — putting a carousel inside a carousel
 * on the front page would be two things asking to be swiped in the same spot.
 * With one image it is just the shot; with several it grows arrows, dots and a
 * count, and the arrow keys move it because a dialog is where they are free to.
 */
function ProjectGallery({ project }: { project: Project }) {
  const images = project.images;
  const [index, setIndex] = useState(0);

  if (images.length === 0) {
    return (
      <div className="project-shot-empty" aria-hidden="true">
        No screenshot yet
      </div>
    );
  }

  const many = images.length > 1;
  const go = (step: number) => setIndex((i) => (i + step + images.length) % images.length);

  return (
    <div
      className="gallery-viewer"
      role={many ? 'group' : undefined}
      aria-roledescription={many ? 'carousel' : undefined}
      aria-label={many ? `${project.title} screenshots` : undefined}
      onKeyDown={
        many
          ? (event) => {
              if (event.key === 'ArrowLeft') {
                event.preventDefault();
                go(-1);
              } else if (event.key === 'ArrowRight') {
                event.preventDefault();
                go(1);
              }
            }
          : undefined
      }
    >
      {/* Every image stays mounted; only the active one is shown. Swapping the
          element out on navigation is what reset a playing clip — a persistent
          element keeps its own playhead, so stepping away and back resumes it. */}
      {images.map((image, i) => (
        <div key={image.id} className="gallery-slide" hidden={i !== index}>
          <Media shot={image} viewer active={i === index} />
        </div>
      ))}

      {many ? (
        <>
          <button
            type="button"
            className="gallery-nav gallery-nav-prev"
            aria-label="Previous image"
            onClick={() => go(-1)}
          >
            ‹
          </button>
          <button
            type="button"
            className="gallery-nav gallery-nav-next"
            aria-label="Next image"
            onClick={() => go(1)}
          >
            ›
          </button>

          <ol className="gallery-dots" aria-hidden="true">
            {images.map((image, i) => (
              <li key={image.id}>
                <button
                  type="button"
                  className="gallery-dot"
                  aria-current={i === index || undefined}
                  onClick={() => setIndex(i)}
                />
              </li>
            ))}
          </ol>

          <p className="gallery-counter" aria-live="polite">
            {index + 1} of {images.length}
          </p>
        </>
      ) : null}
    </div>
  );
}

/**
 * How far along it is — but only when that is news.
 *
 * Every finished project carrying a "shipped" badge is a column of the same
 * word, which reads as decoration rather than information. The two states worth
 * saying out loud are the ones that change how the work should be read.
 */
function Status({ status }: { status: Project['status'] }) {
  if (status === 'shipped') return null;
  return (
    <span className="project-status" data-status={status}>
      {status === 'building' ? 'Still building' : 'Archived'}
    </span>
  );
}

function CardFace({
  project,
  employer,
  near,
  playing,
}: {
  project: Project;
  employer?: Experience;
  near: boolean;
  playing: boolean;
}) {
  return (
    <>
      {/* Media loads only for the cards in the visible ring. The ones stacked
          out of sight render an empty well of the same shape instead — same
          height, no image fetched and no video decoding — and mount their real
          media as they slide into view. The front card's video is the only one
          that plays; a neighbour holds on its first frame until it is next. */}
      {near ? (
        <Shot project={project} play={playing} />
      ) : (
        <div className="project-shot-empty" aria-hidden="true" />
      )}
      <div className="project-body">
        {/* A visible cue that the card opens — the whole card is a click target
            but nothing said so. Decorative: the full-card button already
            announces "Open {title}", so repeating it here would be said twice.
            Shown only on the front card (CSS keys it to `[data-centre]`), because
            a click on a neighbour brings it to the middle rather than opening it
            — see the open-button in the carousel. It stays in the layout on the
            others (visibility, not display) so every card body is the same height
            and `fit()` sizes them alike. */}
        <span className="project-hint" aria-hidden="true">
          <OpenIcon />
          Click for details
        </span>
        <p className="project-context">
          {employer ? <Badge name={employer.company} logo={employer.logo} /> : null}
          {employer ? employer.company : 'Personal project'}
          <Status status={project.status} />
        </p>
        <h3 className="project-title">{project.title}</h3>
        <p className="project-summary">{project.summary}</p>
        <ul className="tech-row">
          {project.tech.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </>
  );
}

/**
 * The write-up in the opened card: the STAR breakdown when it has been filled
 * in, and the plain summary otherwise. It sits in its own scroll area so the
 * gallery and title above it stay put and the modal does not grow without bound
 * — which is what lets the STAR sections be as long as they need to be.
 */
function ProjectStory({ project }: { project: Project }) {
  // One cohesive write-up, split into paragraphs on blank lines. The summary is
  // shown above this by the caller, so a project with no story shows only that.
  const story = (project.story ?? '').trim();
  if (!story) return null;

  const paragraphs = story.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);

  // The label sits outside the scroll area so it stays put while the account
  // scrolls under it — and names why this text is longer, muted and scrollable
  // where the summary above is short, in full ink and fixed.
  return (
    <div className="detail-block">
      <span className="detail-label">The story</span>
      <div className="detail-story">
        {paragraphs.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>
    </div>
  );
}

function ProjectDetail({ project, employer }: { project: Project; employer?: Experience }) {
  return (
    <>
      <ProjectGallery project={project} />
      <div className="detail-body">
        <p className="project-context">
          {employer ? <Badge name={employer.company} logo={employer.logo} /> : null}
          {employer ? `Built at ${employer.company}` : 'Personal project'} ·{' '}
          {formatMonth(project.date)}
          {project.duration ? ` · ${project.duration}` : ''}
          <Status status={project.status} />
        </p>
        <h2 className="dialog-title">{project.title}</h2>
        {/* The card's teaser leads the opened card too — a brief line to set the
            project up — with the fuller story flowing underneath it. Each carries
            a small label so it is clear why the two read differently: a short
            fixed summary, then a longer scrollable account. */}
        {project.summary ? (
          <div className="detail-block">
            <span className="detail-label">Summary</span>
            <p className="detail-summary">{project.summary}</p>
          </div>
        ) : null}
        <ProjectStory project={project} />
        <p className="project-impact">{project.impact}</p>

        <ul className="tech-row">
          {project.tech.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        {project.links.length > 0 ? (
          <p className="project-links">
            {project.links.map((link) => (
              <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer">
                {link.label}{' '}
                <span className="link-arrow" aria-hidden="true">
                  ↗
                </span>
              </a>
            ))}
          </p>
        ) : null}
      </div>
    </>
  );
}
