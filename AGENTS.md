# Repository instructions

## UI kit

The `uikit/` directory is the visual source of truth for interface work in this repository. The current kit is the Techarin dark-glass direction: deep slate backgrounds (`slate-950`/`slate-900`), restrained slate text, violet brand accents, cyan secondary accents, translucent borders, rounded surfaces, backdrop blur, and soft shadows. Reuse these principles for browser-extension surfaces rather than introducing unrelated bright or flat styles.

For `browser-extension`, the UI kit applies to the status/notification bar, status badges and their navigation controls, the popup surface, and the floating text-selection panel. Keep behavior and API contracts unchanged when making visual-only changes. Any functional change must also update the README for the affected part of the project.

## Change hygiene

Do not commit or push changes unless the user explicitly authorizes it. Before handing work back, run the relevant tests/build checks and report the working-tree status.
