'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import type { Asset, Education, Experience, Project } from '@/content/types';
import { formatMonth, formatRange, isoRange } from '@/lib/format';

/** Cards per notch of wheel travel. Tuned so a normal flick moves about one. */
const WHEEL = 0.0016;

/** How fast the eased position closes on the target, per second. */
const EASE = 9;

/**
 * Idle time before the carousel settles onto a card. Long enough that
 * consecutive wheel notches read as one gesture rather than several.
 */
const SETTLE = 160;

/** Timeline and carousel are one component because they share one position. */
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
   * Re-sorted by date because the database pulls the starred project to the
   * front: index order disagreeing with date order made the timeline cursor
   * jump. The star is honoured separately, as the position the carousel starts
   * on.
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
   * Position is a continuous float, not an index, so every card's transform is a
   * function of its distance from it and the cards slide rather than step.
   *
   * It lives in a ref written to the DOM straight from the animation frame:
   * re-rendering the cards sixty times a second so React can reconcile a tree
   * whose only change is a transform string is the expensive way to do this.
   * Only the rounded position goes into state.
   */
  const position = useRef(start);
  const target = useRef(start);
  const stage = useRef<HTMLDivElement>(null);
  const cursor = useRef<HTMLSpanElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const settle = useRef(0);
  /**
   * Card spacing, mirrored from CSS: `paint()` runs every frame and cannot
   * afford a `getComputedStyle`, so `fit()` reads it once per resize.
   */
  const spacing = useRef(0.62);

  /**
   * Shared by the line's dots and the cursor that slides between them: two
   * calculations disagreeing by a rounding error would show as a cursor that
   * never quite lands on a mark.
   */
  const geometry = useMemo(
    () => timelineGeometry(experiences, ordered, education),
    [experiences, ordered, education],
  );

  // Layout is a pure function of position, so the frame loop and a jump cannot
  // disagree.
  const paint = useCallback(() => {
    const node = stage.current;
    if (!node) return;

    const cards = node.querySelectorAll<HTMLElement>('.project-card');

    // Signed distance from the middle, wrapped: the carousel is a cycle, so the
    // newest card sits beside the oldest with no end to run into either way.
    const offsets = Array.from(cards, (_, index) => {
      let offset = (index - position.current) % count;
      if (offset > count / 2) offset -= count;
      if (offset < -count / 2) offset += count;
      return offset;
    });

    /**
     * A rank, not a threshold on distance: halfway between two cards the two
     * furthest are equidistant and land on the same side of any cutoff, showing
     * four cards instead of three. Ranking holds the count by construction.
     */
    const rank = offsets
      .map((offset, index) => ({ index, distance: Math.abs(offset) }))
      .sort((a, b) => a.distance - b.distance)
      .map((entry) => entry.index);

    cards.forEach((card, index) => {
      const offset = offsets[index] ?? 0;
      const distance = Math.abs(offset);
      const scale = Math.max(1 - distance * 0.13, 0.7);

      // Both axes: the card hangs from `top: 50%`, so without the Y half-offset
      // it sits a half-height below the middle.
      card.style.transform =
        `translate(calc(-50% + ${offset * spacing.current * 100}%), -50%) scale(${scale})`;
      card.style.zIndex = String(Math.round(100 - distance * 10));

      /**
       * Opacity comes from the rank and CSS owns it. Ramping it off raw distance
       * leaves the front card fully solid only at the exact instant it is dead
       * centre, so the card behind shows through it permanently. Rank is
       * discrete and changes once, when two cards swap, so the stylesheet can
       * transition it. Transform stays per-frame.
       */
      const place = rank.indexOf(index);
      const depth = place === 0 ? '0' : place <= 2 ? '1' : '2';
      if (card.dataset.depth !== depth) card.dataset.depth = depth;

      // `toggleAttribute`, not `dataset.centre = undefined`: assigning undefined
      // to a dataset property stringifies it, so the attribute is present with
      // the value "undefined" and still matches `[data-centre]`.
      card.toggleAttribute('data-centre', depth === '0');
    });

    // Wrapped, not clamped. `position.current` is unbounded — it runs negative
    // past the first card and beyond the last (see `seek`) — and clamping it to
    // [0, n-1] pinned the cursor at an end while the cards carried on cycling.
    // Folding into [0, n) keeps it on the card actually showing.
    if (cursor.current && geometry.marks.length > 0) {
      const n = geometry.marks.length;
      const wrapped = ((position.current % n) + n) % n;
      const lower = Math.floor(wrapped) % n;
      const upper = (lower + 1) % n;
      const blend = wrapped - Math.floor(wrapped);

      /**
       * The newest-to-oldest wrap is a seam: on a linear line those two ends are
       * the whole timeline apart, so gliding across it drew the cursor sweeping
       * backwards over the line. The seam is a jump to whichever end the
       * carousel settled nearer to; every other step still glides.
       */
      const seam = lower === n - 1 && upper === 0;
      const from = geometry.marks[lower];
      const to = geometry.marks[upper];
      if (!from || !to) return;

      const left = seam
        ? (blend < 0.5 ? from : to).left
        : from.left + (to.left - from.left) * blend;
      cursor.current.style.left = `${left}%`;
    }
  }, [count, geometry]);

  /**
   * The card's width is a function of the height available to it, and CSS cannot
   * derive a percentage width from a parent's height — so the stage is measured
   * here instead. The body's height is read from the DOM rather than assumed, so
   * changing the card's copy or padding cannot push the image out of frame.
   */
  useEffect(() => {
    const node = stage.current;
    if (!node) return;

    const body = node.querySelector<HTMLElement>('.project-body');

    /**
     * Converges rather than computing once: the body's height depends on the
     * card's width (a narrower card rewraps the summary) and the width depends
     * on the body's height. The 2px deadband is what stops that looping.
     */
    const region = node.closest<HTMLElement>('.work');
    // The timeline, not the heading: the heading is screen-reader-only and so
    // out of flow, and anchoring on it counts the block's own slack as chrome.
    const head = region?.querySelector<HTMLElement>('.timeline');

    const fit = () => {
      if (!region || !head) return;

      const chrome = body ? body.offsetHeight : 96;

      /**
       * The height budget comes from the region, not the stage: this function
       * writes the stage's height, so reading it back is circular.
       *
       * Measured from the timeline down and from the region's bottom up, never
       * from the region's top — the block is bottom-aligned, so the space above
       * it is slack, and counting it as chrome shrinks the card to make room for
       * the emptiness the shrinking creates.
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
       * Off the lock the budget is the viewport, not the region: there the
       * region is sized by its own content (which includes the card), so
       * measuring it is circular. Positions are converted to document
       * coordinates before subtracting, so the answer does not depend on where
       * the page happens to be scrolled to when a resize fires.
       */
      if (!locked) {
        // On a phone the card is sized from the viewport width rather than the
        // stage's. Still capped by the height budget below, so a card too tall
        // for the screen is scaled down instead of letting the page scroll.
        const fillVw = read('--card-vw', 0);

        const fromTop = stageBox.top + window.scrollY;
        /**
         * Heights, not positions. Measuring how far down something sits is wrong
         * three ways here: the root's `scrollHeight` is clamped to the viewport,
         * the frame carries `min-height: 100dvh`, and the footer is pushed down
         * by an auto margin — all three report where the empty space ends rather
         * than where the content does.
         */
        const region = node.closest('main');
        const footer = document.querySelector<HTMLElement>('.site-footer');
        const beneath =
          (region ? region.getBoundingClientRect().bottom - stageBox.bottom : 0) +
          (footer?.offsetHeight ?? 0);

        /**
         * A floor, not a hard bound: on a very short window, at large text sizes
         * or at 400% zoom the page cannot hold all of this, and letting it
         * scroll is what WCAG 1.4.10 asks for anyway. 78 rather than 84 because
         * rounding onto the 16px grid costs up to fifteen pixels of width, which
         * at 360x640 was the difference between fitting and overflowing.
         */
        const room = Math.max(window.innerHeight - fromTop - beneath - chrome - 4, 78);

        const desiredWidth = fillVw > 0 ? window.innerWidth * fillVw : byWidth;
        const only = toGrid(Math.min(desiredWidth, room * (16 / 9)));
        // No slack added: the card *is* this height now, and `even` rounds up.
        node.style.setProperty('--card-h', `${even(wellHeight(only) + chrome)}px`);
        if (Math.abs(only - (parseFloat(node.style.getPropertyValue('--card-w')) || 0)) < 2) return;
        node.style.setProperty('--card-w', `${only}px`);
        paint();
        return;
      }

      // Three bounds, smallest wins: `byHeight` turns the height budget into a
      // width through the 16:9 well, `byWidth` is the stylesheet's cap, and
      // `bySpan` keeps all three cards on screen — the neighbours sit
      // `--spacing` out and scaled down, so the stack covers about
      // `2 * spacing + 0.87` card widths. `bySpan` is locked-only: below the
      // lock the neighbours are meant to sit mostly off the edge, and applying
      // it there crushes the card to a third of its width.
      const byHeight = Math.max(available, 80) * (16 / 9);
      const bySpan = (window.innerWidth - 48) / (2 * spacing.current + 0.87);
      const next = toGrid(Math.min(byHeight, byWidth, bySpan));

      /**
       * Written every pass, deadband or not: the copy can rewrap without the
       * width moving. Clamped to the budget, because just over the scroll-lock
       * threshold the budget is smaller than the smallest card, and the stage is
       * a fixed height now — an unclamped value grows the block past its grid
       * track and into the intro above it. The card overflows the stage instead.
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
    // The region carries the budget, so a viewport change has to be seen here —
    // the stage is a fixed height now and no longer resizes on its own.
    if (region) observer.observe(region);

    // Off the lock the budget is the viewport's height, and nothing observed
    // necessarily changes when that does — a rotation or a browser toolbar
    // sliding away leaves every element the same size in a different place.
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
   * Closes the gap between where the carousel is and where the reader asked it
   * to be, then stops. Easing rather than writing the target straight to the
   * cards is what turns a series of discrete wheel notches into continuous
   * travel. It cancels itself when the gap closes, so an idle page runs no
   * frames.
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
   * The target is not clamped — it runs off either end and the paint wraps it,
   * which is what makes the cycle endless in both directions.
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
   * A wheel has no end event, so "stopped" is the absence of another notch for a
   * while. Every notch pushes the timer back, which keeps a long scroll from
   * snapping mid-gesture.
   */
  const snapSoon = useCallback(() => {
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => seek(Math.round(target.current)), SETTLE);
  }, [seek]);

  // Only taken where the page has no scrolling of its own to give up: below the
  // locked layout, hijacking a vertical wheel would trap the reader in the
  // carousel, so only horizontal intent is claimed there.
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
   * Left and Right turn the carousel from anywhere on the page: a pointer click
   * is deliberately kept from focusing the container (see the pointer-down
   * handler), so a reader who never tabbed in would otherwise press an arrow and
   * get nothing.
   *
   * Stands aside where the keys already mean something else — an open dialog, a
   * focused form control, or the container itself, where `onKeyDown` already
   * runs and reacting again would turn the carousel twice.
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
   * A swipe is paged, not free: the card follows the finger but a gesture moves
   * at most one card, and release commits or bounces back — so the target is
   * always a whole card and the carousel never rests between two.
   */
  const onPointerMove = (event: React.PointerEvent) => {
    const start = drag.current;
    if (!start) return;
    const dx = event.clientX - start.x;
    if (!dragged.current) {
      // Ignore jitter until the movement is clearly a drag, so a tap that
      // wobbles a pixel still opens the card.
      if (Math.abs(dx) <= 6) return;
      dragged.current = true;
      // A horizontal swipe drifts vertically off the card, and losing the
      // pointer would strand the carousel mid-slide with no release to settle.
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
    // A tap that never became a drag settles onto the whole card it is on (in
    // case a wheel was mid-ease) and leaves the click to open the project.
    if (!swiped) {
      seek(from);
      return;
    }
    // Past halfway commits to the neighbour, short of it bounces back. `from` is
    // a whole card and the step is at most one, so this always lands on one.
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
          // Keeps a pointer from focusing the container, so the focus ring is
          // only ever the keyboard's: `:focus-visible` does not manage this on
          // its own for a `tabindex` container in Chrome.
          //
          // Mouse only. On touch, cancelling the default here also cancels the
          // pan the browser was about to start, freezing the page scroll —
          // `touch-action: pan-y` governs there and needs the default alone.
          if (event.pointerType === 'mouse') event.preventDefault();
          window.clearTimeout(settle.current);
          dragged.current = false;
          // From a whole card, so paging is measured against a settled position
          // even if a wheel or a previous swipe was still easing.
          drag.current = { x: event.clientX, from: Math.round(target.current) };
        }}
        // A drag has to swallow the click that follows it, or scrubbing the
        // carousel opens a dialog every time.
        onClickCapture={(event) => {
          if (!dragged.current) return;
          dragged.current = false;
          event.preventDefault();
          event.stopPropagation();
        }}
        onPointerMove={onPointerMove}
        onPointerUp={settleDrag}
        // A cancel (the browser taking the gesture for a vertical scroll, a
        // system edge-swipe) must settle too, or the carousel parks between two
        // cards.
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
                // `inert` swallows pointer events, so gating on `active` alone
                // made the two visible neighbours unclickable.
                inert={!near}
              >
                {/* `offset` is the card's signed distance from the front, so
                    `go(offset)` steps the short way onto a neighbour and wraps
                    at the ends rather than seeking its raw index and scrolling
                    the long way round. The neighbours are out of the tab order:
                    the arrow keys and the dots already move the carousel. */}
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
                  /* Opening a project pauses its looping card preview, so the
                     clip is not running behind the modal while the modal's own
                     copy plays. It resumes from where it left off. */
                  playing={index === active && detail === null}
                />
              </article>
            );
          })}

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

type Geometry = ReturnType<typeof timelineGeometry>;

/**
 * Card widths are rounded down to a multiple of this: the well is 16:9, so a
 * width divisible by 16 gives it a whole number of pixels of height. Down
 * rather than to nearest, because every bound it is applied to is a maximum.
 */
const GRID = 16;

/**
 * The card's rule, both sides. `box-sizing` is border-box, so it is the well
 * that has to divide by 16, not the card. Coupled to `.project-card`'s
 * border-width in the stylesheet; if that changes, this does.
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

function wellHeight(cardWidth: number) {
  return ((cardWidth - BORDER) * 9) / 16;
}

/**
 * The least whitespace two labels on the line may sit apart, when the
 * stylesheet has not said. Read from `--join-gutter` at measure time because the
 * right answer changes with what a label is: below the width where names are
 * hidden a label is a lone badge, and a text-sized gutter pushed two badges onto
 * separate rows, costing a phone-sized viewport its no-scroll layout.
 */
const GUTTER = 20;

/** The same, for year ticks, which are shorter and can sit closer. */
const YEAR_GAP = 4;

/** Months since epoch, for placing a date on a line. */
function monthsOf(iso: string) {
  const [year = 0, month = 1] = iso.split('-').map(Number);
  return year * 12 + (month - 1);
}

/**
 * Where everything sits on the line, as percentages. Computed once and shared,
 * because the dots and the cursor that slides between them must not disagree by
 * a rounding error. Positions are elapsed time, not one slot per item.
 */
function timelineGeometry(
  experiences: Experience[],
  projects: Project[],
  education: Education[],
) {
  const schools = [...education].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const ordered = [...experiences].sort((a, b) => a.startDate.localeCompare(b.startDate));

  /**
   * The line runs from the earliest thing on it to the latest. With an empty
   * education list it has to start at the first job rather than at `NaN`.
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
   * The line warps to project density: each year's weight is a small base plus
   * one per project in it, so busy years get room to spread their marks and
   * quiet stretches — a degree, a gap between jobs — compress to a thin run of
   * context. The weights accumulate into year boundaries and a date
   * interpolates by month within its year, so the mapping stays monotonic: a
   * warp, not a scramble.
   */
  const firstYear = Math.floor(min / 12);
  const lastYear = Math.floor(max / 12);

  const projectsInYear = new Map<number, number>();
  for (const project of projects) {
    const year = Math.floor(monthsOf(project.date) / 12);
    projectsInYear.set(year, (projectsInYear.get(year) ?? 0) + 1);
  }

  // Every year gets `MIN_YEAR` percent outright, so even a year that shipped
  // nothing has room for its label on a phone; the rest is shared out by project
  // count. The floor is capped so a very long career still leaves room to vary.
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
  // it carry no projects, so the density warp already draws them thin.
  const careerStart = ordered[0] ? monthsOf(ordered[0].startDate) : min;
  const lead = place(careerStart);

  // Every year is emitted; which ones show is decided per-viewport by the
  // pixel-measured thinning in `Timeline` (see `stack`), which can see a width
  // this code cannot.
  const years = [];
  for (let year = Math.ceil(min / 12); year * 12 <= max; year += 1) {
    years.push({ year, left: place(year * 12) });
  }

  return {
    /** The rule is drawn in two pieces so the pre-career run can be lighter. */
    lead,
    ticks: years,
    /**
     * Schools and companies as one list, sorted together by start date because
     * they overlap: a degree finishing after the first job started should still
     * sit where it started. Ids are prefixed so a school and a company sharing
     * one cannot collide as React keys or in the open-tooltip state.
     */
    joins: [
      ...schools.map((item) => ({
        id: `school-${item.id}`,
        label: item.school,
        sub: item.credential,
        logo: item.logo as Asset | undefined,
        /**
         * A job with no end date is one you still have, so 'Present' is true. A
         * school with no end date is far more often one nobody has filled in, so
         * 'from Sep 2017' claims only what is known.
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
   * Which badge is showing its dates. `sticky` is the difference between a hover
   * and a tap: a tap has no "away" to move to, so it pins until something else
   * is clicked.
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
   * Which row each label sits in. The positions are the data — two joins eight
   * months apart are ~90px apart on a nine-year line, narrower than the labels
   * they carry — so a label that will not fit beside its neighbour moves up a
   * row and grows a leader back down to its tick. Greedy, left to right, first
   * row with clearance wins.
   *
   * Widths are measured rather than estimated, because a label's width depends
   * on the font that actually loaded.
   */
  useEffect(() => {
    const node = track.current;
    if (!node) return;

    const stack = () => {
      const joins = [...node.querySelectorAll<HTMLElement>('.timeline-join')];
      // The band, not the track, is what percentages resolve against — it is
      // inset on wide screens — so its width is what turns a join's `left` into
      // the pixel centre the collision and nudge math need.
      const band = node.querySelector<HTMLElement>('.timeline-band');
      const width = band?.clientWidth ?? node.clientWidth;
      if (joins.length === 0 || width === 0) return;

      // How far the band is held back from each edge of the track: a label
      // centred on an end tick may spill this far past the band before it hits
      // the track edge, which is what lets it stay under its mark.
      const inset = Math.max(0, (node.clientWidth - width) / 2);

      const gutter =
        parseFloat(getComputedStyle(node).getPropertyValue('--join-gutter')) || GUTTER;

      // The right edge of the last label placed in each row, in pixels.
      const edges: number[] = [];
      // A row has to be as tall as the tallest thing in it, or lifting a label
      // by one row leaves it short of clearing the one below.
      let tallest = 0;

      for (const join of joins) {
        const label = join.querySelector<HTMLElement>('.timeline-company');
        const box = label?.getBoundingClientRect();
        const center = (parseFloat(join.style.left) / 100) * width;
        const half = (box?.width ?? 0) / 2;

        /**
         * Centred on its tick, the first label hangs half its width off the left
         * edge; `--nudge` pushes a clipping label back inside. The tick does not
         * move with it, so a clamped label points slightly to one side of its
         * mark rather than being cut in half.
         *
         * Clamped against the track, not the band: a centred label may use the
         * band's own margin. `center + inset` is its centre in track space.
         */
        let nudge = 0;
        const trackCenter = center + inset;
        if (trackCenter - half < 0) nudge = -(trackCenter - half);
        else if (trackCenter + half > node.clientWidth) nudge = node.clientWidth - (trackCenter + half);

        // The span after the nudge, not the centred span, is what can collide —
        // the nudge is exactly what moves an edge label into a neighbour.
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
       * Years, thinned: the warp crushes the quiet years together, and a handful
       * of labels in fifty pixels is a smudge rather than a scale.
       *
       * Measured in three passes — un-hide everything, read every box, then
       * write — because reading and writing in one loop measures later boxes
       * against a layout the earlier writes already changed.
       */
      const years = [...node.querySelectorAll<HTMLElement>('.timeline-year')];
      for (const year of years) year.removeAttribute('data-crowded');

      const boxes = years.map((year) => year.getBoundingClientRect());
      const count = years.length;

      if (count > 0) {
        // Kept from the right — the recent, dense end — so a narrow band thins
        // the compressed old years rather than a recent one. Both endpoints are
        // pinned: a plain left-to-right pass dropped the latest year.
        const keep = new Array<boolean>(count).fill(false);
        keep[0] = true;
        keep[count - 1] = true;

        const first = boxes[0];
        const last = boxes[count - 1];
        if (!first || !last) return;

        // Walk right to left, keeping a year whenever it clears the last one kept.
        let nextLeft = last.left;
        for (let index = count - 2; index >= 1; index -= 1) {
          const box = boxes[index];
          if (box && box.right <= nextLeft - YEAR_GAP) {
            keep[index] = true;
            nextLeft = box.left;
          }
        }

        // The pinned first year can still butt against whatever was kept just to
        // its right; drop that neighbour so the start stays clean.
        for (let index = 1; index < count - 1; index += 1) {
          const box = boxes[index];
          if (keep[index] && box && box.left < first.right + YEAR_GAP) keep[index] = false;
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
      {/* The rule, years and marks are hidden individually rather than the whole
          track: the joins are buttons, and a focusable control inside an
          `aria-hidden` subtree is unreachable by keyboard while still being in
          the tab order. */}
      <div className="timeline-track" ref={track}>
        {/* Percentages resolve against this band, which is inset from the track
            on a wide screen so the first and last labels have room to sit under
            their mark. The inset is zero on a phone, where the labels are
            hidden. */}
        <div className="timeline-band">
          {/* Two pieces: the lighter one covers the compressed pre-career run. */}
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

        <span aria-hidden="true" className="timeline-cap" />

        {geometry.ticks.map((tick) => (
          <span
            key={tick.year}
            aria-hidden="true"
            className="timeline-year"
            style={{ left: `${tick.left}%` }}
          >
            {/* Two digits on a phone, where the narrow band cannot hold nine
                four-digit labels without them colliding. Only one is ever
                displayed, so the collision measurement reads the right one. */}
            <span className="timeline-year-full">{tick.year}</span>
            <span className="timeline-year-short">&rsquo;{String(tick.year).slice(-2)}</span>
          </span>
        ))}

        <ol className="timeline-joins">
          {geometry.joins.map((join) => {
            const showing = open?.id === join.id;

            return (
              <li key={join.id} className="timeline-join" style={{ left: `${join.left}%` }}>
                <button
                  type="button"
                  className="timeline-company"
                  /* The whole fact in one string: the name and role are hidden
                     by CSS on a narrow screen and the dates are never rendered
                     as text. */
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
                  <span className="timeline-name">{join.label}</span>
                  <Badge name={join.label} logo={join.logo} />
                </button>

                {/* Flipped past halfway, so a tooltip on a late join opens back
                    across the line rather than off the edge of a phone, where
                    the page clips overflow. */}
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

        {/* Each mark is a control, and the accessible way into a project from
            the line — which is why the screen-reader-only list that used to sit
            below is gone. The tooltip flips to an edge anchor near the ends of
            the line so it does not run off the screen. */}
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
              projects rather than snapping. Placed from the animation frame,
              which is why it is a ref. */}
          <span ref={cursorRef} aria-hidden="true" className="timeline-cursor" />
        </div>
      </div>

      <p className="timeline-now" aria-live="polite">
        {activeProject ? `${activeProject.title} · ${formatMonth(activeProject.date)}` : ''}
      </p>
    </div>
  );
}

/**
 * A native `<dialog>`: the focus trap, Escape, the inert background and the top
 * layer are all the platform's.
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
      // dialog itself; comparing the target separates outside from the panel.
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

/**
 * Initials for an employer with no logo file. Capitalised words only, so
 * "University at Buffalo" is UB rather than UAB. One-word names keep one letter;
 * "PP" for PayPal would be inventing an abbreviation nobody uses.
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
 * A monogram unless the experience carries a real logo asset. A company logo is
 * a trademark and both Intuit and PayPal publish guidelines governing how theirs
 * may be shown, so none is fetched, approximated, or shipped unless supplied.
 * Decorative either way: the company's name is always set beside it.
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

/**
 * Read at render rather than in CSS, because a stylesheet cannot stop a video
 * playing — `autoplay` has to actually not be set.
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
 * The last playhead of each card clip. A card video unmounts when it leaves the
 * visible ring, so recording the position and restoring it on the way back is
 * what turns "unmount" into "pause". Module scope so it survives the unmount.
 *
 * The modal shares it in both directions, so a clip is one continuous playback
 * across the card and the modal rather than two viewings of it.
 */
const clipTime = new Map<string, number>();

/**
 * The mute choice per clip, shared between a card and its modal. A tiny external
 * store rather than a plain Map so both `Media` instances re-render when the
 * value changes. An entry is cleared when a card leaves the visible ring and
 * unmounts, so a clip scrolled away and back never surprises with audio.
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

function useClipMuted(id: string): [boolean, (value: boolean) => void] {
  const muted = useSyncExternalStore(
    subscribeClipMuted,
    () => readClipMuted(id),
    () => true,
  );
  return [muted, (value: boolean) => writeClipMuted(id, value)];
}

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

/**
 * `viewer` is the difference between the card and the opened modal: on the card
 * a video is a muted looping preview, in the modal it carries native controls
 * and does not autoplay with sound, because a browser will not allow sound
 * without a gesture.
 */
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
   * Modal only: whether this is the gallery image on screen. Every image's
   * element stays mounted and this toggles instead, so a clip's playhead
   * survives stepping to another image and back with no seeking required.
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
   * Starts muted: muted is what lets the card autoplay at all, and audio that
   * begins on its own as a card drifts into place is what nobody asked for.
   */
  const [muted, setMuted] = useClipMuted(shot.id);

  /**
   * Only the card drops its choice on unmount. The modal shares a still-mounted
   * card and must not wipe the value that card needs to resume with.
   */
  useEffect(() => {
    if (viewer) return;
    return () => forgetClipMuted(shot.id);
  }, [viewer, shot.id]);

  /**
   * Driven here rather than by the `autoPlay` attribute, which acts once at
   * mount: the same element stays mounted as a card slides between front and
   * neighbour, so the attribute can neither start a clip that becomes the front
   * card later nor stop one that stops being it. Reduced motion keeps it paused.
   *
   * Mute is set on the element rather than left to the prop: React does not
   * reliably reflect `muted` to the DOM property, and the property is what
   * actually silences a playing clip.
   */
  useEffect(() => {
    const el = video.current;
    if (!el || !isVideo) return;

    // The opening seek to the card's recorded playhead happens once in
    // onLoadedMetadata and is deliberately not repeated here, or stepping away
    // to another image and back would snap the clip to that opening position
    // instead of where the reader had watched to. Autoplay is allowed because
    // opening the modal is a user gesture.
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
   * Inline so it wins over the stylesheet's default. `object-position` is only
   * meaningful under `cover`; a `scale` past 1 magnifies toward the same focal
   * point and the frame clips the overflow — that clip is the crop. Video is
   * left whole.
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
     * Neither surface autoplays through the attribute: the modal waits for a
     * gesture and the card's preview is started by the effect above. Under
     * reduced motion the card gets native controls, which carry their own mute,
     * so the corner toggle stands aside there.
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
          /* Both surfaces record the playhead, so a clip resumes where it was
             whichever one last played it. */
          onTimeUpdate={(event) => clipTime.set(shot.id, event.currentTarget.currentTime)}
          /* Restore it once the duration is known. */
          onLoadedMetadata={(event) => {
            const el = event.currentTarget;
            const at = clipTime.get(shot.id);
            if (at && Number.isFinite(el.duration) && at < el.duration) el.currentTime = at;
          }}
          /* Catches mute changes made by the native controls and shares them.
             Our own `el.muted = muted` echoes back here as a no-op, because the
             shared setter ignores an unchanged value. */
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
            /* A silent clip shows the control disabled and muted, so it reads as
               "nothing to unmute" rather than a toggle that does nothing. */
            disabled={silent}
            aria-label={silent ? 'This video has no audio' : muted ? 'Unmute video' : 'Mute video'}
            aria-pressed={silent ? false : !muted}
            /* Sits above the card's invisible open-button, so the click has to
               be stopped — toggling sound must not also open the modal. */
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

/** The first image only: the card is a glance, not a viewer. */
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
 * Every image, once the card has been opened. Modal only: a carousel inside a
 * carousel on the front page would be two things asking to be swiped in the same
 * spot. The arrow keys move it because a dialog is where they are free to.
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
          element out on navigation reset a playing clip. */}
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
 * Only the two states that change how the work should be read: a "shipped" badge
 * on every finished project is a column of the same word.
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
      {/* Media loads only for the cards in the visible ring; the ones stacked out
          of sight render an empty well of the same shape, so nothing off screen
          is fetched or decoded. */}
      {near ? (
        <Shot project={project} play={playing} />
      ) : (
        <div className="project-shot-empty" aria-hidden="true" />
      )}
      <div className="project-body">
        {/* Shown only on the front card (CSS keys it to `[data-centre]`), because
            a click on a neighbour brings it to the middle rather than opening
            it. It stays in the layout on the others — visibility, not display —
            so every card body is the same height for `fit()`. */}
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
 * Sits in its own scroll area so the gallery and title above it stay put and the
 * modal does not grow without bound.
 */
function ProjectStory({ project }: { project: Project }) {
  const story = (project.story ?? '').trim();
  if (!story) return null;

  const paragraphs = story.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);

  // The label sits outside the scroll area so it stays put while the account
  // scrolls under it.
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
