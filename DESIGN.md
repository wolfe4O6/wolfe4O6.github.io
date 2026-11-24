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
    backgroundColor: "{colors.ground}"
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
- **Sage Ground:** page canvas and opaque navigation; also the basis of the translucent viewer backdrop.
- **Muted Woodland:** dates, counts, and footer text.
- **Deep Focus Green:** keyboard focus outlines.

**The Original Color Rule.** Keep photographs in their own colors; interface palette changes must not recolor the images.

## Typography

**Display Font:** Georgia with serif fallback.
**Body Font:** system-ui with sans-serif fallback.

Georgia carries the name, introduction, about heading, and photo captions. System sans carries supporting prose, navigation, dates, and counts. The desktop hierarchy is captured in frontmatter. About paragraphs scale from 1.05rem to 1.15rem.

At the narrow breakpoint, the name uses `clamp(4.3rem,18vw,6.5rem)` with .97 line height; the intro is 1.18rem, the about heading 2.6rem, and about paragraphs 1.025rem with 1.65 line height. Captions become 1.2rem and navigation labels .9rem. Keep the name in two lines.

## Layout

The fixed photo field fills the viewport behind a normally scrolling page. The hero and about sections each occupy at least `100svh`. The identity column is at most 36rem, the introduction 28rem, and about copy 34rem. An opaque navigation bar stays fixed above the field: About at left, GitHub and Email at right. Browse photos sits near the bottom center of the opening viewport.

At `46rem` and below, the identity narrows to 25rem, intro to 20rem, and about copy to 28rem. Navigation becomes 4.5rem tall with 1.25rem side padding. Seven viewport-relative photo positions preserve imagery at the edges and space around the reading center. Field photo width is capped by `65svh × aspect ratio`, so portraits cannot grow taller than 65svh; images retain their proportions.

Use at most seven field slots, never one overlapping layer per saved photo. For fewer photos, use the source's deliberate slot allocation: three photos occupy slots 2, 3, and 5; other small galleries take from 2, 3, 1, 4, 5, 6. With seven or more, use slots 0–6. Galleries larger than seven rotate additional images through existing slots one at a time. Empty galleries hide the field and Browse photos while preserving readable content; a single photo remains inspectable.

## Elevation & Depth

Photographs use a restrained ambient shadow, deepening on hover. Measured overlap with text and interactive reading zones fades and softly blurs the photograph; keep text steady. The native viewer has a translucent sage backdrop with 14px blur. Exact shadow and motion values live in `.impeccable/design.json`.

**The Steady Center Rule.** Photographs recede around measured reading zones; text does not move to accommodate them.

## Shapes

Photographs have gently rounded corners, reduced on phones; the viewer image keeps the desktop radius. Viewer controls have circular hit areas. Preserve level photo edges and natural proportions without ornamental frames. The navigation has no divider.

## Components

### Navigation and Browse photos

Text links use inline GitHub and Email logos, underline on hover, and at least 44px hit targets. Browse photos is a transparent underlined button and the sequential keyboard entry to the complete gallery. Visible focus uses a 2px focus-green outline with 5px offset; field photographs use 4px offset and sit outside sequential tab order.

### Photo field

Desktop imagery drifts upward at independent speeds with slight lateral oscillation. Wheel input changes drift velocity while native page scrolling continues. Phone movement stays bounded. Hover inspection, visible photo focus, and an open viewer pause the field. Hidden documents stop the animation loop. Reduced motion stops continuous movement and automatic rotation, removes transitions and smooth scrolling, and retains a scroll-responsive static field.

For extra photos, preload the next image, fade out one slot for .35 seconds, update its source, accessible label, dimensions and aspect ratio, then fade in for .35 seconds. Schedule the next replacement after 14 seconds of active animation time. Failed loads leave the existing photograph intact. Every saved photo remains directly available in the viewer, including with reduced motion enabled.

### Photo viewer

Use the native modal dialog, original image proportions, caption, optional date, and live count. Previous/next controls and arrow keys wrap through the full saved gallery; native Escape, Close, or the dialog's outside area close it. Lock body scrolling while open and retain native modal focus behavior. The image is capped at 72svh on desktop and 65svh on phones; dialog width is 90vw up to 74rem, narrowing to 88vw on phones.

### Gallery and local preview maintenance

`src/data/gallery.json` is the sole gallery source; `src/pages/index.astro` owns production markup, styles, and the shared controller. `Manage Photos.command` launches the local editor. Its `tools/photo-editor/library.py` renderer derives preview HTML from the production source and substitutes saved gallery content between the `GALLERY`, `VIEWER_IMAGE`, and `GALLERY_DATA` marker pairs. Preserve these markers and keep the Python slot allocation synchronized with the Astro frontmatter when changing gallery rendering. Do not create a separate preview design.

The editor continues to manage order, captions, dates, image descriptions, imports, removals, saved preview, and publication. `tools/photo-editor/test_library.py` checks saved-preview behavior and `tools/test-photo-field.cjs` checks controller behavior. With scripting disabled, soften field photos, give reading blocks a solid ground, and hide Browse photos.

## Do's and Don'ts

### Do:
- **Do** preserve the sage and evergreen identity, Georgia name, original photo colors, and contact logos.
- **Do** preserve natural photo proportions, the portrait height cap, and the seven-slot limit.
- **Do** maintain visible focus, keyboard browsing, reduced motion, hidden-document suspension, and optional dates.
- **Do** derive the local saved preview from production source and keep gallery edge cases working.

### Don't:
- **Don't** add a navigation divider or a visible pause-photos control.
- **Don't** add embedded metadata to the user's photographs; keep any provenance outside the image files.
- **Don't** substitute a new visual direction for the approved photo field or make text drift with the photographs.
- **Don't** duplicate gallery data or pile additional photos onto occupied field slots.
