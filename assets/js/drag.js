/*-----------------------------------------------------------------------------
    THE DRAG.

    A mark that is being scrolled past is being carried, and a thing being
    carried does not hold its shape perfectly. Scrolling stretches the marks a
    little along the way they are travelling and lets them gather themselves
    back when it stops -- a few per cent of sixteen pixels, on a spring, and
    over before you have decided whether you saw it.

    WHICH WAY ROUND. Going down the register stretches a mark and coming back
    up compresses it. That is a convention rather than a simulation -- inertia
    would elongate it either way -- and it is chosen because the register is
    read downwards: a mark carried up out of the way stretches after the
    reader, and one brought back down gathers itself in. Which way a mark is
    leaning tells you which way you are going, and that is worth more than the
    physics.

    THE SPRING IS UNDERDAMPED, which is where the rest of it comes from. When a
    scroll stops -- and a scroll almost always stops abruptly, because a hand
    leaves a trackpad all at once -- the arrears close up in seventy
    milliseconds while the spring is still travelling, so it carries past
    square and comes back through it once or twice before it settles. The
    recoil is not a second effect written for the purpose; it is what a spring
    does, and it happens to be exactly the follow-through the stop wants.

    A HARD FLICK INTO EITHER END gets an impulse of its own on top of that,
    because the page landing is a different event from the page slowing: it is
    the whole register stopping at once rather than content sliding past. That
    is the one time the pinned mark feels anything (see below), and it is
    delivered against the direction of travel, which is what an impact is.
    Leaning on the wheel at an end -- trying to go somewhere there is nothing
    left to go -- pulls the other way instead, WITH the hand, because that is a
    haul rather than a collision.

    THE PINNED MARK FEELS NOTHING, the rest of the time. Its label is stuck at
    the sticky line, so while its section owns the header the mark is not
    moving relative to the screen at all and there is nothing for it to be in
    arrears of. Straining it would be inventing motion that is not happening --
    and it is the one mark the reader is looking straight at. It still relaxes
    whatever it was carrying when it arrived.

    IT DOES NOT TOUCH THE GESTURES, and that is the whole reason it is written
    this way. The small movements in idle.js are animations on `transform`, and
    a second thing writing `transform` would have to either fight them or wait
    for them. So the drag is carried on `scale`, which is its own property:
    the browser composes translate, rotate and scale with transform on its own,
    so a mark can be strained and mid-gesture at once, and neither knows about
    the other. A gesture is never interrupted, never restarted, and never has
    to be timed around a scroll -- and --at, which reads a target's resting
    transform off the element, does not see the strain either, because the
    strain is not in `transform`.

    SIX MASSES, NOT ONE. Every mark answers with a spring of its own, stiffer
    for a narrow mark and slacker for a wide one, so a scroll runs through the
    register rather than switching all six on together. Same wind, different
    weights -- which is the same reason the parts of one mark are staggered
    when it opens.

    NONE OF IT RUNS UNDER REDUCED MOTION, the loop stops itself the moment
    every mark is square, and the property is taken off outright at rest, so a
    page nobody has scrolled is the page it was before.
-----------------------------------------------------------------------------*/

(function () {
    "use strict";

    var marks = document.querySelectorAll(".section-index");
    if (!marks.length) return;

    var reduced = window.matchMedia
        && window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced && reduced.matches) return;

    var clock = (window.performance && performance.now)
        ? function () { return performance.now(); }
        : function () { return Date.now(); };

    /* The rail's spring, wound looser. The rail's 0.6 is right for a cant
       tracking a hand, where an overshoot is a wobble; here the overshoot is
       the point, so 0.34, which carries a third of the strain through square
       before coming back. On a strain of four pixels that is over a pixel of
       compression after a hard stop, and a second pass at a tenth of that.

       Anything at or above 1 arrives and stops, and a scroll that stops dead
       is the thing this is here to answer. */
    var ZETA = 0.34;

    /* ARREARS ARE RELEASED, NOT DECAYED, and this is the whole difference
       between a recoil and an ease.

       A mark is in arrears because it is behind where it is being carried; the
       moment the carrying stops there is nothing left for it to be behind, so
       the force goes at once rather than fading over a hundred milliseconds.
       Faded, the spring simply tracks the target down and arrives square from
       one side -- which is what this did first, and it looked like a
       transition. Released, the spring is left displaced with nowhere to be,
       and it travels home under its own momentum and past it.

       It also grades itself. A hand lifted off a trackpad mid-flick leaves a
       big strain to be released and gets a real recoil; a scroll allowed to
       ease out has almost none left by the time it stops and settles quietly.
       Nothing had to be written for either case.

       STOPPED means under forty pixels a second, which is slower than any
       scroll anyone means. */
    var STOPPED = 40;
    var PUSH_LIFE = 90;

    /* HOW MUCH STRAIN, AT MOST: a share of the mark's own height, so the
       thirty-four pixel mark and the twenty-one pixel one stretch by the same
       proportion rather than the same distance.

       Thirty per cent. It was twelve, which measured correctly and read as
       nothing: a mark is sixteen pixels tall, and twelve per cent of it is
       under two pixels of travel spread over both edges, at the exact moment
       the eye is following a page that is moving. There is room for it -- the
       mark clears its heading by three tenths of a layout unit, which is
       twelve pixels at the widest and six at the narrowest, against the two
       and a half this can now add below.

       Saturating rather than clipped: soft() has a slope of one at the origin,
       so a slow scroll is strained in exact proportion and only a fast one
       starts running out of room. */
    var CAP_SHARE = 0.30;

    /* K_LAG is in seconds: the fraction of a second of travel that shows up as
       arrears. Where the ordinary range of a trackpad now lands:

           800px/s   asks for 3.4px, given 2.0  -- twelve per cent of the mark
           1500      asks for 6.3,   given 2.7  -- seventeen
           3000      asks for 12.6,  given 3.5  -- twenty-two
           6000      asks for 25.2,  given 4.0  -- twenty-five

       The curve matters more than the ceiling. What was wrong before was not
       that a hard flick was too small but that an ordinary scroll -- which is
       what nearly every scroll is -- sat at five per cent and never showed. */
    var K_LAG = 0.0042;
    /* An impact is allowed more than a haul: landing is the sharpest thing
       that happens to the register and should read as the sharpest. */
    var K_IMPACT = 0.0018;
    var IMPACT_SHARE = 1.6;
    /* Leaning on the wheel past an end. Per notch, and capped, because a
       trackpad delivers a great many of them. */
    var K_OVER = 0.008;
    var OVER_MAX = 1.8;

    /* A fiftieth of a pixel, which on a sixteen pixel mark is an eighth of a
       per cent. Dropped rather than run out: at a seventy millisecond
       half-life the tail is hundreds of milliseconds of animating nothing. */
    var QUIET = 0.02;

    /* THE SIX MASSES. A narrow mark is light and answers quickly; a wide one
       is heavy and lags. Off --mark-w, which the generator already writes,
       against the middle of the range -- so the spread comes out of the
       compositions themselves rather than a table of numbers that would have
       to be kept in step with them. */
    var OMEGA_MID = 44;
    var REF_W = 27;

    function omegaOf(mark) {
        var w = parseFloat(mark.style.getPropertyValue("--mark-w"));
        if (!(w > 0)) return OMEGA_MID;
        return Math.max(30, Math.min(60, OMEGA_MID * REF_W / w));
    }

    /* Saturating gain, slope one at the origin. The rail's. */
    function soft(s, cap) {
        return cap > 0 ? cap * s / (Math.abs(s) + cap) : 0;
    }

    // What the stylesheet falls back to where the bar has not been measured.
    function stickyTop() {
        var v = parseFloat(getComputedStyle(document.documentElement)
            .getPropertyValue("--sticky-top"));
        return v > 0 ? v : 48;
    }

    var state = [];
    Array.prototype.forEach.call(marks, function (mark) {
        state.push({
            mark: mark,
            section: mark.closest ? mark.closest(".section") : null,
            omega: omegaOf(mark),
            x: 0,
            vel: 0,
            lag: 0,
            push: 0,
            on: false
        });
    });

    function maxScroll() {
        return Math.max(0, (document.documentElement.scrollHeight || 0)
            - window.innerHeight);
    }

    var running = false;
    var last = 0;
    var wasY = window.pageYOffset || 0;
    var wasV = 0;
    var atEnd = null;

    function start() {
        if (running) return;
        running = true;
        last = 0;
        requestAnimationFrame(frame);
    }

    /* Delivered to every mark, pinned included. Both the callers are the page
       itself moving or refusing to, rather than content going past. */
    function everyone(force) {
        for (var i = 0; i < state.length; i++) state[i].push += force;
        start();
    }

    function frame(now) {
        var dt = last ? (now - last) / 1000 : 1 / 60;
        last = now;
        if (!(dt > 0)) dt = 1 / 60;
        if (dt > 0.1) dt = 0.1;

        // Every read first, then every write: six marks measured one at a time
        // between six style changes is six layouts instead of one.
        var y = window.pageYOffset || 0;
        var v = (y - wasY) / dt;
        wasY = y;

        var top = stickyTop();
        var i, s, r;
        var pinned = [];
        for (i = 0; i < state.length; i++) {
            r = state[i].section && state[i].section.getBoundingClientRect();
            // Its label is stuck exactly while its section is astride the
            // sticky line, which is the same test the register uses to decide
            // who owns the header.
            pinned.push(Boolean(r) && r.top <= top && r.bottom > top);
        }

        // THE PAGE LANDING. Caught on the frame it arrives rather than by
        // watching for a scroll that stopped, because at the ends there is no
        // further scroll event to notice.
        var end = y <= 0 ? -1 : (y >= maxScroll() - 0.5 ? 1 : 0);
        if (end && atEnd !== end && Math.abs(wasV) > 300) {
            everyone(-Math.sign(wasV)
                * soft(Math.abs(wasV) * K_IMPACT, CAP_SHARE * 16 * IMPACT_SHARE));
        }
        atEnd = end;
        if (Math.abs(v) > 1) wasV = v;

        var alive = false;
        var out = [];
        for (i = 0; i < state.length; i++) {
            s = state[i];
            s.push *= Math.exp(-dt * 1000 / PUSH_LIFE);

            if (Math.abs(v) < STOPPED) {
                // Nothing is being carried, so nothing is behind anything.
                s.lag = 0;
            } else if (!pinned[i]) {
                // A pinned mark is not moving relative to the screen and is in
                // arrears of nothing. It keeps any impulse it was handed.
                s.lag += (v * K_LAG - s.lag) * 0.4;
            } else {
                s.lag = 0;
            }
            if (Math.abs(s.push) < QUIET) s.push = 0;
            if (Math.abs(s.lag) < QUIET) s.lag = 0;

            var box = s.mark.getBoundingClientRect();
            var cap = box.height * CAP_SHARE;
            // A mark the layout has taken away has nothing to strain, and its
            // forces are dropped rather than left to decay so the loop can
            // stop on the next frame.
            if (!cap) { s.push = 0; s.lag = 0; }

            var target = soft(s.lag + s.push, cap);

            // Substepped, so a frame dropped under load cannot hand the
            // integrator a step long enough to ring on its own.
            var steps = Math.ceil(dt / 0.008) || 1;
            var st = dt / steps;
            for (var n = 0; n < steps; n++) {
                s.vel += (s.omega * s.omega * (target - s.x)
                    - 2 * ZETA * s.omega * s.vel) * st;
                s.x += s.vel * st;
            }

            if (!s.push && !s.lag && Math.abs(s.x) < 0.01
                    && Math.abs(s.vel) < 0.04) {
                s.x = 0;
                s.vel = 0;
                out.push(null);
            } else {
                alive = true;
                out.push(box.height > 0 ? s.x / box.height : 0);
            }
        }

        for (i = 0; i < state.length; i++) {
            s = state[i];
            if (out[i] === null) {
                if (s.on) {
                    s.on = false;
                    s.mark.classList.remove("is-dragged");
                    s.mark.style.removeProperty("--drag-y");
                    s.mark.style.removeProperty("--drag-x");
                }
                continue;
            }
            // Stretched along the way it is going and taken in across it,
            // which is what gives it away as a shape being pulled rather than
            // a shape being resized. Not the full counter-scale that would
            // hold the area exactly: on a thirty-four pixel mark that is three
            // pixels of narrowing against one of stretch, and the mark reads
            // as pinched. Eleven twentieths of it gives most of it back and
            // keeps the width within half a pixel of itself.
            var k = out[i];
            s.mark.style.setProperty("--drag-y", (1 + k).toFixed(4));
            s.mark.style.setProperty("--drag-x", (1 - k * 0.55).toFixed(4));
            if (!s.on) {
                s.on = true;
                s.mark.classList.add("is-dragged");
            }
        }

        if (alive) requestAnimationFrame(frame);
        else { running = false; last = 0; }
    }

    // Scroll events are coalesced and arrive when the browser likes, so they
    // are used only to know that something is happening; the velocity is read
    // off the document inside the loop, where every frame counts.
    window.addEventListener("scroll", start, { passive: true });

    /* LEANING ON AN END. A haul rather than a collision: it pulls the marks
       WITH the hand, and it reaches the pinned one too, because at the ends
       nothing is sliding past anything -- the whole register is being leaned
       on. */
    window.addEventListener("wheel", function (e) {
        var y = window.pageYOffset || 0;
        if (!((y <= 0 && e.deltaY < 0) || (y >= maxScroll() - 0.5 && e.deltaY > 0))) {
            return;
        }
        var f = Math.max(-OVER_MAX, Math.min(OVER_MAX, e.deltaY * K_OVER));
        everyone(f);
    }, { passive: true });

    // A mark that moved because the page changed shape has not been carried
    // anywhere, and differencing a new position against an old layout is how a
    // resize becomes a flick. Phones resize mid-scroll every time the address
    // bar collapses.
    window.addEventListener("resize", function () {
        wasY = window.pageYOffset || 0;
        wasV = 0;
        for (var i = 0; i < state.length; i++) state[i].omega = omegaOf(state[i].mark);
    });
})();
