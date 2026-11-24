---
name: William Kearns
description: Personal photographs moving around a steady, readable center.
colors:
  ground: "#edf2e8"
  ink: "#1b392d"
  muted: "#526a58"
  focus: "#294f3d"
typography:
  display:
    fontFamily: "Georgia, serif"
    fontSize: "clamp(4.6rem,8.7vw,8.25rem)"
    fontWeight: 400
    lineHeight: 0.96
    letterSpacing: "-.04em"
  headline:
    fontFamily: "Georgia, serif"
    fontSize: "clamp(2.7rem,4vw,3.8rem)"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "-.03em"
  intro:
    fontFamily: "Georgia, serif"
    fontSize: "clamp(1.2rem,1.7vw,1.5rem)"
    fontWeight: 400
    lineHeight: 1.45
  body:
    fontFamily: "system-ui, sans-serif"
    fontSize: "1rem"
    lineHeight: 1.6
  label:
    fontFamily: "system-ui, sans-serif"
    fontSize: ".95rem"
  caption:
    fontFamily: "Georgia, serif"
    fontSize: "1.4rem"
    fontWeight: 400
    lineHeight: 1.35
rounded:
  photo: "12px"
  photo-mobile: "10px"
  control: "50%"
spacing:
  content-inset: "1.5rem"
  section-gap: "2rem"
  navigation-inset: "2.5rem"
components:
  navigation:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    height: "5rem"
  browse:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    padding: ".5rem 0"
  photo:
    rounded: "{rounded.photo}"
  viewer-control:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    width: "44px"
    height: "44px"
    padding: ".6rem"
  viewer-caption:
    textColor: "{colors.ink}"
    typography: "{typography.caption}"
---

# Design System: William Kearns

## Overview

**Creative North Star: "A field of personal photographs around steady text"**

The sage ground, evergreen ink, large two-line Georgia name, and minimal contact navigation are the established identity. William's photographs supply color and depth; supporting interface elements stay quiet. The approved photo field now carries this identity on the production homepage, continuing around the bio as the visitor scrolls.

This records the user's approved adoption of the existing-world extension as the durable homepage system. The implementation is code-led and follows the locked composition; no new visual selection workflow is required. Route-specific composition and approval live in `.impeccable/surfaces/homepage.md`; product facts remain in `PRODUCT.md`.

**Key Characteristics:**
- Natural photographic proportions and level edges.
- A calm, readable center surrounded by distributed imagery.
- Restrained green interface colors, Georgia expression, and system sans utility text.
- Quiet motion with accessible static and keyboard paths.

## Colors

The palette inherits its green character from the established homepage. Frontmatter is normative for the reusable colors.

### Primary
- **Evergreen Ink:** name, headings, body text, navigation, and viewer controls.

### Neutral
- **Sage Ground:** page canvas, fading navigation ground, and nearly opaque viewer backdrop.
- **Muted Woodland:** dates, counts, and footer text.
- **Deep Focus Green:** keyboard focus outlines.

**The Original Color Rule.** Keep photographs in their own colors; interface palette changes must not recolor the images.

## Typography

**Display Font:** Georgia with serif fallback.
**Body Font:** system-ui with sans-serif fallback.

Georgia carries the name, introduction, about heading, and photo captions. System sans carries supporting prose, navigation, dates, and counts. The desktop hierarchy is captured in frontmatter. About paragraphs scale from 1.05rem to 1.15rem.

At the narrow breakpoint, the name uses `clamp(4.3rem,18vw,6.5rem)` with .97 line height; the intro is 1.18rem, the about heading 2.6rem, and about paragraphs 1.025rem with 1.65 line height. Captions become 1.2rem and navigation labels .9rem. Keep the name in two lines.

## Layout

The fixed photo field fills the viewport behind a normally scrolling page. The hero and about sections each occupy at least `100svh`. The identity column is at most 36rem, the introduction 28rem, and about copy 34rem. Navigation stays fixed above a softly fading blurred ground: About at left, GitHub and Email at right. Browse photos sits near the bottom center of the opening viewport.

At `46rem` and below, the identity narrows to 25rem, intro to 20rem, and about copy to 28rem. Navigation becomes 4.5rem tall with 1.25rem side padding. The motion controller uses five photo slots in two lanes below 700px and seven slots in three lanes at larger widths, limited by gallery size. Natural proportions are retained; viewport-aware dimensions fit within the lanes. Shared upward speed, staggered phases, and lane spacing keep the composition separated. The unscripted fallback retains its portrait height cap of 65svh.

Additional saved photographs rotate through those slots, never accumulate as overlapping layers. Targets of three residents on phones and four on desktop gate gray-photo retirement when the gallery is large enough; they are not guaranteed visible counts as photographs travel through the viewport. Empty galleries hide the field and Browse photos while preserving readable content; a single photo remains inspectable.

## Elevation & Depth

Photographs use a restrained ambient shadow, deepening on hover. Measured overlap with text and interactive reading zones fades and softly blurs the photograph; keep text steady. Navigation fades through a 14px blurred gradient; screen edges fade through 9px blur rather than a hard horizontal cutoff. The native viewer uses a 97% opaque sage backdrop with 22px blur. Exact shadow and motion values live in `.impeccable/design.json`.

**The Steady Center Rule.** Photographs recede around measured reading zones; text does not move to accommodate them.

## Shapes

Photographs have gently rounded corners, reduced on phones; the viewer image keeps the desktop radius. Viewer controls have circular hit areas. Preserve level photo edges and natural proportions without ornamental frames. The navigation has no divider.

## Components

### Navigation and Browse photos

Text links use inline GitHub and Email logos, underline on hover, and at least 44px hit targets. Browse photos is a transparent underlined button and the sequential keyboard entry to the complete gallery. Visible focus uses a 2px focus-green outline with 5px offset; field photographs use 4px offset and sit outside sequential tab order.

### Photo field

A small authored flow moves all photographs upward at a shared speed (23px/s below 700px; 29px/s at larger widths), with sideways sinusoidal sway (`sin(time × .22 + slot × 1.8)`) capped at 18px on phones and 32px on larger screens, further limited by lane width. Lane spacing uses a 14px phone / 24px desktop gap. Photographs retain natural proportions and level edges; shared spacing replaces collision response, wall bounces, and forces between photographs or text. Hover, pointer-down, and focus do not hold individual photographs.

Capped wheel and scroll impulses adjust a shared speed boost: each input is clamped to ±180px, multiplied by .12, and accumulated within −16 to +42px/s. The boost decays exponentially at 2.5/s of active time; upward speed never falls below 7px/s. Native page scrolling continues. Frame deltas are capped at .05 seconds.

Measured overlap with reading zones controls muted, translucent, softly blurred shading without changing a photograph's path. Continuous gray above .5 for more than 3.2 seconds permits retirement only while the number of nonretired visible residents exceeds the target (three phone / four desktop, limited by gallery size). Retirement fades over 1.2 seconds and remains latched until the next cycle; moving clear of text cannot make a retired image reappear. The targets govern this fade, rather than impose a minimum count throughout travel.

Replacement happens only after the old photograph is fully above the viewport with a 48px margin and the next asset is decoded. Update its source, accessible label, dimensions, and aspect ratio there, then re-enter below the viewport with a 48px margin. Every slot preserves its reserved phase while awaiting decoding; a delayed replacement skips a circuit when needed to keep its entry below the screen. Failed loads do not replace a photograph with a broken image. Every saved photo remains directly available in the viewer.

An open viewer pauses the field. Hidden documents cancel the animation loop; resumption resets the frame timestamp. Reduced motion stops continuous movement and automatic rotation, removes CSS transitions and smooth scrolling, retains scroll-responsive shading of a static field, and uses a brief opacity-only viewer transition.

### Photo viewer

Use the native modal dialog, original image proportions, caption, optional date, and live count. Previous/next controls and arrow keys wrap through the full saved gallery; native Escape, Close, or the dialog's outside area close it. Lock body scrolling while open and retain native modal focus behavior. A source-photo FLIP animation enlarges the clicked rectangle into the centered viewer over 520ms; closing returns it over 280ms. Closing during enlargement reverses from its current visual state without jumping. Browse photos opens without a source rectangle. The image is capped at 72svh on desktop and 65svh on phones; dialog width is 90vw up to 74rem, narrowing to 88vw on phones.

### Gallery and local preview maintenance

`src/data/gallery.json` is the sole gallery source; `src/pages/index.astro` owns production markup and styles and inlines the raw `src/scripts/photo-flow.js` and `src/scripts/photo-controller.js` sources. `Manage Photos.command` launches the local editor. Its `tools/photo-editor/library.py` renderer derives preview HTML from the production source and substitutes saved gallery content between the `GALLERY`, `VIEWER_IMAGE`, and `GALLERY_DATA` marker pairs. It embeds the same two raw motion scripts between `PHOTO_MOTION` markers. `src/scripts/photo-physics.js` remains a compatible copy of the flow for older running editor instances; the current production and preview renderers load `photo-flow.js`. Preserve these markers and keep the Python slot allocation synchronized with the Astro frontmatter when changing gallery rendering. Do not create a separate preview design.

The editor continues to manage order, captions, dates, image descriptions, imports, removals, saved preview, and publication. Its row-level Crop action opens a native modal with a dimmed image outside a white selection, a thirds grid, and four corner handles with 44px targets. The selection supports dragging, corner resizing, arrow keys (Shift for ten pixels), aspect-ratio presets, and pixel fields. On narrow screens the ratio fills its own row, pixel fields use two columns, and footer actions wrap. Keep these controls within the editor's existing sage, evergreen, and system-sans utility treatment; they do not change the homepage tokens.

Apply crop updates the working photo; Save changes updates the gallery and saved preview; Publish website makes it live. Crop and Restore original change the image source and dimensions while retaining the identifier, caption, date, and image description. Sanitized first pre-crop images live privately in `.git/photo-editor-originals`, indexed by `.git/photo-editor-crops.json`; restoration requires this local backup and is unavailable in a new clone or on another computer without it. On import, read an editable date from EXIF DateTimeOriginal, DateTimeDigitized, then DateTime before removing descriptive metadata; absent usable metadata, keep it blank. `tools/photo-editor/test_library.py` checks saved-preview, crop/restore, and import-date behavior; `tools/test-photo-field.cjs` checks controller behavior. With scripting disabled, soften field photos, give reading blocks a solid ground, and hide Browse photos.

## Do's and Don'ts

### Do:
- **Do** preserve the sage and evergreen identity, Georgia name, original photo colors, and contact logos.
- **Do** preserve natural photo proportions, five phone / seven desktop slots, shared upward flow with sideways sway, and the retirement-resident gate.
- **Do** maintain visible focus, keyboard browsing, reduced motion, hidden-document suspension, and optional dates.
- **Do** derive the local saved preview from production source and keep gallery edge cases working.

### Don't:
- **Don't** add a navigation divider or a visible pause-photos control.
- **Don't** add embedded metadata to the user's photographs; keep any provenance outside the image files.
- **Don't** substitute a new visual direction for the approved photo field or make text drift with the photographs.
- **Don't** duplicate gallery data, replace visible photographs, or pile additional photos onto occupied field bodies.
