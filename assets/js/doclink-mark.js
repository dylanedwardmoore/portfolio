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
    var EMERGE = 640;
    var FOLD = 560;
    var SPIN = 640;
    var PUDDLE = 700;
    var GREEN = 520;
    var FALL = 1000;

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
            mark.classList.remove("is-emerging", "is-spinning", "is-puddling",
                "is-greening", "is-falling");
            if (name) mark.classList.add(name);
        }

        /* EACH PIECE BREATHES AS SOON AS IT LANDS.

           The whole mark used to wait for the last piece before any of it
           stirred, which meant about 1.7 seconds of holding still -- a 400ms
           entrance and a telling of 1.3 -- before anything happened. Almost
           nobody holds a pointer on a link that long, so the held state was
           real, correct, and never once seen.

           A piece is done when its own animation ends, and animationend says
           so exactly. One listener each, taken off as it fires.

           With a backstop on the timer, because animationend is the one signal
           here that can simply not arrive -- a piece whose animation never
           started has nothing to end. By the time the telling is over every
           piece is breathing whether it reported in or not, so the listener
           only ever buys time; it cannot lose the state. */
        function letThemBreathe() {
            Array.prototype.forEach.call(mark.querySelectorAll("i"),
                function (part) {
                    var on = function (e) {
                        if (e.target !== part) return;
                        part.removeEventListener("animationend", on);
                        // Only if the mark is still open by the time it lands.
                        if (mark.classList.contains("is-open")) {
                            part.classList.add("breathes");
                        }
                    };
                    part.addEventListener("animationend", on);
                });
        }

        function breatheAll() {
            if (!mark.classList.contains("is-open")) return;
            Array.prototype.forEach.call(mark.querySelectorAll("i"),
                function (part) { part.classList.add("breathes"); });
        }

        function stopBreathing() {
            Array.prototype.forEach.call(mark.querySelectorAll("i"),
                function (part) { part.classList.remove("breathes"); });
        }

        /* WHERE THE FLOOR IS.

           Measured, never guessed. It was worked out from the block's padding
           before and the answer was short -- the pieces stopped in mid air
           with a strip of paper still under them, which is the one thing a
           fall must not do.

           The rule sits on the bottom edge of the block and is --rule-control
           deep at its full weight, so its top edge is the floor. Every piece
           is told the distance from ITS OWN foot down to that line, which is
           different for each of them: a bar high in the tile has further to go
           than one low in it, and giving them all the same number is what
           makes a group of things look like a lift rather than a fall. */
        function findFloor() {
            var deep = parseFloat(getComputedStyle(link)
                .getPropertyValue("--rule-control")) || 6;
            /* INTO THE RULE, NOT ONTO IT.
               The first version aimed at the top edge of the rule at its full
               weight -- but the rule is thin the whole time the mark is out,
               two pixels of the six, so its ink was four pixels BELOW where
               everything was landing and the pieces dissolved in clear white
               with the bar under them. Aim at the middle of the full rule
               instead: whatever thickness it has got back to by the time the
               ink arrives, the ink is inside it. */
            var floor = link.getBoundingClientRect().bottom - deep * 0.45;
            Array.prototype.forEach.call(mark.querySelectorAll("i"),
                function (part) {
                    var r = part.getBoundingClientRect();
                    if (!r.height) return;
                    part.style.setProperty("--fall",
                        (floor - r.bottom).toFixed(2) + "px");
                });
            var m = mark.getBoundingClientRect();
            mark.style.setProperty("--drop", (floor - m.bottom).toFixed(2) + "px");
        }

        function rest() {
            state = "idle";
            clear();
            phase(null);
            mark.classList.remove("is-live", "is-open", "anim");
            stopBreathing();
            Array.prototype.forEach.call(mark.querySelectorAll("i"),
                function (part) { part.style.removeProperty("--fall"); });
            mark.style.removeProperty("--drop");
            link.classList.remove("mark-live");
            // The rule takes its mass back as the puddle lands.
        }

        /* Hand the mass back while the ink is still on its way down, so the
           rule is thickening as it arrives rather than after it. */
        function giveBack(inMs, doneMs) {
            // Early enough that the rule is already fattening while the ink is
            // still falling. A bar that thickens after everything has landed
            // has been handed nothing; it has just got bigger on its own.
            at(inMs, function () { link.classList.remove("mark-live"); });
            at(doneMs, rest);
        }

        function shut() {
            state = "closing";
            clear();
            stopBreathing();
            findFloor();
            mark.classList.add("anim");

            if (mark.classList.contains("doclink-mark--name")) {
                // Each piece for itself, from where it stands.
                phase("is-falling");
                giveBack(FALL * 0.34, FALL);
                return;
            }

            if (mark.classList.contains("doclink-mark--stack")) {
                // Green first, while they are still stacked, so what falls is
                // four sticks of one stuff rather than four coloured bars.
                phase("is-greening");
                at(GREEN, function () {
                    phase("is-falling");
                    giveBack(FALL * 0.34, FALL);
                });
                return;
            }

            // One thing, so it goes as one thing: fold, turn, and fall whole.
            phase(null);
            mark.classList.remove("is-open");
            at(FOLD, function () {
                phase("is-spinning");
                at(SPIN, function () {
                    phase("is-puddling");
                    giveBack(PUDDLE * 0.3, PUDDLE);
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
                letThemBreathe();
                at(telling, function () {
                    state = "open";
                    // Backstop: anything that never reported in is breathing
                    // by now regardless. See letThemBreathe.
                    breatheAll();
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
