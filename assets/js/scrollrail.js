/*-----------------------------------------------------------------------------
    The green scroll rail, shared by the landing page and the portfolio.

    Native scrollbars are hidden and this is drawn instead, because whether a
    native bar occupies layout width is not something a browser guarantees --
    overlay scrollbars take none -- and neither page can afford its text to
    shift depending on that. Drawing it also lets the bar sit hard against the
    printed frame, at twice the frame's width, which a native bar cannot do.

    Each rail declares what it scrolls:
        data-scroll="window"   the document
        data-scroll="<sel>"    an element (the landing page's blurb)

    With no JavaScript both pages still scroll; they just scroll unmarked.

    Both marks strain when they are pulled or pushed -- see THE STRAIN below,
    which is shared between them and is the only part of this file either page
    could do without.
-----------------------------------------------------------------------------*/

(function () {
    "use strict";

    /*-------------------------------------------------------------------------
        THE STRAIN.

        The bar is a stroke of ink pinned along the screen edge, and a stroke
        pinned at one edge and pulled at the other does not stay square. It
        cants: the pinned side goes with the hand and the free side arrives
        late. The site already knows this shape -- crossing between the pages
        the mark takes the same angle, "squash and stretch as a shear rather
        than a scale" -- so grabbing it is not a new gesture, it is that one
        driven by a hand instead of by a keyframe.

        A shear and only a shear, and that is arithmetic before it is taste.
        Run the shoelace over a quadrilateral whose two ends rake by different
        amounts and the area comes out W*H + W*(a - b)/2, which is the mark's
        own mass if and only if a equals b. Any cant that favours one end over
        the other costs ink. A skew keeps every square pixel it started with
        and needs no clip, so the mark can lean without ever being cut.

        THE CEILING is three quarters of the mark's width -- 19.5px of cant on
        the register's bar, a 37 degree lean. It began at half the width, on a
        1:2 slope, and that was too polite to see: this mark is a thin stroke
        at the edge of the screen and a shy angle on it reads as nothing at
        all. It is reached by hauling against a stop; an ordinary drag lives at
        a third to a half of it.

        THREE FORCES drive it, all measured downward, all summed into one
        number and softened through cap*s/(|s| + cap), which is a limit rather
        than a clamp: the mark approaches its ceiling and never arrives, so
        there is no point at which the shape stops answering the hand.

            pull    the pointer's overrun, held for as long as you hold it.
                    On the register that is only ever the distance you have
                    outrun the thumb by at the end of the track; on the
                    landing page, where nothing travels, it is the whole
                    gesture from the first pixel.
            lag     the arrears of motion, taken off the drawn mark's own
                    velocity. This is what a drag through the middle of the
                    track has, where the thumb is glued to the pointer and
                    the overrun is zero by construction.
            push    a scroll that had nowhere to go. An impulse and not a
                    state: it fades on its own whether or not the spring has
                    caught up with it.

        UN-GRIPPED motion -- a wheel, a flick, a finger on a page that cannot
        scroll -- is the same equation at a quarter of the ceiling. The mark is
        being pushed along rather than held, and it should read as very much
        the lesser event.

        WHERE THE HAND CLOSED cannot be in the shape, for the reason above, so
        it is in the mass. The second moment about the grip runs a twelfth at
        the centre to a third at either end, so a bar held by one end swings
        four times as heavily as one held in the middle. Sampled off the same
        haul released from the same cant:

            grip    crosses square    overshoot    square again
            middle       50ms           0.71px         200ms
            quarter      67ms           0.83px         267ms
            end         100ms           0.93px         367ms

        Felt rather than seen, which is the right register for it: nobody
        reads a fifth of a pixel, but everybody notices that the end of a
        thing is heavier than its middle.

        LETTING GO is not a separate animation. The spring that made the cant
        is the one that takes it away, so there is no second schedule to keep
        in step with the first: it oversteps square exactly once, by six per
        cent of the cant at the middle and eight at an end, and is square
        again in 200ms or 367. The omega survives the release on purpose --
        the swing back is the half of the gesture the weight is felt in.

        The mark never leaves its track, and that falls out rather than being
        arranged. The free edge always lags OPPOSITE to the pull, and at a stop
        the pull is always toward the end of the track -- so the cant leans
        back into the rail exactly where there is no room outside it. Nothing
        needs clipping, and the full mass survives even at the extremes.

        None of it runs under reduced motion. The loop stops itself the moment
        the mark is square, and at rest the transform is removed outright, so
        a page nobody has touched is the page it was before.
    -------------------------------------------------------------------------*/

    var REDUCED = window.matchMedia
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : { matches: false };

    var clock = (window.performance && performance.now)
        ? function () { return performance.now(); }
        : function () { return Date.now(); };

    /* Damping, and the omega of the tightest possible grip; everything else
       about the cant's spring is derived from where the hand closed. Sampled
       rather than estimated -- the closed form for the settle of a damped
       spring is not the settle of this one, because the integrator is discrete
       and the loop quits on a threshold. Stepping it at 60fps:

           OMEGA 34   centre 333ms   end 667ms
           OMEGA 45   centre 250ms   end 517ms
           OMEGA 57   centre 200ms   end 400ms

       667ms is not heft, it is a lag. 57 puts the tight middle at 200 and the
       loose end at 400 -- or 367 measured through the whole assembly rather
       than the spring alone, which is the company the notch's 420 keeps. */
    var ZETA = 0.6;
    var OMEGA = 57;

    /* The grip's own spring, which carries the squeeze rather than the cant.
       Critically damped, because a hand closing does not bounce, and quick --
       105ms to the stop. It is what makes a press register before you have
       pulled anywhere. */
    var ZETA_H = 1.0;
    var OMEGA_H = 55;

    /* The three gains. soft() has a slope of one at the origin, so it does no
       moderating at all where most gestures live; these do it instead.

           pull  a stop overrun by  25px -> 16 deg,  150px -> 24 deg
           lag   a drag at         480px/s -> 14 deg, 1800px/s -> 22 deg
           push  a flick at        400px/s ->  6 deg, 2500px/s -> 10 deg

       K_LAG is in seconds: it is the fraction of a second of travel that
       shows up as arrears. It was nearly five times this while the arrears
       were read off scroll events, which are coalesced and arrive at the
       browser's convenience -- the gain had been wound up to compensate for a
       signal that was mostly not there. Feeding it from the pointer instead
       made every frame count and the same number saturated a gentle drag at
       four fifths of the ceiling, with nothing left for a hard one. */
    var K_PULL = 0.7;
    var K_LAG = 0.008;
    /* And the same thing again for motion nobody is holding. It has to be its
       own number: arrears under a hand are read off the pointer, which reports
       every frame, while arrears under a scroll are read off scroll events,
       which the browser coalesces and posts when it likes. The same gain
       through the two paths differs by nearly five times, and using the
       pointer's on the scroll left scrolling with no visible strain at all. */
    var K_LAG_SCROLL = 0.04;
    var PUSH_GAIN = 0.07;

    // Motion nobody is holding gets this much of the ceiling and no more.
    var IDLE_SHARE = 0.55;
    // How long an impulse survives being delivered, and how quickly arrears
    // close up once the mark stops moving.
    var PUSH_LIFE = 90;
    var LAG_LIFE = 70;

    /* THE PINCH, which is the half of this that can actually be seen.

       A shear can only ever bend the two end caps. The free edge's interior
       points sit on one vertical line, so sliding them along it does not move
       the boundary at all -- which is exactly why the shear conserves mass,
       and exactly why it is invisible on a mark 24 times longer than it is
       wide. The bar was leaning the whole time and there was nothing to see:
       13px of cant spread over a 622px rule is two per cent of its length,
       living entirely in two 26px caps at the far ends.

       Only the WIDTH can read along the length. So the free edge narrows where
       the hand is and swells toward both ends, and the swell is exactly the
       pinch: run the shoelace over the five corners and the area comes to 2WH
       however deep the pinch, however far the cant, wherever the grip. Mass is
       not approximately preserved here, it is algebraically preserved.

       A quarter of the mark's width at the ceiling, which on the bar is the
       difference between 26px and 19.5px at the grip -- a change you cannot
       miss on a stroke whose width is the only dimension you can read quickly.

       The left edge never moves. Two of the five corners are pinned at x=0 and
       span the mark's exact height, so whatever the strain does it does on the
       free side. The mark stays welded to the screen edge, which is the one
       thing it has always done. */
    /* How far the mark may lean, as a share of its own width. */
    var CANT_SHARE = 0.75;
    var PINCH_SHARE = 0.45;
    // How much of the pinch a closed hand commands before you have pulled
    // anywhere: a press should register as a press.
    var HOLD_BASE = 0.45;
    // And how much of it motion nobody is holding may have.
    var PINCH_IDLE = 0.7;

    /* The headroom the ink is given beyond the mark, so the strain can swell
       outward as well as cut inward -- a clip can only ever take away, so the
       ink has to start larger than the mark and be cut back to it. Declared
       once on :root and read from there, since the stylesheet sizes the ink
       and this file draws inside it; the two cannot disagree. */
    function padding() {
        var v = parseFloat(getComputedStyle(document.documentElement)
            .getPropertyValue("--strain-pad"));
        return v > 0 ? v : 15;
    }
    var PAD = padding();

    function soft(s, cap) {
        return cap > 0 ? cap * s / (Math.abs(s) + cap) : 0;
    }

    function makeStrain(el) {
        var pull = 0, lag = 0, push = 0;
        var gripped = false;
        var omega = OMEGA;
        // Where along the mark the hand closed, kept after the release so the
        // pinch relaxes from the place it was made.
        var gf = 0.5;
        // The cant, and the squeeze. Two springs: the cant is signed and
        // carries the direction of the pull, the squeeze is not and carries
        // only that something is holding on.
        var x = 0, vel = 0;
        var h = 0, hv = 0;
        var raf = 0, last = 0;
        var was = null, at = 0;

        // Everything the strain sets, taken off together. At rest the mark
        // has none of these: the ink sits at inset 0 with no clip and the box
        // does not clip either, which is the plain green rectangle this mark
        // has always been. That matters beyond tidiness -- the page transition
        // morphs the bar between the two views by snapshotting it, and a
        // snapshot is bounded by what the element paints. An ink layer grown
        // 15px proud of the mark would hand the morph an image with
        // transparent margins, and the green would no longer fill the box it
        // is being stretched into. So the mark only grows while it is actually
        // being strained, and a page nobody has touched is snapshotted exactly
        // as it was before any of this existed.
        function slack() {
            el.style.removeProperty("--strain-cut");
            el.style.removeProperty("--strain-grow");
            el.style.removeProperty("--strain-clip");
        }

        function shape(w, len) {
            if (!w || !len) {
                slack();
                return;
            }
            // The ceiling eases between the held and the unheld one on the
            // grip's own spring, so nothing steps at the moment of release.
            var blend = IDLE_SHARE + (1 - IDLE_SHARE) * h;
            var capNow = (w * CANT_SHARE) * blend;
            var norm = capNow > 0 ? Math.min(1, Math.abs(x) / capNow) : 0;
            // The grip's share and the pull's share, splitting the whole
            // between them rather than summing past it: a closed hand alone
            // commands HOLD_BASE of the pinch and the haul earns the rest, so
            // the squeeze still has somewhere to go once you are holding on.
            // Summed unclamped it saturated on contact and the pinch became a
            // thing that was either on or off.
            var pinch = w * PINCH_SHARE
                * Math.min(1, HOLD_BASE * h + (1 - HOLD_BASE) * norm)
                * (PINCH_IDLE + (1 - PINCH_IDLE) * h);

            var top = PAD, foot = PAD + len;
            var out = (w + pinch).toFixed(2);
            var into = (w - pinch).toFixed(2);
            el.style.setProperty("--strain-grow", PAD + "px");
            el.style.setProperty("--strain-clip", "clip");
            el.style.setProperty("--strain-cut", "polygon(" +
                "0px " + top.toFixed(2) + "px, " +
                out + "px " + (top + x).toFixed(2) + "px, " +
                into + "px " + (PAD + gf * len + x).toFixed(2) + "px, " +
                out + "px " + (foot + x).toFixed(2) + "px, " +
                "0px " + foot.toFixed(2) + "px)");
        }

        function frame(t) {
            raf = 0;
            var dt = last ? (t - last) / 1000 : 1 / 60;
            last = t;
            if (!(dt > 0)) dt = 1 / 60;
            if (dt > 0.1) dt = 0.1;

            push *= Math.exp(-dt * 1000 / PUSH_LIFE);
            lag *= Math.exp(-dt * 1000 / LAG_LIFE);
            // A twentieth of a pixel of force, which on the thinnest mark here
            // is a fifth of a degree. Dropped rather than run out: at the 90ms
            // half-life a hard flick takes 720ms to decay to a thousandth of a
            // pixel, and the loop was spending the last two hundred of those
            // animating nothing anyone could see.
            if (Math.abs(push) < 0.05) push = 0;
            if (Math.abs(lag) < 0.05) lag = 0;

            var box = el.getBoundingClientRect();
            var w = box.width, len = box.height;
            var cap = w * CANT_SHARE;
            // A mark the layout has taken away has nothing to strain. Forces
            // delivered to it are dropped rather than left to decay, so the
            // loop can stop on the next frame.
            if (!cap) { push = 0; lag = 0; }

            var capNow = cap * (IDLE_SHARE + (1 - IDLE_SHARE) * h);
            var target = -soft(pull * K_PULL + lag + push, capNow);
            var hTarget = gripped ? 1 : 0;

            // Substepped. A frame dropped under load would otherwise hand the
            // integrator a step long enough to ring on its own, and a spring
            // that rings because the tab was busy is not a spring.
            var steps = Math.ceil(dt / 0.008) || 1;
            var st = dt / steps;
            for (var i = 0; i < steps; i++) {
                vel += (omega * omega * (target - x) - 2 * ZETA * omega * vel) * st;
                x += vel * st;
                hv += (OMEGA_H * OMEGA_H * (hTarget - h)
                    - 2 * ZETA_H * OMEGA_H * hv) * st;
                h += hv * st;
            }

            if (!gripped && !push && !lag &&
                Math.abs(x) < 0.05 && Math.abs(vel) < 0.15 &&
                h < 0.004 && Math.abs(hv) < 0.05) {
                x = 0; vel = 0;
                h = 0; hv = 0;
                was = null;
                gf = 0.5;
                omega = OMEGA;
                slack();
                last = 0;
                return;
            }
            shape(w, len);

            if (x || vel || gripped || push || lag || h || hv) start();
            else last = 0;
        }

        function start() {
            if (raf || REDUCED.matches) return;
            raf = requestAnimationFrame(frame);
        }

        return {
            /* Where along the mark the hand closed, 0 at the top and 1 at the
               bottom. It decides two things: the place the pinch is made, and
               the mass being swung. The second moment about that point runs a
               twelfth at the centre to a third at either end, and omega goes
               as one over its root, so the tightest grip settles exactly twice
               as fast as the loosest. */
            grip: function (g) {
                if (REDUCED.matches) return;
                gf = Math.max(0, Math.min(1, g));
                var moment = (gf * gf * gf
                    + (1 - gf) * (1 - gf) * (1 - gf)) / 3;
                omega = OMEGA / Math.sqrt(moment * 12);
                gripped = true;
                pull = 0;
                start();
            },

            hold: function (px) {
                if (!gripped) return;
                pull = px;
                start();
            },

            /* The omega deliberately survives the release. It is the mass of
               the gesture, and the gesture is not over when the hand opens --
               the swing back is the half of it the heft was supposed to be
               felt in. Reset here and a bar held by one end threw away its
               weight at exactly the moment it was meant to show: sampled, the
               return came home in 200ms instead of 367. Both it and the grip's
               place go back to their defaults when the mark next comes to
               rest, which is the point at which there is no longer a gesture
               to be the mass of. */
            release: function () {
                gripped = false;
                pull = 0;
                start();
            },

            /* Forget where the mark was, without touching what it is doing.

               feed() reads a velocity off two positions and the time between
               them, so it is only ever meaningful if both were measured of
               the same layout. When the mark moves because the page changed
               shape -- a resize, an orientation change, fonts arriving, an
               image finally sizing itself -- the next scroll would otherwise
               difference a new position against a position from the old
               layout and call it motion. On a phone that is not rare: the
               address bar collapsing is a resize, and it happens in the
               middle of the scroll that caused it.

               draw() is deliberately not fed for this reason, but that only
               covered the frame of the change itself; the stale baseline sat
               there waiting to spike on whatever came next. */
            rebase: function () {
                was = null;
            },

            /* The drawn mark's position, whenever it moves for a reason that
               counts as motion. A resize does not count: a mark that shifted
               because the window changed shape has not been pulled anywhere. */
            feed: function (pos) {
                var t = clock();
                // Long enough between two samples and they are not one
                // gesture any more -- start again rather than average a
                // pause into a velocity.
                if (was !== null && t - at > 250) was = null;
                if (was !== null && t > at) {
                    var v = (pos - was) / ((t - at) / 1000);
                    lag += (v * (gripped ? K_LAG : K_LAG_SCROLL) - lag) * 0.4;
                    start();
                }
                was = pos;
                at = t;
            },

            /* A scroll with nowhere to go. Ignored under a grip, because the
               hand is already the whole story and on a touch screen the same
               finger would otherwise be counted twice. */
            shove: function (px) {
                if (gripped || REDUCED.matches) return;
                push += px * PUSH_GAIN;
                start();
            }
        };
    }

    function setup(rail) {
        var spec = rail.getAttribute("data-scroll") || "window";
        var isWindow = spec === "window";
        var el = isWindow ? document.scrollingElement || document.documentElement
            : document.querySelector(spec);
        if (!el) return;

        var thumb = rail.querySelector(".scrollrail-thumb");
        var dragging = false;
        var strain = makeStrain(thumb);

        // The thumb's laid-out geometry, kept here rather than measured back
        // off the element. Under strain its box is a sheared one, and a
        // rectangle drawn round a sheared box is taller than the mark and
        // starts higher up -- every sum below wants the mark.
        var thumbH = 0;
        var thumbTop = 0;

        function viewport() {
            return isWindow ? window.innerHeight : el.clientHeight;
        }

        // The landing page only turns its blurb into a scroller above a
        // certain size; below that the page scrolls normally and the rail has
        // nothing to represent.
        function live() {
            return isWindow || getComputedStyle(el).overflowY === "auto";
        }

        /* A window rail can be told to begin below something -- here the
           sticky bar -- so the track starts at the rule under it rather than
           running up behind it to the top of the screen.

           THE BAR IS NOT PINNED AT THE TOP OF THE PAGE. This used to read the
           bar's HEIGHT and nothing else, on the reasoning that the height is
           where a sticky bar comes to rest, so the rail could be fixed from
           the first pixel and never have to follow it.

           That holds only if the bar is the first thing on the page. On the
           portfolio it is not: the masthead is above it, so at scroll 0 the
           bar is sitting at 77 and has not pinned yet, while the rail had
           already started its track at 50. The thumb, which sits at the top
           of the track when the page is at the top, was drawn at 50..97 --
           over the masthead, in the left gutter, above the bar entirely. It
           outranks both of them, so it painted straight over the lot: a green
           bar floating at the top left with nothing to explain it, which is
           exactly what it looked like.

           On the portfolio the bar is not the first thing on the page, so at
           the top of the page it has not pinned and the thumb lands beside
           the masthead rather than under the bar. Two fixes for that were
           tried and both were worse than the thing they fixed:

           Following the bar's real position shortens the track from the top
           as it pins, and the thumb -- held at the top of a track whose top
           is rising faster than the thumb descends -- travels 68 pixels
           UPWARD on the first scroll down. An indicator that runs backwards
           is worse than one sitting higher than expected.

           Giving the masthead and the bar opaque grounds that outrank the
           rail covers the thumb -- entirely, as it turns out, since at the
           top of the page the whole thumb is inside that region. The bar then
           disappears exactly when the page is at the top.

           So: the height, from the first pixel, and the thumb is allowed to
           be seen. It sits in the gutter, which is empty. */
        var topSel = rail.getAttribute("data-rail-top");

        function railTop() {
            if (!topSel) return 0;
            var t = document.querySelector(topSel);
            return t ? Math.max(0, t.offsetHeight) : 0;
        }

        function metrics() {
            var start = isWindow ? railTop() : 0;
            var box = isWindow
                ? { top: start, height: window.innerHeight - start }
                : el.getBoundingClientRect();
            var over = Math.max(0, el.scrollHeight - viewport());
            var pos = isWindow ? (window.scrollY || el.scrollTop) : el.scrollTop;
            // Elastic scrolling drives this past both ends -- negative at the
            // top, beyond `over` at the bottom -- and an unclamped value threw
            // the thumb off the track for a frame before the bounce settled.
            return { box: box, over: over, pos: Math.max(0, Math.min(over, pos)) };
        }

        function draw() {
            if (!live()) {
                rail.hidden = true;
                return;
            }
            var m = metrics();
            if (m.over <= 1) {
                rail.hidden = true;
                return;
            }

            rail.hidden = false;
            rail.style.top = m.box.top + "px";
            rail.style.height = m.box.height + "px";

            var h = Math.max(24, Math.min(m.box.height,
                m.box.height * (viewport() / el.scrollHeight)));
            var travel = Math.max(0, m.box.height - h);
            thumbH = h;
            thumbTop = Math.max(0, Math.min(travel, (m.pos / m.over) * travel));
            thumb.style.height = h + "px";
            thumb.style.top = thumbTop + "px";
        }

        function scrollTo(pos) {
            var m = metrics();
            pos = Math.max(0, Math.min(m.over, pos));
            if (isWindow) window.scrollTo(0, pos);
            else el.scrollTop = pos;
        }

        // Dragging maps rail travel to scroll travel one to one, so the thumb
        // stays under the pointer rather than drifting.
        function positionFromPointer(clientY, grabOffset) {
            var m = metrics();
            var travel = m.box.height - thumbH;
            if (travel <= 0) return 0;
            var y = clientY - m.box.top - grabOffset;
            return (y / travel) * m.over;
        }

        thumb.addEventListener("pointerdown", function (e) {
            e.preventDefault();
            dragging = true;
            var m0 = metrics();
            var grab = e.clientY - (m0.box.top + thumbTop);
            strain.grip(thumbH ? grab / thumbH : 0.5);
            thumb.setPointerCapture(e.pointerId);
            rail.classList.add("is-dragging");

            function move(ev) {
                if (!dragging) return;
                // What the hand asked for, less what the track allowed. Through
                // the middle of the drag this is zero -- the thumb is glued to
                // the pointer by design -- and at either end it is the whole of
                // the tension, which is the one place on this page where
                // something is genuinely being pulled against a stop.
                var mm = metrics();
                var travel = Math.max(0, mm.box.height - thumbH);
                var want = ev.clientY - mm.box.top - grab;
                var real = Math.max(0, Math.min(travel, want));
                strain.hold(want - real);
                // The mark's motion, read off the hand rather than off the
                // scroll it causes. Both would say the same thing, but a
                // scroll event is dispatched at the browser's convenience and
                // a pointermove is already here -- and through the middle of a
                // drag the arrears ARE the whole effect, so they cannot be
                // left waiting on a task that has not been posted yet.
                strain.feed(real);
                scrollTo(positionFromPointer(ev.clientY, grab));
            }
            function up(ev) {
                dragging = false;
                strain.release();
                rail.classList.remove("is-dragging");
                try { thumb.releasePointerCapture(ev.pointerId); } catch (err) { }
                thumb.removeEventListener("pointermove", move);
                thumb.removeEventListener("pointerup", up);
                thumb.removeEventListener("pointercancel", up);
            }
            thumb.addEventListener("pointermove", move);
            thumb.addEventListener("pointerup", up);
            thumb.addEventListener("pointercancel", up);
        });



        // A click on the empty track jumps the thumb's centre to the pointer.
        rail.addEventListener("pointerdown", function (e) {
            if (e.target === thumb) return;
            scrollTo(positionFromPointer(e.clientY, thumbH / 2));
        });

        // Fed from here rather than from draw(), which also runs on resize:
        // a mark that moved because the window changed shape has not been
        // pulled anywhere, and reading a velocity off that would have the bar
        // flinch every time the window was dragged.
        function onScroll() {
            draw();
            // Not while a hand is on it: the drag feeds the strain itself, on
            // the pointer's own clock, and counting the scroll it causes as
            // well would be the same travel twice.
            if (!dragging) strain.feed(thumbTop);
        }

        // Everything here moves the mark for a reason that is not motion.
        function relayout() {
            strain.rebase();
            draw();
        }

        (isWindow ? window : el).addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", relayout);
        window.addEventListener("orientationchange", relayout);
        if (window.ResizeObserver && !isWindow) new ResizeObserver(relayout).observe(el);
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
        Array.prototype.forEach.call(document.images, function (im) {
            if (!im.complete) im.addEventListener("load", relayout);
        });
        draw();
    }

    /* The landing page's bar is the height of the text and nothing else.

       It cannot be done in CSS. The rule is absolutely positioned inside a
       grid area it shares with the portrait, and the portrait is the taller
       of the two, so stretching the rule to its own area runs it down past
       the last line of the blurb to the foot of the photograph. The portrait
       has to keep contributing its height -- take it out of flow and it
       covers the buttons underneath -- so the rule is measured instead.

       Measured off the text's ink, not its boxes: the first and last line
       boxes each carry half the leading above and below the letters, and a
       mark that included it would sit visibly proud of the words at both
       ends. Trimming it is what "the height of the text itself" means. */
    function halfLeading(el) {
        var cs = getComputedStyle(el);
        var fs = parseFloat(cs.fontSize);
        var lh = parseFloat(cs.lineHeight);
        if (!lh) lh = fs * 1.2;
        return Math.max(0, (lh - fs) / 2);
    }

    // Line boxes, in order, for everything the element renders.
    function lineRects(el) {
        var r = document.createRange();
        r.selectNodeContents(el);
        var rects = r.getClientRects();
        return rects.length ? rects : [el.getBoundingClientRect()];
    }

    function syncEdgeRule() {
        var rule = document.querySelector(".edge-rule");
        if (!rule) return;
        var head = document.querySelector(".name");
        var body = document.querySelector(".bio");
        var host = rule.offsetParent;
        if (!head || !body || !host) return;
        var style = getComputedStyle(rule);
        if (style.display === "none") return;

        var top = lineRects(head)[0].top + halfLeading(head);

        // How far it runs is the stylesheet's decision, not this script's --
        // it is a question about the layout, and the layout is over there.
        var foot;
        var links = document.querySelector(".doclinks");
        if (style.getPropertyValue("--span").trim() === "sheet" && links) {
            // To the foot of the rules under the links, so the vertical mark
            // and the horizontal ones end on one line.
            foot = links.getBoundingClientRect().bottom;
        } else {
            var lines = lineRects(body);
            foot = lines[lines.length - 1].bottom - halfLeading(body);
        }
        if (!(foot > top)) return;

        var origin = host.getBoundingClientRect().top;
        rule.style.top = (top - origin) + "px";
        rule.style.bottom = "auto";
        rule.style.height = (foot - top) + "px";
    }

    /* The landing page fits, whatever the window does.

       Every part of this composition is incompressible except the figure:
       the words are the words, and the three links are the three links. So
       when the page comes out taller than the window, the figure gives back
       exactly the difference and object-fit crops it. When the window grows
       again the cap is released first, so the picture returns to its full
       size rather than staying wherever a smaller window left it.

       It takes more than one pass, because on a narrow screen the figure is
       floated: changing its height changes how many lines wrap beside it,
       which changes the height of the text, which changes the answer. Each
       pass is a correction of the last and it converges quickly.

       There is a floor, and it is an aspect rather than a height. The crop
       is anchored on the face, so as the box loses height the picture stays
       a picture of someone for a surprisingly long way -- a 2.4:1 band is
       still head and shoulders. Past that it is a letterbox slot with an eye
       in it, worth less than the room it costs, so it goes entirely and the
       page gets the whole of its height back. */
    var PHOTO_FLOOR = 96;
    var PHOTO_WIDEST = 2.4;
    var PHOTO_TALLEST = 1.8;

    // Whichever copy of the figure this layout uses -- the floated one or the
    // column. Any inline hide from a previous, smaller window is cleared
    // first: otherwise the hidden copy reads as "not the one on display",
    // this returns null, and the picture never comes back when the window is
    // opened out again.
    function portrait() {
        var all = document.querySelectorAll(".portrait");
        var i;
        for (i = 0; i < all.length; i++) {
            all[i].style.removeProperty("display");
            all[i].style.removeProperty("height");
        }
        for (i = 0; i < all.length; i++) {
            if (getComputedStyle(all[i]).display !== "none") return all[i];
        }
        return null;
    }

    function overflow() {
        var doc = document.documentElement;
        return doc.scrollHeight - window.innerHeight;
    }

    function fitPage() {
        var img = portrait();
        if (!img) return;

        // Four passes rather than two. Each one is a correction of the last,
        // and on a wide short window the float rewraps enough that two were
        // leaving a few dozen pixels on the table.
        var last = Infinity;
        for (var pass = 0; pass < 4; pass++) {
            var over = overflow();
            if (over <= 0) break;

            // Beside a blurb taller than itself the figure is not what makes
            // the row, and cropping it buys nothing: the page comes out the
            // same height and the picture is smaller for no reason. If a pass
            // fails to win anything back, put it back and leave it alone --
            // what is too tall here is the text, and the type steps handle it.
            if (over >= last) {
                img.style.removeProperty("height");
                break;
            }
            last = over;

            var box = img.getBoundingClientRect();
            var want = box.height - over;
            if (want < PHOTO_FLOOR || want * PHOTO_WIDEST < box.width) {
                img.style.removeProperty("height");
                img.style.display = "none";
                break;
            }
            img.style.height = want + "px";
        }

        // A ceiling on the shape as well as a floor. Where the figure fills a
        // column it can end up taller than it is wide by any amount the window
        // cares to give it -- 144 across and 363 down on a 600x440 landscape,
        // which is a letterbox stood on its end. Nothing forces this in CSS,
        // because the aspect follows two lengths that are decided separately.
        var shape = img.getBoundingClientRect();
        if (shape.width && shape.height > shape.width * PHOTO_TALLEST) {
            img.style.height = (shape.width * PHOTO_TALLEST) + "px";
        }
    }

    // Resize fires in bursts while a window is dragged, and each call reads
    // layout back. One per frame is plenty and keeps the drag smooth.
    var queued = false;

    function refit() {
        if (queued) return;
        queued = true;
        requestAnimationFrame(function () {
            queued = false;
            fitPage();
            syncEdgeRule();
        });
    }

    window.addEventListener("resize", refit);
    window.addEventListener("orientationchange", refit);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(refit);
    Array.prototype.forEach.call(document.images, function (im) {
        if (!im.complete) im.addEventListener("load", refit);
    });
    fitPage();
    syncEdgeRule();

    // The sticky section labels have to start exactly where the bar ends, or
    // rows scroll past in the open between them. Measured rather than guessed,
    // since the bar's height follows the type scale.
    function syncStickyTop() {
        var bar = document.querySelector(".topbar");
        if (!bar) return;
        document.documentElement.style.setProperty(
            "--sticky-top", bar.getBoundingClientRect().height + "px");
    }

    window.addEventListener("resize", syncStickyTop);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncStickyTop);
    syncStickyTop();

    /* The landing page's rule takes the same strain, and nothing else.

       The regimes are opposite, which is the whole of the difference between
       the two pages. On the register the thumb is glued to the pointer, so the
       mark is square through the middle of a drag and only strains where you
       outrun it at a stop. Here there is no travel at all: every pixel of the
       pull is overrun from the first one, so the strain IS the gesture. The
       softening is what makes that bearable -- the rule saturates within the
       first stretch of the haul and then simply holds, which is what a mark
       bolted to the page should do when it is pulled.

       It says nothing about itself: no cursor, no hover state. A grab cursor
       would promise travel this rule cannot deliver. Someone who happens to
       press it finds that it gives; nobody is invited to.

       A scroll counts too, and on a phone it is the whole of the story. The
       page is fitted to the window, so a finger dragged up it has nowhere to
       take anything, and the rule leaning a little is the only answer the page
       can make. It has to be read off the gesture rather than off the scroll
       position, because when there is nothing to scroll the scroll position is
       exactly what never changes. */
    function setupRule() {
        var rule = document.querySelector(".edge-rule");
        if (!rule) return;
        var strain = makeStrain(rule);

        rule.addEventListener("pointerdown", function (e) {
            var host = rule.offsetParent;
            var h = rule.offsetHeight;
            if (!host || !h) return;

            // offsetTop and offsetHeight rather than a rectangle: the rule may
            // already be leaning when it is grabbed again, and a rectangle
            // drawn round a leaning mark is not the mark. The offset parent
            // carries no transform, so the sum is the rule's resting top.
            var top = host.getBoundingClientRect().top + rule.offsetTop;

            // Only for a mouse or a pen, and only to stop the drag selecting
            // the text it passes over. On a touch screen the same call would
            // take the swipe away from the browser, and a 13px strip down the
            // edge of a phone is a poor place to stop the page scrolling --
            // the strain there comes from the finger's own gesture below.
            if (e.pointerType !== "touch") e.preventDefault();

            strain.grip((e.clientY - top) / h);
            var from = e.clientY;
            try { rule.setPointerCapture(e.pointerId); } catch (err) { }

            function move(ev) {
                strain.hold(ev.clientY - from);
            }
            function up(ev) {
                strain.release();
                try { rule.releasePointerCapture(ev.pointerId); } catch (err) { }
                rule.removeEventListener("pointermove", move);
                rule.removeEventListener("pointerup", up);
                rule.removeEventListener("pointercancel", up);
                window.removeEventListener("pointerup", up);
                window.removeEventListener("pointercancel", up);
            }
            rule.addEventListener("pointermove", move);
            rule.addEventListener("pointerup", up);
            rule.addEventListener("pointercancel", up);
            // The same pair on the window, in case the capture above did not
            // take. Without capture a hand that lifts off the mark never tells
            // it so, and a rule left holding a lean nobody is pulling is a
            // resting state that looks like a fault -- which is worse than any
            // amount of the effect not happening at all.
            window.addEventListener("pointerup", up);
            window.addEventListener("pointercancel", up);
        });

        // Lines and pages back to pixels: a wheel is entitled to report in any
        // of the three, and a line-mode device would otherwise deliver three
        // units where a pixel-mode one delivers a hundred.
        function wheelPixels(e) {
            if (e.deltaMode === 1) return e.deltaY * 16;
            if (e.deltaMode === 2) return e.deltaY * window.innerHeight;
            return e.deltaY;
        }

        window.addEventListener("wheel", function (e) {
            strain.shove(wheelPixels(e));
        }, { passive: true });

        var touch = null;

        window.addEventListener("touchstart", function (e) {
            touch = e.touches[0] ? e.touches[0].clientY : null;
        }, { passive: true });

        window.addEventListener("touchmove", function (e) {
            if (touch === null || !e.touches[0]) return;
            var y = e.touches[0].clientY;
            // A finger travelling up the screen is a page travelling down.
            strain.shove(touch - y);
            touch = y;
        }, { passive: true });

        function lift() { touch = null; }
        window.addEventListener("touchend", lift, { passive: true });
        window.addEventListener("touchcancel", lift, { passive: true });
    }

    Array.prototype.forEach.call(document.querySelectorAll(".scrollrail"), setup);
    setupRule();
})();
