# Mobile Visual Lessons

This checkpoint preserves the product and design lessons from the Phase 6
mobile visual iterations, especially the Phase 6.5 onboarding and Progress/Home
reset. Read this before starting future mobile UI phases.

This document is design guidance, not an API, schema, or architecture contract.
`AGENTS.md`, API docs, schema docs, and shared contracts remain authoritative
for engineering boundaries.

## Product Direction

The product identity is:

```text
Simple tracking, serious insight.
```

Food Tracker should feel like clean nutrition software combined with personal
analytics and lifestyle wellness. The app should be soft but serious, calm,
premium, minimal, and professional enough to feel market-ready.

Native iPhone testing is the source of truth for mobile UI quality. Desktop web
preview is useful for fast iteration, but it cannot approve spacing, safe
areas, touch behavior, keyboard movement, fixed CTAs, launcher icon behavior,
or the overall feel of the app on a phone.

Avoid:

- student-project polish
- generic wellness templates
- Cronometer, Lifesum, or Apple Health card-spam visuals
- green primary CTAs
- copying Cal AI visually
- treating old Phase 6.1 primitives as final brand authority

## Surface And Card Lessons

Heavy card-based UI is not the default visual language for this app.

Repeated bordered cards usually make Food Tracker feel generic and weaken the
product identity. The best Phase 6 improvements came when onboarding moved
away from stacked bordered cards and toward open, native-feeling layouts.

Prefer:

- spacing
- typography
- hierarchy
- soft sections
- purposeful modules
- rails and pills
- separators and selected bands
- clear full-screen composition

Use cards only when they have a clear job. Do not fix weak UI by only changing
radius, shadows, or colors on the same card stack. Avoid stacked white cards
with borders as the main visual language.

## What Worked

- Reduced-card and less-bordered onboarding.
- Large, confident typography.
- Calm neutral/off-white canvas.
- Black or charcoal primary CTA.
- Actual simple and complex PNG brand icons instead of drawn View logos.
- Dynamic launcher icon switching between Simple and Complex/Detailed mode.
- Progress/Home daily energy hero direction.
- Wheel inputs for birthday, height, current weight, and target weight.
- Height wheel with ft/in and cm support.
- Shared wheel primitive with faster momentum and snap correction.
- Segmented scale selector geometry where the rail does not run through the
  markers.
- Standalone informational onboarding slides instead of cluttering data-entry
  slides.
- Focused data-entry slides: question, input/control, quiet support, CTA.
- User-facing copy that avoids internal implementation language.
- Tappable Progress/Home mode badge synced through existing tracking
  preferences.
- Native-build-aware app icon config and alternate icon setup.
- Preserved reference library in `docs/design-references/phase-6-5/`.

## What Failed

- Heavy bordered cards everywhere.
- Generic rounded white card stacks.
- Reusing the same surface treatment for every component.
- Decorative motifs that did not create real identity.
- Fake custom graphics built quickly from fragile React Native View geometry.
- Technical-looking charts or pseudo-graphs in onboarding.
- Adding informational modules inside existing data-entry slides.
- User-facing copy with internal terms such as baseline, deterministic, trend
  context, payload, setup data, stored value, target calculation, or
  implementation mechanics.
- Using Cal AI as aesthetic direction instead of structural inspiration.
- Overusing green or making green the primary CTA direction.
- Reintroducing Cronometer/Lifesum-style nutrition app visuals.
- Treating desktop web preview as enough for mobile design decisions.
- Assuming launcher icon changes apply without rebuilding the development
  build.
- Committing generated native folders.

## Reference Guidance

Stoic is the strongest mood and style reference:

- calm neutral canvas
- confident black typography
- minimal chrome
- restrained icons
- purposeful modules
- premium wellness feeling

Cal AI is useful for:

- onboarding structure
- wheel picker inspiration
- recommendation and payoff flow
- nutrition-specific setup ideas

Do not copy Cal AI's exact visual style. Green health references are useful for
picker and health setup interaction ideas, not green CTA styling. Lifesum and
Cronometer references are mostly examples of what not to copy visually.

## Onboarding Rules

Data-entry slides should stay focused:

1. question
2. input/control
3. quiet support text
4. CTA

Informational slides should be standalone, rare, and useful. Do not add extra
explanation blocks inside data-entry slides. Avoid bloating onboarding with too
many explanation screens.

Wheel inputs are preferred for constrained numeric choices when they reduce
typing friction. Birthday, height, and weight wheels must preserve visible
selection, submitted values, snap behavior, and state sync. A nicer-looking
wheel is not acceptable if birthday, age, or submitted `birthDate` can
desynchronize.

The review or starting-plan screen should feel like a payoff, not a technical
summary. It should show what the app gives the user and reassure them that the
plan can be adjusted later.

Onboarding copy should speak to a normal user. Explain benefits and next
actions. Do not describe implementation details.

Avoid phrases like:

- baseline
- deterministic
- trend context
- payload
- setup data
- stored value
- target calculation
- tracking mode does not affect target calculation

## Progress-Direction Slide Rule

The progress-direction onboarding slide should stay text-first unless a real
designed asset is available and tested on native iPhone.

Do not build complex onboarding illustrations from fragile React Native View
geometry. If a custom graphic looks broken, prefer a clean text-first info
slide over a bad pseudo-graph.

Future real illustrations should be custom assets or properly designed
SVG/image assets, not rushed View-block graphics.

## History And Logging Lessons

Phase 6.6 History improved most when it stopped trying to solve the screen with
more cards and started behaving like a daily ledger.

What worked:

- pure white canvas with strong charcoal/black typography
- a 7-day visual rail instead of a plain centered date selector
- calorie donut rings around each day, with dotted rings for empty days
- selected day and today states that remain obvious but calm
- open meal groups with ledger rows, separators, and no large card wrappers
- calorie, protein, macro, and weight markers that improve scanning
- small controlled color accents inside a Stoic-led base
- crisp icons from `lucide-react-native`, used for meaning rather than
  decoration
- reliable `react-native-svg` rings instead of fragile View-built arc geometry
- user-facing copy in logging screens instead of storage or timezone mechanics

What did not work:

- solving History with stacked cards, generic modules, or rounded white boxes
- wrapping every meal group in a bordered container
- making the screen look like a database list or admin form
- off-white/beige surfaces when the desired direction is pure white and
  charcoal
- washing out the interface with too much grey or muted text
- removing too much icon color until the screen feels flat and text-only
- using color everywhere without hierarchy or restraint
- fake charts, pseudo-graphs, or fragile View-built graphics

The correct balance is Stoic-led first: pure white, charcoal/black, calm,
premium, crisp typography, and open layout. Add small Cal AI-like energy only
where it helps the user scan: calorie rings, macro rails, colored icons, and
tiny progress markers. The app should not become a colorful dashboard, but it
also should not become grey, lifeless, or text-only.

History should use a 7-day rail when browsing daily logs. Each day can show
calorie progress against the existing target. Empty days should use dotted
rings, not fake progress. Ring colors are accents only and should rotate
tastefully so adjacent days do not feel repetitive. Today can use a subtle
marker, but it needs enough spacing to feel intentional.

Food and weight entries should read as an open daily ledger. Meal groups should
usually be headings plus rows and separators, not cards inside cards. Cards or
modules are allowed only when they have a specific job.

## Branding And Icon Rules

Use actual provided PNG brand assets. Do not redraw or recreate the logo with
React Native View shapes.

- Simple mode icon is the default and new-user identity.
- Complex/Detailed mode icon is for complex mode identity.
- In-app mode badges should use the real icons and feel intentionally tappable.
- Dynamic launcher icon switching is native config/plugin-dependent.
- Launcher icon and native config changes require rebuilding/reinstalling the
  Expo development build to validate.
- Saved tracking preference and in-app mode badge should remain synced.

## Native Testing Lessons

- Native iPhone screenshots override desktop web assumptions.
- Expo development builds are the real testing path; Expo Go is not the target
  for this workflow.
- Metro is enough for JS/UI-only changes, but not for app icon or native config
  changes.
- Native-backed visual dependencies such as `react-native-svg` require a new
  Expo development build before judging the result on iPhone. Metro alone is
  not enough after adding native dependencies.
- If generated iOS assets are stale, a clean prebuild can regenerate ignored
  native output.
- `apps/mobile/ios/` and `apps/mobile/android/` are generated local folders and
  must remain ignored/uncommitted unless explicitly approved.
- Physical iPhone API access uses the Mac LAN IP, not `localhost`.
- Phone and Mac must be mutually reachable on the same network.

## Workflow Lessons

- Test big visual changes on iPhone before committing or pushing.
- Push checkpoints before risky visual fixes.
- Do not merge a branch with known native blockers.
- Preserve product/design decisions in docs after long iteration cycles.
- Before each new mobile visual phase, read this document, `docs/design-system.md`,
  `docs/mobile-ui-and-device-testing-context.md`, and the relevant reference
  folder.
