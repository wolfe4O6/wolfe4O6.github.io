# Homepage

Visitor mode: Experience. This is the user-approved floating photo field implemented on the live personal homepage, with the existing local photo editor retained. The explicit instruction is to implement and publish the approved concept immediately. The conceptual direction and first-view composition are locked by the user's approval; no new selection round is appropriate.

## Direction contract

THESIS: A moving field of William's own photographs occupies the whole viewport and continues around the bio. The name and text stay steady and readable.

OWN-WORLD: Existing sage #edf2e8, evergreen #1b392d, muted #526a58, and focus #294f3d. Georgia name and headings, system sans supporting copy, natural photographic proportions, level edges, small rounded corners. Minimal opaque navigation, no divider or visible motion toggle.

STORY: See William's name surrounded by his photographs, read the intro, scroll into his interests, inspect any photograph with its caption and optional date, or follow his contact links.

FIRST VIEWPORT: Centered two-line name at roughly 120px desktop; differently sized photographs above, beside, and below. Intro beneath the name. About at top left; GitHub and Email with logos at top right; Browse photos near bottom center. Phone preserves the same visual roles at a smaller scale.

FORM: User-approved, code-led composition. The approved 1440×900 and 390×844 concept captures are outputs/photo-field-desktop.jpg and outputs/photo-field-mobile.jpg in the parent workspace. Preserve their composition rather than inventing a new aesthetic.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

Quality bar: the approved photographs lead the screen at varied sizes; text remains readable; navigation is opaque and clean while scrolling; all existing captions, dates, and bio work. Match the approved desktop/mobile layout, then ensure local-editor save/preview and gallery edge cases work. Additional photos enter one at a time in the existing slots rather than piling onto the composition. Browser review matrix: desktop and mobile first view, scrolled bio, and photo detail. The build, fourteen Python tests, and controller interaction checks must pass before publication.

Photographic provenance: existing user gallery assets in public/images, copied without modifications or new embedded metadata. src/data/gallery.json records the public image descriptions and captions. No images are generated for this implementation.
