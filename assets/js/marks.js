/*-----------------------------------------------------------------------------
    Opens a section's mark when its label reaches the top, and decides which of
    its five stories it tells on the way.

    The mark is three or four traced shapes. Gathered, they lie on top of one
    another and -- being all one colour -- read as a single body with no seam
    anywhere in it, fatter than any part it is made of. Opened, they are the
    pieces the composition was made of, standing where build-shapes.py put them.

    WHICH WAY ROUND. The mark is a plain body while its section is still ahead
    of you and comes apart at the moment its label stops being something you
    scroll past and becomes the header for what you are reading.

    HOW IT IS DECIDED. A one-pixel band at the sticky line, and whichever
    section is crossing it owns the header. One observer with a rootMargin, not
    a scroll handler: the browser does the geometry off the main thread and the
    answer arrives only when it changes. The band is measured from --sticky-top
    rather than guessed, since the line follows the bar's height and the bar
    follows the type, and it is rebuilt on resize because an observer's
    rootMargin is fixed when it is made.

    WHICH STORY. At random, every single time, and the two directions are drawn
    separately -- a mark that comes apart by unrolling is under no obligation to
    go back together the same way. Six marks are on screen one after another for
    as long as anyone is reading, and a single gesture repeated is the one thing
    that would certainly wear out.

    NO TWO TELLINGS ALIKE. The duration is knocked about by up to a seventh
    each time, and the stagger with it, so even the same story twice running is
    not quite the same length. Stories differ from each other much more than
    that: the quickest is over in six hundred milliseconds and the slowest takes
    most of a second, which is deliberate -- they are not variations on one
    gesture, they are different gestures.
-----------------------------------------------------------------------------*/

(function () {
    "use strict";

    var marks = document.querySelectorAll(".section-index");
    if (!marks.length || !("IntersectionObserver" in window)) return;

    // Opening is the event you are meant to watch and gets the longer telling;
    // closing happens behind you as you leave and is quicker in every case.
    var STORIES = [
        { name: "unroll", open: 880, shut: 780, stagger: 72 },
        { name: "pop", open: 620, shut: 560, stagger: 40 },
        { name: "shed", open: 1010, shut: 920, stagger: 96 },
        { name: "unscrew", open: 900, shut: 820, stagger: 62 },
        { name: "stretch", open: 780, shut: 700, stagger: 52 }
    ];

    function play(mark, open) {
        var s = STORIES[Math.floor(Math.random() * STORIES.length)];
        var jitter = 0.88 + Math.random() * 0.28;

        // Taking the class off and reading a layout value back puts the
        // animation to the start again. Without it a mark asked to move while
        // it is already moving simply carries on with the old telling, which is
        // how you get a shape stranded half way out.
        mark.classList.remove("anim");
        void mark.offsetWidth;

        mark.dataset.story = s.name;
        mark.style.setProperty("--dur",
            Math.round((open ? s.open : s.shut) * jitter) + "ms");
        mark.style.setProperty("--stagger",
            Math.round(s.stagger * jitter) + "ms");
        mark.classList.add("anim");
        mark.classList.toggle("is-open", open);
    }

    function set(section, on) {
        var mark = section.querySelector(".section-index");
        if (!mark) return;
        if (mark.classList.contains("is-open") === on) return;
        play(mark, on);
    }

    var sections = document.querySelectorAll(".section");
    var observer = null;

    function stickyTop() {
        var v = parseFloat(getComputedStyle(document.documentElement)
            .getPropertyValue("--sticky-top"));
        // What the stylesheet falls back to where the bar has not been
        // measured yet.
        return v > 0 ? v : 48;
    }

    function watch() {
        if (observer) observer.disconnect();
        var top = stickyTop();
        var bottom = window.innerHeight - top - 1;
        if (bottom < 0) return;

        observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
                set(e.target, e.isIntersecting);
            });
        }, { rootMargin: -top + "px 0px " + -bottom + "px 0px", threshold: 0 });

        Array.prototype.forEach.call(sections, function (s) {
            observer.observe(s);
        });
    }

    var queued = false;
    window.addEventListener("resize", function () {
        if (queued) return;
        queued = true;
        requestAnimationFrame(function () {
            queued = false;
            watch();
        });
    });

    if (document.fonts && document.fonts.ready) document.fonts.ready.then(watch);

    watch();
})();
