/*-----------------------------------------------------------------------------
    Brings a figure into focus as it reaches the reading band.

    Two observers rather than a scroll handler: the browser does the geometry
    off the main thread, and 48 figures cost nothing. The outer one fires well
    before a figure arrives, so it is already half-lifted by the time it is on
    screen; the inner one only counts the middle of the viewport, so the
    picture is fully itself exactly where it is being read.

    The wash lives in CSS; this only says which of the three states applies.
-----------------------------------------------------------------------------*/

(function () {
    "use strict";

    var figures = document.querySelectorAll(".entry-figure");
    if (!figures.length || !("IntersectionObserver" in window)) return;

    // Anything within a screen-and-a-half is "near".
    var near = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
            e.target.classList.toggle("is-near", e.isIntersecting);
        });
    }, { rootMargin: "60% 0px 60% 0px", threshold: 0 });

    // "In" is the middle band of the viewport, where reading actually happens.
    var inview = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
            e.target.classList.toggle("is-in", e.isIntersecting);
        });
    }, { rootMargin: "-22% 0px -22% 0px", threshold: 0 });

    Array.prototype.forEach.call(figures, function (f) {
        near.observe(f);
        inview.observe(f);
    });
})();
