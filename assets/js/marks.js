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

    var sections = document.querySelectorAll(".section");
    var crossing = [];
    var observer = null;

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

        // A wiggle in flight holds its target with !important and would win
        // against the story about to start, stranding that shape until the
        // fidget's own timer got round to clearing it. idle.js owns the
        // gestures and their names, and hangs this on every mark so the list
        // does not have to be restated here and kept in step.
        if (mark._quiet) mark._quiet();

        // Taking the class off and reading a layout value back puts the
        // animation to the start again. Without it a mark asked to move while
        // it is already moving simply carries on with the old telling, which is
        // how you get a shape stranded half way out.
        mark.classList.remove("anim");
        void mark.offsetWidth;

        /* WHICH WAY EACH PIECE BENDS.

           Nothing alive travels in a straight line between two points, so
           every travelling step swings off the line by a few pixels -- and the
           side it swings to is drawn here, per piece, per telling. A mark with
           three satellites therefore has eight ways of coming apart for each
           of its five stories, and the same story told twice never bends the
           same way twice running.

           It is the cheapest variety in the whole file: one number per part,
           and the difference between an ensemble and a mechanism. */
        Array.prototype.forEach.call(
            mark.querySelectorAll("i:not([data-lead])"), function (part) {
                part.style.setProperty("--arc", Math.random() < 0.5 ? "-1" : "1");
            });

        mark.dataset.story = s.name;
        mark.style.setProperty("--dur",
            Math.round((open ? s.open : s.shut) * jitter) + "ms");
        mark.style.setProperty("--stagger",
            Math.round(s.stagger * jitter) + "ms");
        mark.classList.add("anim");
        mark.classList.toggle("is-open", open);

        // Say when the telling is over. The .anim class has to stay on -- it
        // is what holds the fill-mode that keeps the parts where they landed
        // -- so it cannot be the signal that a mark is quiet again. idle.js
        // waits for this before it stirs anything.
        delete mark.dataset.settled;
        clearTimeout(mark._settle);
        mark._settle = setTimeout(function () {
            mark.dataset.settled = "1";
        }, Math.round((open ? s.open : s.shut) * jitter) * 2 + 400);
    }

    // Everything before the observer's first answer is a starting position
    // rather than a change, and starting positions are taken up, not performed.
    var primed = false;

    function set(section, on) {
        var mark = section.querySelector(".section-index");
        if (!mark) return;
        if (mark.classList.contains("is-open") === on) return;
        if (!primed) {
            mark.classList.toggle("is-open", on);
            return;
        }
        play(mark, on);
    }

    function stickyTop() {
        var v = parseFloat(getComputedStyle(document.documentElement)
            .getPropertyValue("--sticky-top"));
        // What the stylesheet falls back to where the bar has not been
        // measured yet.
        return v > 0 ? v : 48;
    }

    /* WHO OWNS THE HEADER.

       Decided once for the whole register on every answer, rather than section
       by section as the answers arrive. That matters at the top of the page.

       Above the first label nothing crosses the line, so by the letter of the
       rule no mark is the header and every one of them is shut. But the reader
       is not between sections up there -- they are at the head of the register
       with the first section directly in front of them, and a shut mark says
       "still to come" about the only thing on screen. So when nothing owns the
       line and the first section has not yet reached it, the first section
       owns it: on load, and again every time anyone scrolls back to the top.

       Section by section this produced a flinch. Scrolling up to the top, the
       first section stops crossing the line and its own answer says shut --
       and only afterwards would anything work out that it should be open
       again, by which time it had already played its closing story. Deciding
       first and assigning second, there is no moment in between to close in.

       Scrolling off the FOOT of the register is the other case where nothing
       crosses the line, and this deliberately does not fire there: by then the
       first section is far above and the test for it being still ahead of you
       fails, so the marks are all shut, which is correct. */
    function owner() {
        for (var i = 0; i < sections.length; i++) {
            if (crossing[i]) return sections[i];
        }
        if (sections.length
                && sections[0].getBoundingClientRect().top > stickyTop()) {
            return sections[0];
        }
        return null;
    }

    function apply() {
        var own = owner();
        Array.prototype.forEach.call(sections, function (s) {
            set(s, s === own);
        });
    }

    function watch() {
        if (observer) observer.disconnect();
        var top = stickyTop();
        var bottom = window.innerHeight - top - 1;
        if (bottom < 0) return;

        observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
                crossing[Array.prototype.indexOf.call(sections, e.target)]
                    = e.isIntersecting;
            });
            apply();
            primed = true;
        }, { rootMargin: -top + "px 0px " + -bottom + "px 0px", threshold: 0 });

        Array.prototype.forEach.call(sections, function (s) {
            observer.observe(s);
        });

        // And decide once immediately, without waiting to be told. An observer
        // reports at its own convenience and reports only what it watches, so a
        // page sitting at the top -- where nothing crosses the line and
        // therefore nothing has changed -- would otherwise show every mark shut
        // until something happened. The head of the register should be open
        // before anyone has done anything at all.
        apply();
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
