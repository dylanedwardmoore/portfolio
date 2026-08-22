/**
 * The screens every view is checked against.
 *
 * WHY THESE. The stylesheets branch on width at 768, 860, 1080 and 1180, and
 * -- unusually -- on HEIGHT as well, at 460, 520, 620, 700, 760 and 900, plus
 * an orientation query for short landscape screens. A matrix of a few popular
 * phones would exercise almost none of that. So there are two lists:
 *
 *   DEVICES     real screens people actually arrive on, named, so a failure
 *               says "iPhone SE" rather than "375x667"
 *   BOUNDARIES  one pixel either side of every breakpoint in the sheets,
 *               because that is where a layout rule either applies or does
 *               not and where off-by-one mistakes live
 *
 * Both are run against every page. That is the expensive part of the suite and
 * it is the part worth paying for: nearly every layout bug this site has had
 * was a bug at one size only.
 */

/** Real devices, portrait unless the name says otherwise. */
export const DEVICES = [
    { name: "iPhone SE (1st)", width: 320, height: 568, phone: true },
    { name: "Galaxy S8", width: 360, height: 740, phone: true },
    { name: "iPhone SE (2nd/3rd)", width: 375, height: 667, phone: true },
    { name: "iPhone 12/13/14", width: 390, height: 844, phone: true },
    { name: "Pixel 7", width: 412, height: 915, phone: true },
    { name: "iPhone 15 Pro Max", width: 430, height: 932, phone: true },
    { name: "iPhone 12 landscape", width: 844, height: 390, phone: true, landscape: true },
    { name: "iPhone SE landscape", width: 667, height: 375, phone: true, landscape: true },
    { name: "iPad mini", width: 768, height: 1024 },
    { name: "iPad Air", width: 820, height: 1180 },
    { name: "iPad Pro 11", width: 834, height: 1194 },
    { name: "iPad landscape", width: 1024, height: 768, landscape: true },
    { name: "laptop 1280", width: 1280, height: 800 },
    { name: "laptop 1440", width: 1440, height: 900 },
    { name: "desktop 1920", width: 1920, height: 1080 },
    { name: "desktop 2560", width: 2560, height: 1440 },
];

/** Every width breakpoint in the sheets, probed on both sides. */
const WIDTH_EDGES = [767, 768, 859, 860, 1079, 1080, 1179, 1180];
/** Every height breakpoint, probed at a width where the query can apply. */
const HEIGHT_EDGES = [459, 460, 519, 520, 619, 620, 699, 700, 759, 760, 899, 900];

export const BOUNDARIES = [
    ...WIDTH_EDGES.map(w => ({ name: `width ${w}`, width: w, height: 900 })),
    ...HEIGHT_EDGES.map(h => ({ name: `height ${h}`, width: 1000, height: h })),
    // The short-landscape query is width-agnostic, so it needs its own probes.
    { name: "short landscape", width: 900, height: 440 },
    { name: "very short", width: 1200, height: 400 },
];

export const ALL = [...DEVICES, ...BOUNDARIES];

/** A compact set for tests too slow to run against everything. */
export const REPRESENTATIVE = [
    DEVICES[3],                    // iPhone 12, the common phone
    DEVICES[6],                    // phone landscape, the short-screen rules
    DEVICES[8],                    // iPad mini, exactly on the 768 edge
    DEVICES[13],                   // 1440 laptop
    DEVICES[15],                   // 2560 desktop
];
