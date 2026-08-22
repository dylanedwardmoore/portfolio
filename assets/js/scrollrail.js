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
    and optionally data-cue="1" to show the chevron affordance.

    With no JavaScript both pages still scroll; they just scroll unmarked.
-----------------------------------------------------------------------------*/

(function () {
    "use strict";

    function setup(rail) {
        var spec = rail.getAttribute("data-scroll") || "window";
        var isWindow = spec === "window";
        var el = isWindow ? document.scrollingElement || document.documentElement
            : document.querySelector(spec);
        if (!el) return;

        var thumb = rail.querySelector(".scrollrail-thumb");
        var cue = rail.getAttribute("data-cue")
            ? document.querySelector(".scrollcue") : null;
        var everScrolled = false;
        var dragging = false;

        function viewport() {
            return isWindow ? window.innerHeight : el.clientHeight;
        }

        // The landing page only turns its blurb into a scroller above a
        // certain size; below that the page scrolls normally and the rail has
        // nothing to represent.
        function live() {
            return isWindow || getComputedStyle(el).overflowY === "auto";
        }

        // A window rail can be told to begin below something -- here the
        // sticky bar -- so the track starts at the rule under it rather than
        // running up behind it to the top of the screen.
        //
        // Its HEIGHT, not its current bottom: the bar is sticky, so its
        // bottom travels upward during the first stretch of scrolling before
        // it pins. Following that would drag the top of the rail up with it.
        // The height is where the bar comes to rest, so the rail is fixed
        // from the first pixel.
        var topSel = rail.getAttribute("data-rail-top");

        function railTop() {
            if (!topSel) return 0;
            var t = document.querySelector(topSel);
            return t ? Math.max(0, t.offsetHeight) : 0;
        }

        // The frame's bottom rule is a fixed band across the foot of the
        // window. A full-height track runs underneath it, so the thumb
        // collides with the rule whenever it reaches the end. The track stops
        // one rule-width short instead, which also leaves the two greens
        // reading as separate marks rather than one smear.
        function railFoot() {
            if (!isWindow) return 0;
            var frame = document.querySelector(".frame-bottom");
            if (!frame || getComputedStyle(frame).display === "none") return 0;
            return frame.getBoundingClientRect().height + 6;
        }

        function metrics() {
            var start = isWindow ? railTop() : 0;
            var box = isWindow
                ? { top: start, height: window.innerHeight - start - railFoot() }
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
                if (cue) cue.hidden = true;
                return;
            }
            var m = metrics();
            if (m.over <= 1) {
                rail.hidden = true;
                if (cue) cue.hidden = true;
                return;
            }
            if (m.pos > 4) everScrolled = true;

            rail.hidden = false;
            rail.style.top = m.box.top + "px";
            rail.style.height = m.box.height + "px";

            var h = Math.max(24, Math.min(m.box.height,
                m.box.height * (viewport() / el.scrollHeight)));
            var travel = Math.max(0, m.box.height - h);
            thumb.style.height = h + "px";
            thumb.style.top = Math.max(0, Math.min(travel,
                (m.pos / m.over) * travel)) + "px";

            // The cue answers one question -- does this move -- and only
            // while that question is open.
            if (cue) {
                if (everScrolled) {
                    cue.hidden = true;
                } else {
                    cue.hidden = false;
                    cue.style.left = getComputedStyle(rail).left;
                    cue.style.top = (m.box.top + m.box.height + 7) + "px";
                }
            }
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
            var h = thumb.getBoundingClientRect().height;
            var travel = m.box.height - h;
            if (travel <= 0) return 0;
            var y = clientY - m.box.top - grabOffset;
            return (y / travel) * m.over;
        }

        thumb.addEventListener("pointerdown", function (e) {
            e.preventDefault();
            dragging = true;
            everScrolled = true;
            var grab = e.clientY - thumb.getBoundingClientRect().top;
            thumb.setPointerCapture(e.pointerId);
            rail.classList.add("is-dragging");

            function move(ev) {
                if (!dragging) return;
                scrollTo(positionFromPointer(ev.clientY, grab));
            }
            function up(ev) {
                dragging = false;
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

        // Clicking the cue glides on by roughly a screenful. Hand-run rather
        // than `behavior: "smooth"`, so the curve matches the rest of the site
        // (ease-in-out, same duration family as the hover states) instead of
        // whatever the browser picks.
        function glide(delta) {
            var m = metrics();
            var from = m.pos;
            var to = Math.max(0, Math.min(m.over, from + delta));
            if (to === from) return;
            if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
                scrollTo(to);
                return;
            }
            var start = performance.now(), dur = 520;
            (function frame(now) {
                var t = Math.min(1, (now - start) / dur);
                // ease-in-out cubic: settles rather than stopping dead
                var e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
                scrollTo(from + (to - from) * e);
                if (t < 1) requestAnimationFrame(frame);
            })(start);
        }

        if (cue) {
            cue.addEventListener("click", function () {
                everScrolled = true;
                glide(viewport() * 0.85);
                draw();
            });
        }

        // A click on the empty track jumps the thumb's centre to the pointer.
        rail.addEventListener("pointerdown", function (e) {
            if (e.target === thumb) return;
            everScrolled = true;
            var h = thumb.getBoundingClientRect().height;
            scrollTo(positionFromPointer(e.clientY, h / 2));
        });

        (isWindow ? window : el).addEventListener("scroll", draw, { passive: true });
        window.addEventListener("resize", draw);
        window.addEventListener("orientationchange", draw);
        if (window.ResizeObserver && !isWindow) new ResizeObserver(draw).observe(el);
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
        Array.prototype.forEach.call(document.images, function (im) {
            if (!im.complete) im.addEventListener("load", draw);
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
        if (getComputedStyle(rule).display === "none") return;

        var first = lineRects(head)[0];
        var lines = lineRects(body);
        var last = lines[lines.length - 1];
        var top = first.top + halfLeading(head);
        var foot = last.bottom - halfLeading(body);
        if (!(foot > top)) return;

        var origin = host.getBoundingClientRect().top;
        rule.style.top = (top - origin) + "px";
        rule.style.bottom = "auto";
        rule.style.height = (foot - top) + "px";
    }

    window.addEventListener("resize", syncEdgeRule);
    window.addEventListener("orientationchange", syncEdgeRule);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncEdgeRule);
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

    Array.prototype.forEach.call(document.querySelectorAll(".scrollrail"), setup);
})();
