# Techarin UI Kit — AI Design Reference

> Generated from the publicly rendered Techarin HTML template at https://demo.themeshawk.com/html/techarin/index.html. This document describes observed implementation styles; it is not the original authoring design system.

## Usage for AI agents

Use this file as a visual and implementation reference. Preserve the dark, high-contrast creative-agency direction, use the token values in `tokens.json`, and prefer existing component patterns over inventing unrelated styles. When generating new UI, keep responsive behavior explicit and validate at desktop, tablet, and mobile widths. Treat copied images, logos, fonts, text, and code as third-party material requiring appropriate rights for production use.

## Visual direction

The template presents a premium AI/digital-agency aesthetic: deep navy and near-black surfaces, electric blue accents, white typography, rounded glass panels, luminous gradients, network/technology imagery, large editorial hero headlines, and motion-led interactions. The visual hierarchy relies on oversized display headings, compact uppercase labels, bold CTA buttons, stat blocks, card grids, and generous dark negative space.

## Token reference

### Colors

| Token | Observed value |
|---|---|
| `--accent-color` | `#0010b9` |
| `--secondary-color` | `` |
| `--dark-color` | `#2D2D2D` |
| `--white-color` | `#FFFFFF` |
| `--grey-color` | `#777777` |
| `--body-text-color` | `#333333` |
| `--light-text-color` | `#929292` |
| `--link-color` | `#0010b9` |
| `--background-color` | `#FAFAFA` |
| `--bs-dark-rgb` | `80, 80, 80` |
| `--bs-body-color-rgb` | `53, 53, 53` |
| `--bs-primary-rgb` | `0, 16, 185` |
| `--bs-secondary-rgb` | `249, 246, 243` |
| `--color-accent-rgb` | `0, 45, 204` |
| `--card-glow` | `rgba(0, 41, 200, 0.25)` |
| `--loader-bg` | `#0b1220` |
| `--loader-accent` | `var(--accent-color)` |
| `--loader-fg` | `#ffffff` |
| `--glass-bg` | `rgba(255, 255, 255, 0.35)` |
| `--glass-bg-dark` | `rgba(16, 18, 20, 0.35)` |
| `--glass-border-dark` | `rgba(0, 0, 0, 0.28)` |
| `--active-text` | `:before` |
| `--glass-color` | `rgba(var(--color-background, 255,255,255), 0.22)` |
| `--rim-color` | `rgba(255,255,255, 0.45)` |
| `--swiper-theme-color` | `#007aff` |
| `--swiper-preloader-color` | `#fff` |
| `--color-red-300` | `oklch(80.8% 0.114 19.571)` |
| `--color-red-500` | `oklch(63.7% 0.237 25.331)` |
| `--color-orange-300` | `oklch(83.7% 0.128 66.29)` |
| `--color-orange-500` | `oklch(70.5% 0.213 47.604)` |
| `--color-amber-400` | `oklch(82.8% 0.189 84.429)` |
| `--color-yellow-300` | `oklch(90.5% 0.182 98.111)` |
| `--color-yellow-500` | `oklch(79.5% 0.184 86.047)` |
| `--color-lime-300` | `oklch(89.7% 0.196 126.665)` |
| `--color-lime-500` | `oklch(76.8% 0.233 130.85)` |
| `--color-emerald-300` | `oklch(84.5% 0.143 164.978)` |
| `--color-emerald-400` | `oklch(76.5% 0.177 163.223)` |
| `--color-emerald-500` | `oklch(69.6% 0.17 162.48)` |
| `--color-cyan-300` | `oklch(86.5% 0.127 207.078)` |
| `--color-cyan-500` | `oklch(71.5% 0.143 215.221)` |
| `--color-blue-300` | `oklch(80.9% 0.105 251.813)` |
| `--color-blue-500` | `oklch(62.3% 0.214 259.815)` |
| `--color-indigo-400` | `oklch(67.3% 0.182 276.935)` |
| `--color-indigo-500` | `oklch(58.5% 0.233 277.117)` |
| `--color-indigo-600` | `oklch(51.1% 0.262 276.966)` |
| `--color-purple-300` | `oklch(82.7% 0.119 306.383)` |
| `--color-purple-500` | `oklch(62.7% 0.265 303.9)` |
| `--color-fuchsia-300` | `oklch(83.3% 0.145 321.434)` |
| `--color-fuchsia-500` | `oklch(66.7% 0.295 322.15)` |
| `--color-pink-300` | `oklch(82.3% 0.12 346.018)` |
| `--color-pink-500` | `oklch(65.6% 0.241 354.308)` |
| `--color-slate-50` | `oklch(98.4% 0.003 247.858)` |
| `--color-slate-100` | `oklch(96.8% 0.007 247.896)` |
| `--color-slate-200` | `oklch(92.9% 0.013 255.508)` |
| `--color-slate-300` | `oklch(86.9% 0.022 252.894)` |
| `--color-slate-400` | `oklch(70.4% 0.04 256.788)` |
| `--color-slate-500` | `oklch(55.4% 0.046 257.417)` |
| `--color-slate-600` | `oklch(44.6% 0.043 257.281)` |
| `--color-slate-700` | `oklch(37.2% 0.044 257.287)` |
| `--color-slate-800` | `oklch(27.9% 0.041 260.031)` |
| `--color-slate-900` | `oklch(20.8% 0.042 265.755)` |
| `--color-slate-950` | `oklch(12.9% 0.042 264.695)` |
| `--color-gray-800` | `oklch(27.8% 0.033 256.848)` |
| `--color-black` | `#000` |
| `--color-white` | `#fff` |
| `--text-xs` | `0.75rem` |
| `--text-xs--line-height` | `calc(1 / 0.75)` |
| `--text-sm` | `0.875rem` |
| `--text-sm--line-height` | `calc(1.25 / 0.875)` |
| `--text-base` | `1rem` |
| `--text-base--line-height` | `calc(1.5 / 1)` |
| `--text-lg` | `1.125rem` |
| `--text-lg--line-height` | `calc(1.75 / 1.125)` |
| `--text-xl` | `1.25rem` |
| `--text-xl--line-height` | `calc(1.75 / 1.25)` |
| `--text-2xl` | `1.5rem` |
| `--text-2xl--line-height` | `calc(2 / 1.5)` |
| `--text-3xl` | `1.875rem` |
| `--text-3xl--line-height` | `calc(2.25 / 1.875)` |
| `--text-4xl` | `2.25rem` |
| `--text-4xl--line-height` | `calc(2.5 / 2.25)` |
| `--text-5xl` | `3rem` |
| `--text-5xl--line-height` | `1` |
| `--text-6xl` | `3.75rem` |
| `--text-6xl--line-height` | `1` |
| `--text-9xl` | `8rem` |
| `--text-9xl--line-height` | `1` |
| `--tw-shadow-color` | `color-mix(in srgb, oklch(20.8% 0.042 265.755) 70%, transparent)` |
| `--tw-ring-color` | `var(--color-indigo-500)` |
| `--tw-ring-offset-color` | `var(--color-slate-950)` |
| `--tw-inset-shadow-color` | `initial` |
| `--tw-inset-ring-color` | `initial` |
| `--tw-drop-shadow-color` | `initial` |
| `--tw-shadow-colored` | `0 0 #0000` |
| `--tw-bg-opacity` | `1` |
| `--tw-text-opacity` | `1` |

### Radii

| Token | Observed value |
|---|---|
| `--nf-radius-xl` | `1.25rem` |
| `--nf-radius-2xl` | `1.75rem` |
| `--glass-radius` | `14px` |
| `--radius-lg` | `0.5rem` |
| `--radius-xl` | `0.75rem` |
| `--radius-2xl` | `1rem` |
| `--radius-3xl` | `1.5rem` |

### Effects and glass

| Token | Observed value |
|---|---|
| `--animate-duration` | `1s` |
| `--fade-duration` | `450ms` |
| `--glass-border` | `rgba(255, 255, 255, 0.28)` |
| `--glass-blur` | `10px` |
| `--glass-blur-4` | `4px` |
| `--glass-saturate` | `120%` |
| `--glass-contrast` | `95%` |
| `--glass-padding` | `1rem` |
| `--glass-shadow` | `0 6px 20px rgba(13, 14, 18, 0.16)` |
| `--glass-transition` | `240ms cubic-bezier(.2, .9, .2, 1)` |
| `--inner-shadow` | `rgba(0,0,0,0.18)` |
| `--glass-rim` | `rgba(255,255,255, 0.32)` |
| `--blur-sm` | `8px` |
| `--blur-lg` | `16px` |
| `--blur-xl` | `24px` |
| `--blur-3xl` | `64px` |
| `--default-transition-duration` | `150ms` |
| `--default-transition-timing-function` | `cubic-bezier(0.4, 0, 0.2, 1)` |
| `--tw-shadow` | `0 1px 3px 0 var(--tw-shadow-color, rgb(0 0 0 / 0.1)), 0 1px 2px -1px var(--tw-shadow-color, rgb(0 0 0 / 0.1))` |
| `--tw-ring-shadow` | `var(--tw-ring-inset,) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)` |
| `--tw-blur` | `blur(8px)` |
| `--tw-backdrop-blur` | `blur(8px)` |
| `--tw-duration` | `200ms` |
| `--tw-ring-offset-shadow` | `var(--tw-ring-inset,) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color)` |
| `--tw-shadow-alpha` | `100%` |
| `--tw-inset-shadow` | `0 0 #0000` |
| `--tw-inset-shadow-alpha` | `100%` |
| `--tw-inset-ring-shadow` | `0 0 #0000` |
| `--tw-contrast` | `initial` |
| `--tw-saturate` | `initial` |
| `--tw-drop-shadow` | `initial` |
| `--tw-drop-shadow-alpha` | `100%` |
| `--tw-drop-shadow-size` | `initial` |
| `--tw-backdrop-contrast` | `initial` |
| `--tw-backdrop-saturate` | `initial` |

### Other CSS variables

| Token | Observed value |
|---|---|
| `--animate-delay` | `1s` |
| `--animate-repeat` | `1` |
| `--active` | `#fff` |
| `--border` | `rgba(255, 255, 255, 0.25)` |
| `--bs-gray-100` | `#EAE5DD` |
| `--bs-gray-300` | `#DCDCDC` |
| `--cursor-scale` | `1` |
| `--bubble-compensate` | `1` |
| `--swiper-navigation-size` | `44px` |
| `--font-sans` | `ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji",
      "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"` |
| `--font-mono` | `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
      "Courier New", monospace` |
| `--spacing` | `0.25rem` |
| `--container-xs` | `20rem` |
| `--container-sm` | `24rem` |
| `--container-md` | `28rem` |
| `--container-xl` | `36rem` |
| `--container-2xl` | `42rem` |
| `--container-3xl` | `48rem` |
| `--container-4xl` | `56rem` |
| `--container-5xl` | `64rem` |
| `--container-6xl` | `72rem` |
| `--font-weight-light` | `300` |
| `--font-weight-normal` | `400` |
| `--font-weight-medium` | `500` |
| `--font-weight-semibold` | `600` |
| `--font-weight-bold` | `700` |
| `--font-weight-extrabold` | `800` |
| `--tracking-tight` | `-0.025em` |
| `--tracking-wide` | `0.025em` |
| `--tracking-wider` | `0.05em` |
| `--tracking-widest` | `0.1em` |
| `--leading-tight` | `1.25` |
| `--leading-relaxed` | `1.625` |
| `--ease-in` | `cubic-bezier(0.4, 0, 1, 1)` |
| `--ease-out` | `cubic-bezier(0, 0, 0.2, 1)` |
| `--ease-in-out` | `cubic-bezier(0.4, 0, 0.2, 1)` |
| `--default-font-family` | `var(--font-sans)` |
| `--default-mono-font-family` | `var(--font-mono)` |
| `--tw-translate-x` | `calc(calc(1/2 * 100%) * -1)` |
| `--tw-translate-y` | `calc(calc(1/2 * 100%) * -1)` |
| `--tw-scale-x` | `100%` |
| `--tw-scale-y` | `100%` |
| `--tw-scale-z` | `100%` |
| `--tw-space-y-reverse` | `0` |
| `--tw-space-x-reverse` | `0` |
| `--tw-gradient-position` | `to right in oklab` |
| `--tw-gradient-from` | `color-mix(in srgb, #000 30%, transparent)` |
| `--tw-gradient-stops` | `var(--tw-gradient-via-stops, var(--tw-gradient-position), var(--tw-gradient-from) var(--tw-gradient-from-position), var(--tw-gradient-to) var(--tw-gradient-to-position))` |
| `--tw-gradient-via` | `color-mix(in srgb, oklch(44.6% 0.043 257.281) 60%, transparent)` |
| `--tw-gradient-via-stops` | `var(--tw-gradient-position), var(--tw-gradient-from) var(--tw-gradient-from-position), var(--tw-gradient-via) var(--tw-gradient-via-position), var(--tw-gradient-to) var(--tw-gradient-to-position)` |
| `--tw-gradient-to` | `transparent` |
| `--tw-leading` | `1` |
| `--tw-font-weight` | `var(--font-weight-bold)` |
| `--tw-tracking` | `0.2em` |
| `--tw-ease` | `var(--ease-in)` |
| `--tw-outline-style` | `none` |
| `--tw-ring-offset-width` | `2px` |
| `--tw-translate-z` | `0` |
| `--tw-rotate-x` | `initial` |
| `--tw-rotate-y` | `initial` |
| `--tw-rotate-z` | `initial` |
| `--tw-skew-x` | `initial` |
| `--tw-skew-y` | `initial` |
| `--tw-border-style` | `solid` |
| `--tw-gradient-from-position` | `0%` |
| `--tw-gradient-via-position` | `50%` |
| `--tw-gradient-to-position` | `100%` |
| `--tw-ring-inset` | `initial` |
| `--tw-brightness` | `initial` |
| `--tw-grayscale` | `initial` |
| `--tw-hue-rotate` | `initial` |
| `--tw-invert` | `initial` |
| `--tw-opacity` | `initial` |
| `--tw-sepia` | `initial` |
| `--tw-backdrop-brightness` | `initial` |
| `--tw-backdrop-grayscale` | `initial` |
| `--tw-backdrop-hue-rotate` | `initial` |
| `--tw-backdrop-invert` | `initial` |
| `--tw-backdrop-opacity` | `initial` |
| `--tw-backdrop-sepia` | `initial` |
| `--tw-border-spacing-x` | `0` |
| `--tw-border-spacing-y` | `0` |
| `--tw-rotate` | `0` |
| `--tw-pan-x` | `` |
| `--tw-pan-y` | `` |
| `--tw-pinch-zoom` | `` |
| `--tw-scroll-snap-strictness` | `proximity` |
| `--tw-ordinal` | `` |
| `--tw-slashed-zero` | `` |
| `--tw-numeric-figure` | `` |
| `--tw-numeric-spacing` | `` |
| `--tw-numeric-fraction` | `` |
| `--tw-contain-size` | `` |
| `--tw-contain-layout` | `` |
| `--tw-contain-paint` | `` |
| `--tw-contain-style` | `` |
| `--tw-content` | `''` |
| `--tw-border-opacity` | `1` |
| `--tw-ring-opacity` | `1` |

### Observed literal colors

| Color | Occurrences |
|---|---:|
| `#fff` | 36 |
| `#0000` | 36 |
| `#2098D1` | 28 |
| `#e1e1e1` | 22 |
| `#000` | 10 |
| `#0f172a` | 7 |
| `#000eb8` | 5 |
| `#0060fd` | 5 |
| `#ffffff` | 4 |
| `#aaa` | 4 |
| `#ccc` | 4 |
| `#f8fafc` | 3 |
| `#334155` | 2 |
| `#475569` | 2 |
| `#0010b9` | 2 |
| `#FFFFFF` | 2 |
| `#020617` | 2 |
| `#052bce` | 2 |
| `#fff0` | 2 |
| `#080808` | 2 |
| `#C6C6C6` | 2 |
| `#64748b` | 1 |
| `#94a3b8` | 1 |
| `#2D2D2D` | 1 |
| `#777777` | 1 |
| `#333333` | 1 |
| `#929292` | 1 |
| `#FAFAFA` | 1 |
| `#EAE5DD` | 1 |
| `#DCDCDC` | 1 |

### Typography

The stylesheet explicitly references `Outfit` and `Space Grotesk`; the public Google Fonts CSS and seven downloaded font files are included under `site/assets/fonts/google/`. The primary visual pattern is a large geometric display face for hero/section headings paired with compact readable body text.

## Component inventory

| Component family | Observed implementation cues |
|---|---|
| **Navigation** | Header navigation with Home, Services, Portfolio, Team, Blog, Features, Contact and Start a Project CTA. |
| **Hero** | Large multi-line heading, supporting paragraph, primary/secondary CTA, metric/stat row, dark technology background and image panel. |
| **Buttons** | Rounded pill CTAs; blue gradient primary treatment; ghost/glass treatment; hover shadow and motion. |
| **Cards** | Service, portfolio, blog and testimonial cards; image-led layouts with hover transitions and glow overlays. |
| **Glass panels** | Translucent panels with backdrop blur, translucent borders, dark/light variants, radius and shadow tokens. |
| **Forms** | Contact/project inquiry form with name, email, budget select, message, NDA checkbox and submit button. |
| **Content sections** | Section eyebrow/label, large title, supporting copy, grids and CTA blocks. |
| **Motion** | Float, rotation, pulse, wiggle, magnetic cursor/button, preloader, hover image distortion and reduced-motion fallback. |
| **Footer** | Footer navigation, newsletter signup, legal links and service links. |

## Page inventory

| File | Title | H1–H3 headings | Forms | Images |
|---|---|---|---:|---:|
| `404.html` | 404 - Techarin — AI Startup Agency HTML Template | 404; Page not found | 1 | 2 |
| `about.html` | About Us - Techarin — AI Startup Agency HTML Template | About Us.; We're a small team of designers, strategists, and engineers building digital brands that last.; How we work; People behind Techarin | 1 | 8 |
| `blog-single.html` | Designing for clarity: simple patterns that scale - Techarin | Designing for clarity: simple patterns that scale; Designing for clarity: simple patterns that scale; Start with hierarchy; Make decisions explicit | 1 | 16 |
| `blog.html` | Blog - Techarin — AI Startup Agency HTML Template | Blogs; From the studio; Designing AI interfaces users can trust; From prompt to production AI | 1 | 26 |
| `cart.html` | Cart - Techarin — AI Startup Agency HTML Template | Your Cart; Spicy Pepperoni Blaze; Order Summary; Related products | 1 | 11 |
| `checkout.html` | Portfolio v2 - Techarin — AI Startup Agency HTML Template | Checkout; Delivery Details; Payment; Order Summary | 2 | 2 |
| `contact.html` | Portfolio v2 - Techarin — AI Startup Agency HTML Template | Contact Us; Tell us about the product, brand, or idea you're ready to launch. | 2 | 2 |
| `faq.html` | FAQ - Techarin — AI Startup Agency HTML Template | FAQ; How can we help you?; Getting Started; Design System | 1 | 2 |
| `home-hero-image.html` | Techarin — AI Startup Agency HTML Template | We craft bold digital experiences for ambitious brands.; Strategy, design, and development for brave brands.; Brand Strategy & Identity; Web & Product Design | 2 | 27 |
| `home-light.html` | Techarin — AI Startup Agency HTML Template | We craft bold digital experiences for ambitious brands.; Strategy, design, and development for brave brands.; Brand Strategy & Identity; Web & Product Design | 2 | 29 |
| `home-rtl.html` | Techarin — AI Startup Agency HTML Template | We craft bold digital experiences for ambitious brands.; Strategy, design, and development for brave brands.; Brand Strategy & Identity; Web & Product Design | 2 | 29 |
| `home-single.html` | Techarin — AI Startup Agency HTML Template | We craft bold digital experiences for ambitious brands.; Strategy, design, and development for brave brands.; Brand Strategy & Identity; Web & Product Design | 2 | 29 |
| `home-slider.html` | Techarin — AI Startup Agency HTML Template | Turning intelligence into real-world impact through AI.; We design and deploy AI-powered products that scale with your business.; We merge artificial intelligence with creativity to build what’s next.; Strategy, design, and development for brave brands. | 2 | 30 |
| `home-video.html` | Techarin — AI Startup Agency HTML Template | We craft bold digital experiences for ambitious brands.; Strategy, design, and development for brave brands.; Brand Strategy & Identity; Web & Product Design | 2 | 27 |
| `image-gallery-advanced.html` | Image Gallery Advanced - Techarin — AI Startup Agency HTML Template | Image Gallery Advanced; Project Visuals | 1 | 9 |
| `image-gallery.html` | Portfolio v2 - Techarin — AI Startup Agency HTML Template | Gallery; Project Image Gallery | 1 | 14 |
| `index.html` | Techarin — AI Startup Agency HTML Template | We craft bold digital experiences for ambitious brands.; Strategy, design, and development for brave brands.; Brand Strategy & Identity; Web & Product Design | 2 | 29 |
| `newsletter.html` | Newsletter - Techarin — AI Startup Agency HTML Template | Newsletter.; Subscribe to our newsletter | 2 | 2 |
| `portfolio-single.html` | Portfolio v2 - Techarin — AI Startup Agency HTML Template | Lumen Analytics — Dashboard & Onboarding; Lumen Analytics — Dashboard & Onboarding; Challenge; Outcome | 1 | 10 |
| `portfolio-v2.html` | Portfolio v2 - Techarin — AI Startup Agency HTML Template | Selected projects and collaborations.; AI Softwares; Face Reading; Bio Metric | 1 | 10 |
| `portfolio.html` | Service Single - Techarin — AI Startup Agency HTML Template | Selected projects and collaborations.; Selected projects and collaborations.; Signal Cloud; Northwind | 1 | 10 |
| `pricing.html` | Pricing - Techarin — AI Startup Agency HTML Template | Pricing.; Choose the plan that fits your needs; Starter; Pro | 1 | 2 |
| `privacy-policy.html` | Privacy Policy - Techarin — AI Startup Agency HTML Template | Privacy Policy; Information We Collect; How We Use Your Information; Cookies & Tracking Technologies | 1 | 2 |
| `product.html` | From Prompt to Production AI - Techarin — AI Startup Agency HTML Template | From Prompt to Production AI; Related products; AI Analytics Dashboard; AI Chatbot System | 1 | 13 |
| `service-single.html` | Service Single - Techarin — AI Startup Agency HTML Template | Brand Strategy & Identity; Brand Strategy & Identity; Overview; Deliverables | 1 | 4 |
| `services.html` | Services - Techarin — AI Startup Agency HTML Template | Services; Strategy, design, and development for brave brands.; Brand Strategy & Identity; Web & Product Design | 1 | 2 |
| `shop.html` | Portfolio v2 - Techarin — AI Startup Agency HTML Template | Our Products; AI Analytics Dashboard; AI Chatbot System; Predictive AI Engine | 1 | 26 |
| `team-single.html` | Alex Morgan - Techarin — AI Startup Agency HTML Template | Alex Morgan; Alex Morgan; Selected Work; AI Softwares | 1 | 12 |
| `team-v2.html` | Team - Techarin — AI Startup Agency HTML Template | People behind Techarin; People behind Techarin; Maria Rosa; Jassika | 1 | 8 |
| `team.html` | Team - Techarin — AI Startup Agency HTML Template | People behind Techarin; People behind Techarin; Alex Morgan; Jamie Lee | 1 | 8 |
| `terms.html` | Terms and Conditions - Techarin — AI Startup Agency HTML Template | Terms & Conditions; Acceptance of Terms; Use of Services; Intellectual Property | 1 | 2 |
| `testimonial.html` | Testimonials - Techarin — AI Startup Agency HTML Template | Testimonials; What our clients say | 1 | 8 |

## AI generation rules

1. Use semantic roles such as `accent`, `surface`, `text`, `muted`, `border`, `success`, `warning`, and `danger`; do not scatter raw hex values when a token can be used.
2. Default to a dark navy/black background, white primary text, muted gray secondary text, and electric blue accent gradients.
3. Use rounded containers and glass effects selectively for panels, navigation, hero overlays, and featured cards. Avoid applying blur to every element.
4. Keep CTA labels short and action-oriented. Use a filled blue primary CTA plus a transparent/outlined secondary CTA.
5. Preserve generous spacing and responsive behavior. Test at 375px, 768px, 1024px, and 1440px widths.
6. Include hover, focus, active, disabled, loading, empty, and error states for interactive components. Respect `prefers-reduced-motion`.
7. Reuse component families across pages: buttons, cards, stat blocks, section headers, form fields, nav, footer, testimonial and portfolio modules.
8. Do not assume that an observed page is the complete design system; label inferred values as inferred and observed values as observed.

## Files in this package

- `site/` — captured public HTML pages and linked local resources.
- `tokens.json` — extracted CSS custom properties, observed colors, fonts and asset statistics.
- `DESIGN.md` — this AI-oriented design reference.
- `components.md` — compact component/state checklist.
- `page-inventory.json` — page-level metadata.
- `capture-manifest.txt` — file inventory and sizes.

## Provenance and rights

Source URL: https://demo.themeshawk.com/html/techarin/index.html. The archive contains publicly accessible template material fetched for research and UI analysis. Before using it in a product, confirm the template license and rights for code, assets, fonts, icons, images, text, and brand elements. Do not represent this extracted material as an original design system or as permission to redistribute the vendor’s template.
