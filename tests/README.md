# Tests

    npm install && npx playwright install chromium    # once
    npm test                                          # everything
    npm run test:static                               # no browser, ~0.2s
    npm run test:browser                              # chromium, ~2 min
    npm run serve                                     # the same server, by hand

`npm test` is the gate. Everything below runs from the repository as it stands;
nothing is mocked and nothing is built first, because the thing deployed to
GitHub Pages is these files exactly.

## Two tiers, and why

**`tests/static/`** reads the files. No browser, no network, runs in a fifth of
a second, and answers every question that can be answered from the source:
does this path exist, does this animation have keyframes, do all five pages
agree on a cache stamp. Cheap enough to run on every save.

**`tests/browser/`** runs the site in Chromium. It answers the questions the
static tier structurally cannot: did the rule actually apply, what won the
specificity contest, does this overflow at 320px, did a script throw. Most of
this site's real bugs were only visible here.

Chromium only. The two riskiest features -- view transitions and a masked,
clipped scroll rail -- are Chromium-first, and this is where they are
exercised. The static tier is engine-independent and covers the rest. A second
engine is worth adding the day a Safari-specific bug appears, not before.

## The device matrix

`tests/lib/viewports.js`. Thirty-eight viewports, in two groups:

- **16 real devices** — phones from a 320px iPhone SE up, both phone
  orientations, three iPads, and four desktop sizes. Named, so a failure says
  "iPhone SE" and not "375x667".
- **22 boundary probes** — one pixel either side of every breakpoint in the two
  stylesheets. Those branch on width at 768, 860, 1080 and 1180 and, unusually,
  on **height** at 460, 520, 620, 700, 760 and 900, plus an orientation query
  for short landscape screens. A matrix of three popular phones would exercise
  almost none of that.

Layout tests open each page once and then **resize** through the matrix rather
than reloading: it is far faster, and it is a better test, because it exercises
the resize handlers and a layout that is only correct on a fresh load is not
correct.

## What each file covers

| File | Covers |
| --- | --- |
| `static/assets.test.js` | Every `href`, `src` and `url()` resolves on disk. One cache stamp per page, the same one on all five, and the generator agrees with it. The `.ico` is a real multi-size icon. |
| `static/css-integrity.test.js` | Braces balance. Every animation names a `@keyframes` that exists; every `@keyframes` is referenced by something. Custom properties are defined or every use has a fallback. No `calc()` in `overflow-clip-margin`. No class is styled that appears in neither markup nor script. |
| `static/html-structure.test.js` | Charset, viewport, `lang`, one `<h1>`, no skipped heading levels, no duplicate ids, `alt` on every image, `rel="noopener"` on every `target="_blank"`, no inline handlers, decorative marks `aria-hidden`. |
| `static/generated.test.js` | Re-running `build-portfolio.py` changes nothing. Every mark declares `--mark-w` and `--span`, no part escapes its own box, every mask is in the shape library. |
| `browser/console.test.js` | No console errors, no uncaught exceptions, no 404s — every page at five sizes. |
| `browser/layout.test.js` | No page scrolls sideways at any of the 38 sizes. The landing page never scrolls. No page scrolls more than 220px past its own content. Navigation controls clear 24px on phones. |
| `browser/scrollrail.test.js` | The thumb never runs backwards, never leaves its track, reaches both ends, is never completely covered, outranks the section labels, leaves no strain at rest, and survives a mid-scroll resize. |
| `browser/hoverfill.test.js` | The hover ground is armed for a fine pointer only — never under reduced motion, never for touch — and the plain colour fill still happens where it is not. The sweep covers, leaves nothing behind, opens at the point the pointer crossed, follows the direction of travel, and never turns its gradient axis mid-sweep. |
| `browser/marks.test.js` | Every mark has parts, every mask actually loads (fetched, not just computed), declared width matches occupied width, Ventures is open at the top, exactly one mark open at a time. |
| `browser/transitions.test.js` | No `view-transition-name` is claimed twice in one document. The cascade always lets go. Landing → portfolio → back leaves both working. The three redirect pages really do redirect. |
| `browser/motion.test.js` | Under `prefers-reduced-motion`, nothing animates anywhere and the rail leaves no strain. |

## Why several of these exist

Most assertions here are a bug that shipped. Worth knowing, because they look
over-specific until you know what they caught:

- **Every animation has keyframes.** A bad splice deleted four selectors and
  left their `@keyframes` behind. The gesture was silently absent for days:
  valid CSS, no console line, nothing to see but an element that did not move.
- **Every keyframes is referenced.** The mirror of the same fault.
- **No class styled that exists nowhere.** Found `.prose`, which was written
  for the three PDF pages and never applied to them.
- **Targets clear 24px.** Found `.doclink-inline`, which carried a class and no
  rules at all, and measured 19px on a phone in landscape.
- **Masks are fetched, not just computed.** A relative `url()` in a stylesheet
  resolves against the *stylesheet*, so `assets/img/...` became
  `/assets/css/assets/img/...` and 404'd. The shape simply did not appear.
- **The thumb never runs backwards.** A fix for the thumb sitting too high made
  the track shorten from the top as the header pinned, and the thumb travelled
  68px *upward* on the first scroll down.
- **The thumb is never completely covered.** The next attempt at that bug
  covered it with opaque headers, which at the top of the page covered all of
  it: the instrument vanished exactly when the page was at the top.
- **No strain at rest.** A page transition snapshots the green bar to morph it
  between views, and a snapshot is bounded by what the element paints — an ink
  layer left grown at rest hands the morph an image with transparent margins.
- **`overflow-clip-margin` without `calc()`.** Chrome rejects it outright and
  drops the whole declaration.
- **The hover ground never turns its axis mid-sweep.** Its two stops are
  percentages along a gradient *line*, so they only mean anything paired with
  the angle that drew it. Turning the line while a band is part way across
  makes the same two numbers describe a different shape, and the ground jumps
  sideways in a single frame — which is exactly what a pointer flicking in one
  side and out the other would have caused.

## The one test seam

Three of the five pages — `/resume/`, `/dissertation/`,
`/dissertation/chinese/` — are not views. Each carries a meta refresh and a
`location.replace()` straight to a PDF, with real markup underneath as the
fallback for a crawler, a script-blocked browser, or a slow connection.

A browser sent to one lands on a PDF it cannot render, and blocking the PDF
mid-navigation leaves a blank tab — which is what the first attempt at this
measured: zero elements on all three pages. So the test server accepts
`?no-redirect=1`, which strips exactly the two lines that navigate and touches
nothing else. `ctx.openPage()` applies it automatically.

That the redirects themselves work is asserted separately, *without* the seam,
in `transitions.test.js`.

## What this does not cover

Worth stating so the green tick is not read as more than it is.

- **No visual regression.** Nothing here compares pixels, so a change that is
  ugly but structurally sound passes. The animation tests assert that motion
  *happens* and lands where it should, never that it looks right.
- **One engine.** See above.
- **No real touch.** Phone viewports are emulated, with touch enabled; they are
  not a phone, and they never collapse an address bar mid-scroll — the one
  condition most likely to disturb the rail.
- **Timing is asserted loosely.** Animation tests wait for settling rather than
  measuring frames, because frame timing under a headless browser on a loaded
  machine is not a signal.
