# Homepage

Visitor mode: Experience. This is the user-approved floating photo field implemented on the live personal homepage, with the existing local photo editor retained. The explicit instruction is to implement and publish the approved concept immediately. The conceptual direction and first-view composition are locked by the user's approval; no new selection round is appropriate.

## Direction contract

THESIS: A moving field of William's own photographs occupies the whole viewport and continues around the bio. The name and text stay steady and readable.

OWN-WORLD: Existing sage #edf2e8, evergreen #1b392d, muted #526a58, and focus #294f3d. Georgia name and headings, system sans supporting copy, natural photographic proportions, level edges, small rounded corners. Minimal navigation with soft fading blur, no divider or visible motion toggle.

STORY: See William's name surrounded by his photographs, read the intro, scroll into his interests, inspect any photograph with its caption and optional date, or follow his contact links.

FIRST VIEWPORT: Centered two-line name at roughly 120px desktop; differently sized photographs above, beside, and below. Intro beneath the name. About at top left; GitHub and Email with logos at top right; Browse photos near bottom center. Phone preserves the same visual roles at a smaller scale.

FORM: User-approved, code-led composition. The approved 1440×900 and 390×844 concept captures are outputs/photo-field-desktop.jpg and outputs/photo-field-mobile.jpg in the parent workspace. Preserve their composition rather than inventing a new aesthetic.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

Quality bar: the approved photographs lead the screen at varied sizes; text remains readable; navigation has a legible soft blurred edge while scrolling; all existing captions, dates, and bio work. Keep the established identity while improving motion under the user's explicit request below. Ensure local-editor save/preview and gallery edge cases work. Browser review matrix: desktop and mobile after rapid scroll reversals, scrolled bio, and photo detail. The build, nineteen Python tests, and motion invariant checks must pass before publication.

## Approved upward flow replacement, November 24, 2026

The user's latest instruction explicitly replaces the magnetic physics simulator: all photographs move upward, with sideways sway. This supersedes the earlier request for magnetic separation and weaker text repulsion while retaining the established visual identity, readable center, soft edges, and photo viewer. No new design-selection round is appropriate.

The flow uses five slots in two lanes below 700px and seven slots in three lanes at larger widths, limited by gallery size. Natural proportions fit within the lanes. All photographs share an upward speed (23px/s phone; 29px/s desktop) and sideways sine sway (`sin(time × .22 + slot × 1.8)`, capped at 18px / 32px and 7.5% of lane width). Staggered phases and shared spacing replace collisions, wall bounces, and photo/text forces. Hover, pointer-down, and focus do not hold individual photographs. Wheel and scroll keep native scrolling and adjust a shared boost (input ±180px × .12, boost −16 to +42px/s, exponential decay 2.5/s); upward speed remains at least 7px/s.

Measured text overlap still mutes and softly blurs photographs. Gray above .5 continuously for more than 3.2 seconds permits a 1.2-second retirement fade only when nonretired visible residents exceed the target of three on phones / four on larger screens, capped by gallery size. These targets gate retirement; they do not promise that many visible photographs throughout each cycle. Retirement stays latched until recycling, so a faded photograph cannot reappear by moving clear of text. There is no nine-second clear-photo lifetime gate.

Photos exchange only when the old photograph is completely above the viewport with a 48px margin and the next asset is decoded. Each replacement enters below the bottom with a 48px margin. Reserved phases keep advancing during delayed loading; a late replacement skips a circuit if necessary to remain below the viewport. Small and empty galleries remain supported. The open viewer, hidden document, and reduced-motion preference retain their motion gates.

The focused image animates from its actual clicked rectangle into the native viewer over 520ms, closes over 280ms, and respects reduced motion. An interrupted enlargement can reverse without jumping. Original gallery metadata stays removed; no source photographs are altered. Production and the current saved-preview renderer load `photo-flow.js` with `photo-controller.js`; `photo-physics.js` remains a compatible flow copy for older running editors.

The scoped finish review returned **ship** with no material motion issues. Validation passed the production build, nineteen Python tests, and 64,800 simulation frames across six viewports. The field stayed populated in all six tests; observed minimum visible counts were one at 320×568, two at 390px and 494px phone widths, and three on desktop. These results describe observed coverage rather than a strict visible-count guarantee. Reviewed screenshots in the parent workspace are `outputs/upward-photos-desktop.jpg`, `outputs/upward-photos-desktop-about.jpg`, `outputs/upward-photos-desktop-detail.jpg`, `outputs/upward-photos-mobile.jpg`, `outputs/upward-photos-mobile-about.jpg`, and `outputs/upward-photos-mobile-detail.jpg`.

Photographic provenance: existing user gallery assets in public/images, copied without modifications or new embedded metadata. src/data/gallery.json records the public image descriptions and captions. No images are generated for this implementation.
