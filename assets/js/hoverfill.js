/*  THE GROUND ARRIVES FROM WHERE THE POINTER CROSSED, AND LEAVES THE WAY IT
    WENT.

    The blocks on the landing page and the back control on the register fill
    with green when a pointer is on them. That fill used to be a background
    colour on a 110ms transition: correct, and inert -- the same 110ms whether
    you came down onto it from the word above, in from the margin, or off the
    end of it, and the same 110ms leaving.

    This gives it the scroll rail's manners instead. The rail is a mark that
    deforms under a hand and springs back; this is a ground that spreads from
    the point it was entered at and gathers back to the point it was left at,
    on the same kind of spring, with the same overshoot.

    HOW IT IS DRAWN. Not a pseudo-element: .backlink has both of its own
    already -- ::before is the arrow and ::after is the rule -- and a gesture
    that only worked on one of the two controls would be worse than none. So
    the fill is a background-image, a linear-gradient with two hard stops:

        transparent | --fill-a | sea | --fill-b | transparent

    Two stops moving apart along a gradient line whose ANGLE is the direction
    the pointer was travelling when it crossed the edge. That angle is the
    whole trick -- it means the ground sweeps the way the hand was going, and
    the same code covers coming in from the left, dropping in from above, or
    cutting across a corner, without a single special case.

    At rest both stops sit at 50% and the gradient is a zero-width band
    between two transparencies: nothing, painted nowhere, costing nothing.

    ONE MECHANISM, NOT TWO. The stylesheet already puts those same two stops
    at 0% and 100% on :hover and :focus-visible, which is the whole gesture
    for a browser with no script, one asked for reduced motion, and anyone
    arriving by keyboard. This file does not replace that, it only changes how
    the numbers get there: inline styles outrank a stylesheet, so while the
    spring is running it wins, and when it lets go the rule underneath is
    already the state it was heading for. Nothing here needs to announce
    itself to the stylesheet, which is why there is no marker class.

    THE BOUNCE IS REAL AND IT IS SMALL. The stops spring to 0% and 100% -- the
    exact edges, not past them -- so the overshoot carries them off the box
    where nothing can be seen, and the settle brings them back a little way ON
    to it before they come to rest. What you see at the end of the sweep is a
    sliver of the ground uncovering and closing again, about one per cent of
    the block, for about a twentieth of a second. On the back control, which is
    a fifth the width, it is a pixel. It scales with the thing, which is what
    makes it read as weight rather than as a glitch.

    ZETA is the rail's, near enough: 0.6 there, 0.58 here. The two gestures are
    meant to feel like they were made by the same hand.  */
(function () {
    "use strict";

    var REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)");
    var FINE = window.matchMedia("(hover: hover) and (pointer: fine)");

    /*  A touch is not a hover. iOS applies :hover to whatever is under a
        finger -- including one only passing through on its way to scrolling --
        and leaves it applied. The stylesheet already gates the plain fill on a
        real pointer; this gates the animated one the same way, and for the
        same reason.  */
    if (!FINE.matches || REDUCED.matches) return;

    var ZETA = 0.58;            // the rail runs 0.6. Same hand.
    /*  In and out are not the same speed, and that is deliberate.

        The rule under each control cuts its rake back on the way out over
        420ms, and the stylesheet's note beside it is emphatic that this is
        the one slow thing on the page and that it must not have company:
        "two gestures crossing where one would do". The ground going was
        always meant to be quick, so that what you watch on the way out is the
        blade, not the paint.

        So the sweep in takes its time and bounces where it can be seen, and
        the gathering out is half again as stiff -- brisk enough to be out of
        the way before the notch starts, still on a spring, still going where
        the hand went.  */
    var OMEGA_IN = 23;          // ~300ms to settle, which is 4/(zeta*omega)
    var OMEGA_OUT = 34;         // ~200ms, and gone before the notch begins
    var RAKE_ZETA = 0.75;       // the slant settles sooner than the sweep
    var RAKE_OMEGA = 30;
    var RAKE_MAX = 15;          // degrees, at any speed
    var RAKE_PER_PX = 0.020;    // degrees per pixel/second of entry speed
    var SPEED_CAP = 2600;       // px/s past which nothing rakes any harder

    /*  Where the pointer was a moment ago.

        pointerenter carries a position and no history, and the direction the
        hand was travelling is the entire input to this gesture. So the last
        move is kept globally: one listener for the document rather than one
        per control, and it is passive because it never does anything but
        record.  */
    var last = null;
    document.addEventListener("pointermove", function (e) {
        last = { x: e.clientX, y: e.clientY, t: e.timeStamp };
    }, { passive: true });

    var clock = window.performance && performance.now
        ? function () { return performance.now(); }
        : function () { return Date.now(); };

    /*  The gradient line for a CSS angle, and where a point falls along it.

        CSS measures gradient angles from "to top", clockwise, so the unit
        vector down the line is (sin, -cos) in screen coordinates, where y
        counts downward. The line is centred on the box and long enough that
        0% and 100% sit exactly on the corners that the angle points between,
        which is |W*sin| + |H*cos|.

        Returning a percentage rather than a length keeps everything after
        this in the same units the gradient stops are written in.  */
    function project(box, deg, x, y) {
        var r = deg * Math.PI / 180;
        var dx = Math.sin(r), dy = -Math.cos(r);
        var len = Math.abs(box.width * dx) + Math.abs(box.height * dy);
        if (!len) return 50;
        var cx = box.left + box.width / 2;
        var cy = box.top + box.height / 2;
        var t = ((x - cx) * dx + (y - cy) * dy) / len;
        return Math.max(0, Math.min(100, (t + 0.5) * 100));
    }

    /*  The direction the hand was going, as a CSS gradient angle.

        Falls back to the inward normal -- the line from the middle of the
        control to the point on its edge -- when there is no usable history:
        a pointer that appeared without moving, one that has been still long
        enough that the last sample is stale, or a move too small to have a
        direction. Entering slowly is not the same as entering from nowhere,
        and the fill should still know which way it came.  */
    function heading(box, e) {
        var vx = 0, vy = 0, speed = 0;
        if (last) {
            var dt = (e.timeStamp - last.t) / 1000;
            if (dt > 0 && dt < 0.2) {
                vx = (e.clientX - last.x) / dt;
                vy = (e.clientY - last.y) / dt;
                speed = Math.hypot(vx, vy);
            }
        }
        if (speed < 40) {
            vx = e.clientX - (box.left + box.width / 2);
            vy = e.clientY - (box.top + box.height / 2);
            // Pointing at the entry point; the sweep wants to go the other way.
            vx = -vx; vy = -vy;
            var n = Math.hypot(vx, vy) || 1;
            vx /= n; vy /= n;
        }
        return {
            deg: (Math.atan2(vx, -vy) * 180 / Math.PI + 360) % 360,
            speed: Math.min(speed, SPEED_CAP),
        };
    }

    function attach(el) {
        // Two stops and a slant, each with a position and a velocity.
        var a = 50, av = 0, aT = 50;
        var b = 50, bv = 0, bT = 50;
        var rake = 0, rv = 0, rakeT = 0;
        var deg = 90;
        var on = false;
        var omega = OMEGA_IN;
        var raf = 0, prev = 0;

        /*  THE AXIS CAN ONLY BE CHANGED WHEN THE CHANGE CANNOT BE SEEN.

            --fill-a and --fill-b are percentages along the gradient LINE, so
            they only mean anything paired with the angle that drew it. Turn
            the line while a band is part way across and the same two numbers
            describe a completely different shape: the ground jumps sideways in
            one frame.

            It is invisible in exactly two states. Empty -- the stops are
            together and there is no green to move. And full -- 0% to 100%
            covers the whole box at every angle, so the box stays covered while
            the line turns underneath it.

            Anything else keeps the angle it came in on. A pointer that flicks
            across a control and leaves before the sweep has landed gets a
            gathering along the line it arrived on, which is a little less
            expressive and entirely continuous. Continuity wins.  */
        function canTurn() {
            return Math.abs(b - a) < 0.5 || (a <= 0.5 && b >= 99.5);
        }

        function clear() {
            el.style.removeProperty("--fill-a");
            el.style.removeProperty("--fill-b");
            el.style.removeProperty("--fill-rake");
        }

        function paint() {
            // Never let the stops cross: a gradient with its stops out of
            // order clamps them, which shows as the band snapping shut a
            // frame early rather than closing.
            var lo = Math.min(a, b), hi = Math.max(a, b);
            el.style.setProperty("--fill-a", lo.toFixed(2) + "%");
            el.style.setProperty("--fill-b", hi.toFixed(2) + "%");
            el.style.setProperty("--fill-rake", (deg + rake).toFixed(2) + "deg");
        }

        function frame(t) {
            raf = 0;
            var dt = prev ? (t - prev) / 1000 : 1 / 60;
            prev = t;
            if (!(dt > 0)) dt = 1 / 60;
            if (dt > 0.1) dt = 0.1;          // a dropped frame is not a step

            // Substepped, so a slow frame cannot make the spring ring on its
            // own. Same reasoning as the rail's integrator.
            var steps = Math.ceil(dt / 0.008) || 1;
            var st = dt / steps;
            for (var i = 0; i < steps; i++) {
                av += (omega * omega * (aT - a) - 2 * ZETA * omega * av) * st;
                a += av * st;
                bv += (omega * omega * (bT - b) - 2 * ZETA * omega * bv) * st;
                b += bv * st;
                rv += (RAKE_OMEGA * RAKE_OMEGA * (rakeT - rake)
                    - 2 * RAKE_ZETA * RAKE_OMEGA * rv) * st;
                rake += rv * st;
            }

            var settled = Math.abs(a - aT) < 0.05 && Math.abs(av) < 0.5
                && Math.abs(b - bT) < 0.05 && Math.abs(bv) < 0.5
                && Math.abs(rake - rakeT) < 0.05 && Math.abs(rv) < 0.5;

            if (settled && !on) {
                // Gone, and gone completely: the control is left with no
                // properties of its own, exactly as it loaded.
                a = b = 50; av = bv = 0;
                rake = 0; rv = 0;
                clear();
                prev = 0;
                return;
            }

            paint();
            if (settled) { prev = 0; return; }
            start();
        }

        function start() {
            if (!raf) raf = requestAnimationFrame(frame);
        }

        el.addEventListener("pointerenter", function (e) {
            var box = el.getBoundingClientRect();
            var h = heading(box, e);
            // Coming back before the last one had finished leaving: keep the
            // ground where it is and spread from there. Restarting it at the
            // pointer would throw away a fill that is already half drawn.
            var fresh = !raf && !on;
            if (canTurn() || fresh) deg = h.deg;
            var e0 = project(box, deg, e.clientX, e.clientY);
            if (fresh) { a = b = e0; av = bv = 0; }
            on = true;
            omega = OMEGA_IN;
            aT = 0; bT = 100;
            rakeT = 0;
            // The slant is the entry's, and it is spent settling.
            rake = Math.max(-RAKE_MAX, Math.min(RAKE_MAX,
                h.speed * RAKE_PER_PX * (e0 < 50 ? 1 : -1)));
            rv = 0;
            paint();
            start();
        });

        el.addEventListener("pointerleave", function (e) {
            var box = el.getBoundingClientRect();
            var h = heading(box, e);
            // Gathers to the point it was left at, along the line it left on
            // -- or along the line it arrived on, if turning now would show.
            if (canTurn()) deg = h.deg;
            var e1 = project(box, deg, e.clientX, e.clientY);
            on = false;
            omega = OMEGA_OUT;
            aT = bT = e1;
            rakeT = 0;
            start();
        });

        // A pointer that is taken away rather than moved away -- a window
        // losing focus, a device disconnecting -- still has to let go.
        el.addEventListener("pointercancel", function () {
            on = false;
            omega = OMEGA_OUT;
            aT = bT = (a + b) / 2;
            start();
        });
    }

    /*  Every link on the site that fills.

        This list is the same one the stylesheet carries -- see the shared
        gradient rule in site.css -- and the two have to agree: a control the
        stylesheet paints a gradient for and this file does not attach to
        would fill instantly and never move. They are kept honest by a test
        rather than by hope; tests/static/css-integrity.test.js reads both and
        compares them.  */
    var FILLS = ".doclink, .backlink, .doclink-inline, .bio a, .prose a,"
        + " .entry-links a";

    var controls = document.querySelectorAll(FILLS);
    Array.prototype.forEach.call(controls, attach);
}());
