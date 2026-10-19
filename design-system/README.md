# Fender Fit Lab design system

Fender Fit Lab is a static web tool for the owner and technical helpers of a 2013 Camaro RS. It loads a local STL and shows a Three.js sandbox for fitting a replacement passenger fender. The landing page (index.html) opens with the tool's name and a short explanation, then the 3D viewer. Its job is to explain how to rotate, pan, cut and place the fender slice.

This system formalizes the look already in index.html. It adds no new visual choices to the source styles. The one addition is the Hero primary action described under Landing page anatomy.

## Voice

1. State what the model contains and what it does not. Example: "The STL is a printable whole-body shell with supports baked in. It does not contain a true fender part, hole geometry, bracket faces, or fastener hardware." (index.html:470-471)
2. Label guidance as guidance. Example: "The install markers are guidance points, not exact mesh-derived holes." (index.html:471)
3. Describe the tool as an engineering viewer. Example: "an engineering-style viewer: trimmed shell context, edge extraction, a movable fender slice" (index.html:433-434)
4. Name the user's goal in plain words. Example: "...so you can isolate the front corner you actually care about." (index.html:434)
5. Write file names and labels exactly as the code has them. Example: "Asset: `camaro-print-shell-trimmed.stl`" (index.html:438)

## Colour

Tokens are defined on `:root` in index.html (lines 12-28). Contrast ratios are computed on the panel surface (about #fdfdfe, the 0.86 white over the page ground) unless the row says otherwise.

| Token | Value | Role | Contrast |
|---|---|---|---|
| bg | #eef3f6 | Page ground (index.html:12) | text on bg: ratio 12.22 |
| panel | rgba(255, 255, 255, 0.86) | Glass panel surface (index.html:13) | none (surface) |
| panel-strong | rgba(255, 255, 255, 0.98) | Button hover surface (index.html:14) | none (surface) |
| panel-soft | rgba(25, 56, 84, 0.05) | Pill fill (index.html:15) | none (surface) |
| line | rgba(25, 56, 84, 0.12) | Panel hairline (index.html:16) | none (border) |
| line-strong | rgba(25, 56, 84, 0.22) | Button and pill border (index.html:17) | none (border) |
| text | #173042 | Primary text, ink (index.html:18) | ratio 13.43 on panel |
| text-dim | #617688 | Secondary text (index.html:19) | ratio 4.64 on panel; 4.22 on bg, so use on panels only |
| accent | #d96f20 | Orange accent, slider fill (index.html:20) | ratio 3.31 on panel; not for text |
| accent-soft | rgba(217, 111, 32, 0.14) | Active button fill (index.html:21) | none (fill) |
| teal | #1c7880 | Teal highlight, readout emphasis (index.html:22) | ratio 5.10 on panel |
| teal-soft | rgba(28, 120, 128, 0.12) | Active secondary button fill (index.html:23) | none (fill) |
| danger | #b45e56 | Errors and warnings (index.html:24) | ratio 4.42 on panel; not for text |
| danger-soft | rgba(180, 94, 86, 0.12) | Warning fill (index.html:25) | none (fill) |
| accent-ink | #8f4815 | Active orange button text (index.html:242) | ratio 6.65 on panel |
| teal-ink | #165f66 | Active teal button text (index.html:248) | ratio 7.22 on panel |
| danger-ink | #8d4d47 | Warning heading text (index.html:208) | ratio 6.29 on panel |
| readout-ink | #355166 | Monospace readout text (index.html:153); Hero pill text | ratio 8.20 on panel; ratio 7.52 on pill surface (panel-soft over panel, about #f1f3f5) |

Text pairs that pass 4.5:1: text on panel, text on bg, text-dim on panel, teal on panel, the four ink tokens on panel, and the white action text on teal. Two source pairs fail 4.5:1 and are kept exact in formalize mode: text-dim on bg (ratio 4.22) and text-dim on the pill surface (ratio 4.25). The source sets them this way and this system does not change the values.

## Type

Two families. Both come from Google Fonts in one link (index.html:9). Font files are not stored here.

- **sans**: "Space Grotesk", sans-serif. Used for UI text and headings (index.html:44). Weights loaded: 400, 500, 600, 700.
- **mono**: "IBM Plex Mono", monospace. Used for readouts and HUD text (index.html:150). Weights loaded: 400, 500, 600.

Scale (exact values from the code):

| Style | Size | Line height | Tracking | Where used |
|---|---|---|---|---|
| display | 2.45rem max (clamp 1.5rem to 2.45rem) | normal | -0.04em | h1 (index.html:82-85) |
| lead | 0.98rem | 1.55 | none | Hero paragraph (index.html:88-93) |
| body | 0.92rem | 1.55 | none | Step card text (index.html:335-339) |
| step-title | 1rem | normal | none | Step card h3 (index.html:330-332) |
| label | 0.92rem | normal | 0.16em, uppercase | Sidebar h2 (index.html:174-178) |
| pill | 0.82rem | normal | 0.03em | Hero badges, Space Grotesk, text-dim (index.html:103-110) |
| readout | 0.76rem | 1.55 | none | HUD readouts (index.html:150-152) |
| stat-value | 0.94rem | normal | none | Stat values (index.html:298-301) |
| slider-label | 0.84rem | normal | none | Slider labels (index.html:261-267) |
| status | 0.8rem | normal | none | Status line (index.html:388-390) |
| meta | 0.72rem | normal | none | Step meta (index.html:342-348) |

Weight 600 is set on the strong text inside readouts (index.html:160). The h1 has no weight in the code, so the browser default applies.

## Layout and spacing

- Page: body padding 20px, reduced to 12px at 900px and below (index.html:49, 405-407).
- Shell: two columns, minmax(0, 1fr) and 380px, gap 18px (index.html:52-55). Columns stack at 1180px and below (index.html:395-397).
- Hero paragraph max width: 760px (index.html:90).
- Viewer card height: clamp(520px, 66vh, 760px) (index.html:115-116).
- Spacing steps used in the code: 6, 8, 10, 12, 14, 16, 18, 20, 24px (tokens space-6 to space-24).
- Radius steps: 999px (pills and buttons), 12px, 14px, 16px, 18px (tokens radius-pill, radius-sm, radius-xs, radius-md, radius).
- Glass panel: panel fill, 1px line border, radius 18px, shadow, and backdrop blur 14px (index.html:66-72).

## Logo and wordmark

No logo file exists in the repo. The only image asset is a 3D model in assets/models/, which is not a logo. The wordmark is plain type: "Camaro Fender Fit Lab", in the h1 (index.html:430). The page title is the same text (index.html:6).

- Family: Space Grotesk (sans).
- Case: title case, as written.
- Size: the h1 uses clamp(1.5rem, 2.4vw, 2.45rem) (index.html:84).
- Tracking: -0.04em (index.html:85).
- Weight: not set in the code. The browser default for h1 applies.
- Colour: text (#173042).
- Clear space and minimum size: not defined in the source.

Do not redraw this wordmark as an image. Do not add a mark or icon the code does not have.

## Landing page anatomy

1. Hero header panel: h1, paragraph and three badge pills (index.html:428-442). The Hero component shows this block, with one added primary action, "Open the fit viewer", a teal-filled pill button that links to the viewer.
2. Viewer card: a canvas that holds the Three.js scene, with a HUD overlay (index.html:444-457).
3. Stage footer: three cards with the fit notes and upgrade path (index.html:459-483).
4. Sidebar: the control deck, bounds and install zones (index.html:484-546).

The source hero has no primary button or link. The action in the Hero preview is an addition made after review, built from existing tokens (teal, teal-ink, panel-strong, radius-pill, space-10, space-14).

## Status

formalized
