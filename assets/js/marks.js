/*-----------------------------------------------------------------------------
    Opens a section's mark when its label reaches the top.

    The mark is a composition of three or four traced shapes. Gathered, they
    lie over one another and -- being all one colour -- read as a single
    silhouette with no seam anywhere in it. Opened, they are the pieces the
    composition was made of, standing apart in the arrangement build-shapes.py
    laid out.

    WHICH WAY ROUND. The mark is plain while its section is still ahead of you
    and opens at the moment the label stops being something you scroll past and
    becomes the header for what you are reading. So the state is not "is this
    section visible" -- most of them are, most of the time -- but "is this the
    label currently pinned at the top", which is exactly one section at a time.

    HOW IT IS DECIDED. A one-pixel band at the sticky line, and whichever
    section is crossing it owns the header. That is a single observer with a
    rootMargin, not a scroll handler: the browser does the geometry off the
    main thread and the answer arrives only when it changes.

    The band has to be measured, not guessed. The labels stick at --sticky-top,
    which is set from the bar's height at runtime and follows the type scale, so
    the margin is read from the same property rather than restated here. It is
    re-read on resize, since an observer's rootMargin is fixed at construction
    and a window that changes shape moves the line.
-----------------------------------------------------------------------------*/

(function () {
    "use strict";

    var marks = document.querySelectorAll(".section-index");
    if (!marks.length || !("IntersectionObserver" in window)) return;

    var sections = document.querySelectorAll(".section");
    var observer = null;

    function stickyTop() {
        var v = parseFloat(getComputedStyle(document.documentElement)
            .getPropertyValue("--sticky-top"));
        // The stylesheet's own fallback where the bar has not been measured
        // yet: 3rem at the register's width, which is what the sticky rule
        // falls back to as well.
        return v > 0 ? v : 48;
    }

    function open(section, on) {
        var mark = section.querySelector(".section-index");
        if (mark) mark.classList.toggle("is-open", on);
    }

    function watch() {
        if (observer) observer.disconnect();

        // A band one pixel deep, sitting on the line the labels stick to.
        // Everything above it and everything below it is margined away, so a
        // section intersects only while it is the one under the header.
        var top = stickyTop();
        var bottom = window.innerHeight - top - 1;
        if (bottom < 0) return;

        observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
                open(e.target, e.isIntersecting);
            });
        }, { rootMargin: -top + "px 0px " + -bottom + "px 0px", threshold: 0 });

        Array.prototype.forEach.call(sections, function (s) {
            observer.observe(s);
        });
    }

    // Resize fires in bursts while a window is dragged and each rebuild throws
    // the observer away; one per frame is plenty.
    var queued = false;
    window.addEventListener("resize", function () {
        if (queued) return;
        queued = true;
        requestAnimationFrame(function () {
            queued = false;
            watch();
        });
    });

    // After the fonts land: --sticky-top is measured off the bar, and the bar's
    // height follows the type, so the line moves once when the type arrives.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(watch);

    watch();
})();
