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
            thumb.style.height = h + "px";
            thumb.style.top = Math.max(0, Math.min(travel,
                (m.pos / m.over) * travel)) + "px";

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

    Array.prototype.forEach.call(document.querySelectorAll(".scrollrail"), setup);
})();
