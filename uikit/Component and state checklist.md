# Component and state checklist

## Core components

- Navigation/header: desktop links, mobile menu, sticky/transparent variants, active link, dropdown/mega-menu if present.
- Buttons: primary, secondary/ghost, text link, icon button, hover, focus-visible, active, disabled, loading.
- Hero: eyebrow, display heading, body copy, dual CTA, stat row, media panel, responsive stacking.
- Cards: service, portfolio, blog, testimonial, pricing/product; default, hover, featured and empty variants.
- Glass panel: dark, outline, strong, small, large, reduced-motion fallback.
- Forms: text, email, select, textarea, checkbox; focus, validation error, success, disabled and loading.
- Footer: service links, company links, newsletter field, legal links.

## Implementation notes

Use CSS custom properties from `tokens.json` as the source of truth. Keep component styles tokenized and expose variants rather than duplicating raw CSS. Use `prefers-reduced-motion` for animation fallback.
