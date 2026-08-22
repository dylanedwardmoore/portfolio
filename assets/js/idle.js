/*-----------------------------------------------------------------------------
    Occasionally, one part of one mark stirs.

    A mark at rest is still a thing, and things that are alive are never
    perfectly still. Every few seconds this picks one mark, one part of it, and
    one small gesture, and lets it play. Then nothing for a while.

    WHAT IT WILL NOT DO, which is most of the design:

      * two at once on the same mark. One shape moving reads as a thing
        noticing something. Two reads as a page with a fault.
      * anything to a mark that is mid-telling. The gesture would be layered
        over a running animation and the resting transform it starts from would
        be wrong, so a mark that is opening or closing is simply skipped.
      * anything while the tab is in the background, or while the register is
        scrolled past. Motion nobody can see is a battery being spent.
      * anything under reduced motion.

    STARTING FROM WHERE THE PART ALREADY IS. Every part has a resting transform
    and no two of them are the same -- a gathered satellite sits at translate()
    scale(), a lead at scale(1.24), an open part at none. The gesture is a
    delta laid on top, so the part's own resting transform is read off the
    element and handed to the keyframes as --at. Without that every wiggle
    would begin by snapping the shape back to the origin.

    WHICH GESTURE. A part folded into a body has nowhere to go and is offered
    only the two that stay put; a part standing on its own can also lean and
    shrug. The slowest and most conspicuous is also the rarest.
-----------------------------------------------------------------------------*/

(function () {
    "use strict";

    var marks = document.querySelectorAll(".section-index");
    if (!marks.length) return;

    var reduced = window.matchMedia
        && window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced && reduced.matches) return;

    // name, how long it runs, and how often it is drawn relative to the rest.
    // Weighted rather than uniform: breathing should be common and leaning
    // should be a surprise.
    var GESTURES = [
        { name: "breathe", ms: 1500, weight: 5, needsRoom: false },
        { name: "twitch", ms: 620, weight: 4, needsRoom: false },
        { name: "shiver", ms: 540, weight: 3, needsRoom: true },
        { name: "shrug", ms: 820, weight: 3, needsRoom: true },
        { name: "lean", ms: 1100, weight: 2, needsRoom: true }
    ];

    function pick(list) {
        var total = 0, i;
        for (i = 0; i < list.length; i++) total += list[i].weight;
        var r = Math.random() * total;
        for (i = 0; i < list.length; i++) {
            r -= list[i].weight;
            if (r <= 0) return list[i];
        }
        return list[list.length - 1];
    }

    function busy(mark) {
        // Mid-telling: the classes the stories run on are still present and
        // the part's resting transform is not where it is sitting.
        return mark.classList.contains("anim")
            && mark.dataset.settled !== "1";
    }

    function onScreen(mark) {
        var r = mark.getBoundingClientRect();
        return r.bottom > 0 && r.top < window.innerHeight;
    }

    function stir() {
        var candidates = [];
        Array.prototype.forEach.call(marks, function (m) {
            if (!busy(m) && onScreen(m) && !m.dataset.stirring) candidates.push(m);
        });
        if (!candidates.length) return;

        var mark = candidates[Math.floor(Math.random() * candidates.length)];
        // Open parts stand apart and have room; gathered ones are inside the
        // body and do not.
        var room = mark.classList.contains("is-open");
        var g = pick(GESTURES.filter(function (x) {
            return room || !x.needsRoom;
        }));

        var parts = mark.querySelectorAll("i");
        var part = parts[Math.floor(Math.random() * parts.length)];
        if (!part) return;

        // The transform the part is already holding, so the gesture can be a
        // delta on top of it rather than a jump back to the origin.
        var at = getComputedStyle(part).transform;
        part.style.setProperty("--at", at === "none" ? "translate(0)" : at);

        mark.dataset.stirring = "1";
        part.classList.add("wiggle-" + g.name);
        setTimeout(function () {
            part.classList.remove("wiggle-" + g.name);
            part.style.removeProperty("--at");
            delete mark.dataset.stirring;
        }, g.ms + 40);
    }

    // Irregular on purpose. A stir every five to fourteen seconds, and the gap
    // drawn fresh each time -- a fixed interval is a metronome, and a
    // metronome is the one thing this must not sound like.
    function next() {
        var wait = 5000 + Math.random() * 9000;
        setTimeout(function () {
            if (!document.hidden) stir();
            next();
        }, wait);
    }

    next();
})();
