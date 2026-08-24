/*-----------------------------------------------------------------------------
    THE MARKS' RESTING LIFE.

    A mark at rest is still a thing, and things that are alive are never
    perfectly still. Every few seconds this picks one mark and lets it do one
    small thing. It is also what answers a click: the marks are not controls
    and are not advertised as any -- no pointer, no focus ring, nothing that
    says press me -- but anyone who does press one gets an answer, because a
    small drawing that moves on its own and then ignores you is worse than one
    that never moved.

    TWO REPERTOIRES, BECAUSE THERE ARE TWO THINGS TO MOVE.

    Gathered, the mark is ONE BODY: every part is the same colour and lies on
    top of the others, so there is no seam anywhere in it and the silhouette
    really is a single shape. Stirring one part inside that pile is mostly
    invisible -- the part is under the lead's outline and the outline is what
    you can see -- so the gathered gestures move the WHOLE MARK. The body
    nods, breathes, settles, rocks. That is the honest reading of what is
    there.

    Open, the mark is an ENSEMBLE: the pieces stand apart where the
    composition put them, and one of them stirring is a member of a group
    noticing something. So the open gestures move ONE PART -- with a single
    exception, the ripple, which runs through all of them in turn and is the
    one gesture that needs an ensemble to mean anything.

    AND THE TWO MOVE DIFFERENTLY. The body glides; the pieces tick. That is
    not a stylistic choice, it is what the pieces are: seven of the eighteen in
    the register are between 1.2 and 2.7 pixels wide, and a shape that narrow
    keeps all of its ink when it moves a WHOLE device pixel and half of it when
    it moves a fraction of one. So a piece moves one pixel, holds, and moves
    back, and never occupies any of the distances in between. The stylesheet
    has the measurements.

    WHAT IT WILL NOT DO, which is most of the design:

      * two at once on the same mark. One shape moving reads as a thing
        noticing something. Two reads as a page with a fault.
      * anything to a mark that is mid-telling -- opening or closing. The
        gesture would be layered over a running animation and the resting
        transform it starts from would be wrong, so a mark in the middle of a
        story is skipped, and a click on one is ignored rather than queued.
      * anything while the tab is in the background, or while the register is
        scrolled past. Motion nobody can see is a battery being spent.
      * anything under reduced motion, click included.

    STARTING FROM WHERE THE THING ALREADY IS. Every part has a resting
    transform and no two of them are the same -- a gathered satellite sits at
    translate() scale(), a lead at scale(1.24), an open part at none. The
    gesture is a delta laid on top, so whatever is being moved has its own
    resting transform read off it and handed to the keyframes as --at. Without
    that every wiggle would begin by snapping the shape back to the origin.

    WHICH MARK STIRS ON ITS OWN. Drawn, but not evenly. The open mark is the
    one the reader is beside and the one whose parts have room to be seen
    moving; the gathered ones are scenery a screen away from the heading being
    read. So an open mark is offered six times as often as a gathered one --
    still a draw, so a gathered mark does stir, just rarely.

    WHICH GESTURE. Weighted too, and the slowest and most conspicuous is
    always the rarest. Breathing should be common and leaning should be a
    surprise.

    HOW BIG ANY OF THEM IS is not decided here -- the stylesheet holds the
    amplitudes, and they are all fractions of a pixel. What is decided here is
    how long each one is held before the mark is put back to rest, and those
    numbers have to match: clear a gesture early and the shape snaps home from
    wherever it had reached, which at this size is the only part of the whole
    arrangement anyone would actually notice.
-----------------------------------------------------------------------------*/

(function () {
    "use strict";

    var marks = document.querySelectorAll(".section-index");
    if (!marks.length) return;

    var reduced = window.matchMedia
        && window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced && reduced.matches) return;

    /*  name, how long it runs, how often it is drawn relative to the rest, and
        what it moves: "mark" puts the class on the whole group, "part" on one
        piece of it.

        The two lists share nothing, not even a name. A body has weight and can
        nod and settle and turn; a piece has none of that and cannot be turned
        at all without going to pieces, so it travels, and the five ways it can
        travel differ only in rhythm. Two vocabularies, because there are two
        different things being moved and only one of them is big enough to be
        moved smoothly.

        ms is how long the gesture is held, and it is the stylesheet's duration
        exactly. Nothing here is longer than about a second: these are fidgets
        rather than gestures, and a movement this small taken slowly is not
        subtle, it is invisible.  */
    var GATHERED = [
        { name: "breathe", ms: 1100, weight: 5, scope: "mark" },
        { name: "twitch", ms: 520, weight: 4, scope: "mark" },
        { name: "bob", ms: 620, weight: 4, scope: "mark" },
        { name: "settle", ms: 600, weight: 3, scope: "mark" },
        { name: "rock", ms: 900, weight: 2, scope: "mark" }
    ];

    /*  Out here every gesture is one device pixel, held and jumped. See THE
        RESTING LIFE in the stylesheet for why: seven of the register's
        eighteen pieces are between 1.2 and 2.7 pixels wide, and a piece that
        narrow keeps all of its ink when it moves a whole pixel and half of it
        when it moves a fraction of one. So what tells these apart is not how
        far they go -- they all go the same distance -- but how long a piece
        waits, how long it stays where it went, and how many times it does it.

        Nothing here turns and nothing swells. There is no whole-pixel version
        of a rotation, and a scale changes the width, which is the same fault
        under another name. Both belong to the body.  */
    var OPEN = [
        { name: "shiver", ms: 420, weight: 4, scope: "part" },
        { name: "jolt", ms: 300, weight: 4, scope: "part" },
        { name: "slide", ms: 900, weight: 4, scope: "part" },
        { name: "shrug", ms: 620, weight: 3, scope: "part" },
        { name: "drift", ms: 1020, weight: 3, scope: "part" },
        // Runs through every piece in turn, so it lasts the last piece's
        // delay plus its own telling. See --i in the stylesheet.
        { name: "ripple", ms: 790, weight: 2, scope: "mark" }
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

    /*  PUT A MARK BACK TO REST.

        Every gesture in the file is named here, once, and this is the only
        place any of them is taken off. A wiggle holds its target with
        !important, so one left on would win against a story about to start
        and strand that shape half way out of the body; the stories call this
        before they begin, through the hook hung on each mark below.  */
    function quiet(mark) {
        clearTimeout(mark._wiggle);
        delete mark.dataset.stirring;
        var els = [mark];
        Array.prototype.push.apply(els, mark.querySelectorAll("i"));
        els.forEach(function (el) {
            el.classList.remove("wiggle-breathe", "wiggle-twitch", "wiggle-bob",
                "wiggle-settle", "wiggle-rock", "wiggle-shiver", "wiggle-jolt",
                "wiggle-shrug", "wiggle-slide", "wiggle-drift", "wiggle-ripple");
            el.style.removeProperty("--at");
        });
    }

    // Mid-telling: the classes the stories run on are still present and the
    // parts are not sitting at their resting transforms.
    function telling(mark) {
        return mark.classList.contains("anim") && mark.dataset.settled !== "1";
    }

    // Belt to that brace: if anything in the mark is actually running an
    // animation right now, leave it alone. Reading a transform off a part in
    // flight and then holding it for a second and a half is how a shape ends
    // up stranded somewhere it was only passing through.
    function moving(mark) {
        if (!mark.getAnimations) return false;
        var live = mark.getAnimations({ subtree: true });
        for (var i = 0; i < live.length; i++) {
            if (live[i].playState === "running") return true;
        }
        return false;
    }

    function onScreen(mark) {
        var r = mark.getBoundingClientRect();
        return r.bottom > 0 && r.top < window.innerHeight;
    }

    /*  ONE DEVICE PIXEL, AS A LENGTH THE STYLESHEET CAN USE.

        Every open gesture travels in multiples of this and nothing else, which
        is what keeps a piece a pixel and a bit wide from turning to mush the
        moment it moves. Read fresh each time rather than once at startup:
        devicePixelRatio changes when the window is dragged to another screen
        and when the browser is zoomed, and a stale value here would put the
        pieces back on the fractions this exists to avoid.  */
    function pixel() {
        document.documentElement.style.setProperty(
            "--px", (1 / (window.devicePixelRatio || 1)) + "px");
    }

    function gesture(mark) {
        pixel();
        var open = mark.classList.contains("is-open");
        var g = pick(open ? OPEN : GATHERED);
        var target = mark;

        if (g.scope === "part") {
            var parts = mark.querySelectorAll("i");
            target = parts[Math.floor(Math.random() * parts.length)];
            if (!target) return;
        }

        // The transform the target is already holding, so the gesture can be a
        // delta on top of it rather than a jump back to the origin.
        var at = getComputedStyle(target).transform;
        target.style.setProperty("--at", at === "none" ? "translate(0)" : at);

        mark.dataset.stirring = "1";
        target.classList.add("wiggle-" + g.name);
        mark._wiggle = setTimeout(function () {
            quiet(mark);
        }, g.ms + 40);
    }

    /*  A CLICK.

        Answered at once, and answered even if the mark is already fidgeting:
        pressing a thing twice should give two answers, not one answer and a
        shrug. Putting it back to rest first is what makes the second answer
        safe -- a gesture reads its target's transform to build its delta, and
        a target read mid-flight would be handed a matrix it was only passing
        through and left holding it. So the old gesture comes off, the layout
        is read back to make that take effect this frame, and the new one
        starts from rest. It is one frame of less than three degrees; nobody
        has ever seen it.

        A mark mid-telling is the one case that is refused outright. It is
        already moving, which is an answer, and interrupting a story to lay a
        wiggle over it would strand a piece somewhere between the two states.  */
    function poke(mark) {
        if (telling(mark)) return;
        quiet(mark);
        void mark.offsetWidth;
        gesture(mark);
    }

    function stir() {
        var pool = [];
        Array.prototype.forEach.call(marks, function (m) {
            if (telling(m) || moving(m) || m.dataset.stirring) return;
            if (!onScreen(m)) return;
            // Six to one, and drawn rather than ruled: the open mark is the
            // one being read beside and the one whose pieces have room to be
            // seen moving, but a gathered mark still stirs now and again,
            // which is the difference between a register that is alive and a
            // register with one animated element in it.
            pool.push({
                mark: m,
                weight: m.classList.contains("is-open") ? 6 : 1
            });
        });
        if (!pool.length) return;
        gesture(pick(pool).mark);
    }

    Array.prototype.forEach.call(marks, function (m) {
        // The stories are told in marks.js and have to be able to clear a
        // gesture before they start. Hung on the element rather than exported
        // as a global, so the list of gesture names stays in one file and
        // nothing has to be kept in step with it.
        m._quiet = function () { quiet(m); };
        m.addEventListener("click", function () { poke(m); });
    });

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
