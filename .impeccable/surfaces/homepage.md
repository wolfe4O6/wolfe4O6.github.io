# Homepage

Visitor mode: Experience. This is the user-approved floating photo field implemented on the live personal homepage, with the existing local photo editor retained. The explicit instruction is to implement and publish the approved concept immediately. The conceptual direction and first-view composition are locked by the user's approval; no new selection round is appropriate.

## Direction contract

THESIS: A moving field of William's own photographs occupies the whole viewport and continues around the bio. The name and text stay steady and readable.

OWN-WORLD: Existing sage #edf2e8, evergreen #1b392d, muted #526a58, and focus #294f3d. Georgia name and headings, system sans supporting copy, natural photographic proportions, level edges, small rounded corners. Minimal navigation with soft fading blur, no divider or visible motion toggle.

STORY: See William's name surrounded by his photographs, read the intro, scroll into his interests, inspect any photograph with its caption and optional date, or follow his contact links.

FIRST VIEWPORT: Centered two-line name at roughly 120px desktop; differently sized photographs above, beside, and below. Intro beneath the name. About at top left; GitHub and Email with logos at top right; Browse photos near bottom center. Phone preserves the same visual roles at a smaller scale.

FORM: User-approved, code-led composition. The approved 1440×900 and 390×844 concept captures are outputs/photo-field-desktop.jpg and outputs/photo-field-mobile.jpg in the parent workspace. Preserve their composition rather than inventing a new aesthetic.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

Quality bar: the approved photographs lead the screen at varied sizes; text remains readable; navigation has a legible soft blurred edge while scrolling; all existing captions, dates, and bio work. Keep the established identity while improving motion under the user's explicit request below. Ensure local-editor save/preview and gallery edge cases work. Browser review matrix: desktop and mobile after rapid scroll reversals, scrolled bio, and photo detail. The build, fourteen Python tests, and motion invariant checks must pass before publication.

## Approved motion revision, November 24, 2026

The user reported breakage after fast scrolling, photos stuck gray, overlaps, momentary flashes, and a hard horizontal cutoff. They requested magnetic separation, weaker repulsion from the center text, timed retirement, a continuously populated moving field, a photo-to-center enlargement animation, and a nearly opaque blurred backdrop. This is a precise motion refinement of the existing world, not a new design-selection round.

One authored field uses bounded velocities and fixed substeps; scroll impulses never change lifetime time. Image rectangles separate with a 14px phone / 24px desktop gap. Text pressure is weaker and retains muted translucent photos temporarily. After 3.2s of continuous gray, a photo gets priority to leave when the visibility budget permits; clear photos normally get at least 9s of visible time. Photos exchange only completely outside the viewport, after the next asset is decoded. Keep at least three residents on phones and four on larger screens when the gallery is large enough. Five active photos on phones and seven on desktop keep space for collision avoidance. Existing small/empty galleries remain supported.

The focused image animates from its actual clicked rectangle into the native viewer over 520ms, closes over 280ms, and respects reduced motion. An interrupted enlargement can reverse without jumping. Original gallery metadata stays removed; no source photographs are altered.

Photographic provenance: existing user gallery assets in public/images, copied without modifications or new embedded metadata. src/data/gallery.json records the public image descriptions and captions. No images are generated for this implementation.
