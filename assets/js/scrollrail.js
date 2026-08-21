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
        var topSel = rail.getAttribute("data-rail-top");

        function railTop() {
            if (!topSel) return 0;
            var t = document.querySelector(topSel);
            return t ? Math.max(0, t.getBoundingClientRect().bottom) : 0;
        }

        function metrics() {
            var start = isWindow ? railTop() : 0;
            var box = isWindow
                ? { top: start, height: window.innerHeight - start }
                : el.getBoundingClientRect();
            return {
                box: box,
                over: el.scrollHeight - viewport(),
                pos: isWindow ? (window.scrollY || el.scrollTop) : el.scrollTop
            };
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

            var h = Math.max(24, m.box.height * (viewport() / el.scrollHeight));
            thumb.style.height = h + "px";
            thumb.style.top = (m.pos / m.over) * (m.box.height - h) + "px";

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
