/*-----------------------------------------------------------------------------
    Unfolds the mark on the Portfolio block while a pointer is on it.

    The mark is the site's own composition -- a dark field, the bright bar with
    its one curve, a yellow block with a stripe of paper and a stripe of red
    under it, and a blue chip at the foot -- folded into a plain dark square
    until somebody reaches for the block.

    WHY THIS IS NOT :hover ALONE. It could be, for the opening. It cannot be
    for the closing: an animation removed when the selector stops matching
    leaves the property to snap back to where it was, and a transition declared
    underneath it does not reliably pick that up. So the state is a class, the
    closing has keyframes of its own, and the two directions are told apart
    properly.

    And a class can be withheld. .anim is only added once the pointer has
    actually arrived, so the folding animation cannot run on load -- which it
    would, since "not open" is also where the page starts.

    HOVER IS A POINTER'S IDEA, NOT A FINGER'S, and the stylesheet already says
    so about the block's green fill: iOS applies :hover to whatever is under a
    touch that is only passing through on its way to scrolling, and leaves it
    applied afterwards. The same test is made here, for the same reason, so a
    scroll that begins on this block does not set a second of theatre running
    under the thumb.
-----------------------------------------------------------------------------*/

(function () {
    "use strict";

    var link = document.querySelector(".doclink--marked");
    if (!link) return;
    var mark = link.querySelector(".doclink-mark");
    if (!mark) return;

    var fine = window.matchMedia
        && window.matchMedia("(hover: hover) and (pointer: fine)");
    if (!fine || !fine.matches) return;

    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    function open(on) {
        if (reduced.matches) return;
        if (mark.classList.contains("is-open") === on) return;
        mark.classList.add("anim");
        mark.classList.toggle("is-open", on);
    }

    link.addEventListener("pointerenter", function () { open(true); });
    link.addEventListener("pointerleave", function () { open(false); });

    // A block reached by keyboard should show what a block reached by pointer
    // shows. It is the same block and the same intent.
    link.addEventListener("focus", function () { open(true); });
    link.addEventListener("blur", function () { open(false); });
})();
