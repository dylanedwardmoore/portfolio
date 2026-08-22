/*-----------------------------------------------------------------------------
    The life of a block's mark, from the green it comes out of to the rule it
    goes back into.

    At rest there is no mark: no width beside the word, no ink. Reaching for a
    block starts a whole sequence, and leaving does not interrupt it.

        emerge   a dark square condenses out of the green the block has just
                 filled with, arriving very wide and very flat and drawing
                 itself in -- mass pulled out of the field
        tell     the mark's own storyboard, whichever of the three it is
        fold     back into the square
        spin     once, all the way round
        puddle   it flattens, falls to the foot of the block, spreads, and
                 turns from the dark green into the bright one
        thicken  and the rule takes its mass back

    THE RULE IS THINNER THE WHOLE TIME. The ink is conserved: a block whose
    mark is out has lent it, and the rule under the word is lighter for it
    until the puddle comes home.

    AN OPEN TELLING IS NEVER CUT SHORT. If the pointer leaves while the mark is
    still emerging or still telling, the close is QUEUED for the moment the
    telling ends rather than run over the top of it. A gesture stopped half way
    is worse than no gesture, and a pointer that has already moved on is not
    watching what it interrupted.

    Coming back mid-close is the one thing that does interrupt: that is a
    person asking for it again, and answering at once is the only polite reply.

    Timed rather than driven by animationend. Six elements each finish at their
    own moment and the phase is over when the LAST of them does, so the
    interesting event is not any one animation ending -- and a missed event on
    a backgrounded tab would stick the whole machine. A clock cannot stick.
-----------------------------------------------------------------------------*/

(function () {
    "use strict";

    var links = document.querySelectorAll(".doclink--marked");
    if (!links.length) return;

    var fine = window.matchMedia
        && window.matchMedia("(hover: hover) and (pointer: fine)");
    if (!fine || !fine.matches) return;

    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    // How long each mark's telling runs, measured from the end of the emerge.
    // These are the storyboards in the stylesheet; if one is re-timed there it
    // has to be re-timed here, which is the price of not waiting on events.
    var TELLING = {
        "doclink-mark--name": 1340,
        "doclink-mark--stack": 1040,
        "doclink-mark--line": 1310
    };
    var EMERGE = 300;
    var FOLD = 470;
    var SPIN = 360;
    var PUDDLE = 460;

    function kind(mark) {
        for (var k in TELLING) {
            if (mark.classList.contains(k)) return k;
        }
        return "doclink-mark--name";
    }

    function setup(link) {
        var mark = link.querySelector(".doclink-mark");
        if (!mark) return;

        var telling = TELLING[kind(mark)];
        var timers = [];
        var state = "idle";
        var want = false;

        function clear() {
            timers.forEach(clearTimeout);
            timers = [];
        }

        function at(ms, fn) {
            timers.push(setTimeout(fn, ms));
        }

        function phase(name) {
            mark.classList.remove("is-emerging", "is-spinning", "is-puddling");
            if (name) mark.classList.add(name);
        }

        function rest() {
            state = "idle";
            clear();
            phase(null);
            mark.classList.remove("is-live", "is-open", "anim");
            link.classList.remove("mark-live");
            // The rule takes its mass back as the puddle lands.
        }

        function shut() {
            state = "closing";
            clear();
            phase(null);
            mark.classList.add("anim");
            mark.classList.remove("is-open");     // fold
            at(FOLD, function () {
                phase("is-spinning");
                at(SPIN, function () {
                    phase("is-puddling");
                    // Hand the mass back while the puddle is still falling, so
                    // the rule is thickening as the ink arrives rather than
                    // after it.
                    at(PUDDLE * 0.55, function () {
                        link.classList.remove("mark-live");
                    });
                    at(PUDDLE, rest);
                });
            });
        }

        function begin() {
            // Coming back part way through the close, the square is still on
            // the page -- so it does not condense out of the field a second
            // time. It is already out. Only a mark starting from nothing gets
            // the emerge.
            var already = mark.classList.contains("is-live");
            state = "opening";
            clear();
            mark.classList.add("is-live", "anim");
            link.classList.add("mark-live");
            phase(already ? null : "is-emerging");

            at(already ? 0 : EMERGE, function () {
                phase(null);
                mark.classList.add("is-open");
                at(telling, function () {
                    state = "open";
                    if (!want) shut();
                });
            });
        }

        link.addEventListener("pointerenter", function () {
            if (reduced.matches) return;
            want = true;
            // Coming back part way through the close is a fresh ask.
            if (state === "idle" || state === "closing") begin();
        });

        link.addEventListener("pointerleave", function () {
            if (reduced.matches) return;
            want = false;
            // Only if the telling has actually finished. Otherwise the timer
            // set in begin() will find want false and close then.
            if (state === "open") shut();
        });

        // A block reached by keyboard should show what a block reached by
        // pointer shows. It is the same block and the same intent.
        link.addEventListener("focus", function () {
            if (reduced.matches) return;
            want = true;
            if (state === "idle" || state === "closing") begin();
        });

        link.addEventListener("blur", function () {
            if (reduced.matches) return;
            want = false;
            if (state === "open") shut();
        });
    }

    Array.prototype.forEach.call(links, setup);
})();
