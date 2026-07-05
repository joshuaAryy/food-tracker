# Mobile Design System

## Direction

The mobile product visual identity is summarized as "Simple tracking, serious
insight." Phase 6 established the shared mobile visual standard across
onboarding, Progress, History, logging, Insights, Recommendations,
Profile/Settings, bottom navigation, the floating add action, mode identity,
logo rendering, inputs, and native iPhone testing.

Stoic is the strongest mood/style reference: whitespace, confident black
typography, calm pacing, restrained icons, minimal chrome, and focused daily
state. Cal AI is useful for nutrition-specific density and small accent
moments, but it should not be copied visually. Apple Health/Fitness is useful
for glanceable progress patterns, not for default card stacks.

The interface must feel:

- calm, premium, and serious
- information-dense only where the data requires it
- white-forward, charcoal-led, neutral, and professional rather than highly
  saturated
- native to a small phone rather than adapted from a desktop dashboard

Avoid generic SaaS layouts, Apple Health-style stacked cards as a default
answer, generic nutrition dashboards, purple or blue gradients, beige/yellow
dominance, washed-out grey UI, green-heavy action systems, random
screen-specific colors, playful food illustrations, childish illustration
styles, random blobs, fake View-built graphics, rushed giant-ring experiments,
and excessive card nesting. Do not copy Lifesum/Cronometer-style visuals.

Design references and explicit user feedback override old visual assumptions.
The Phase 6 reference set lives in `docs/design-references/phase-6-5/`. For
native device-testing priorities, see
`docs/mobile-ui-and-device-testing-context.md`. For the product and visual
lessons learned during Phase 6 iteration, read
`docs/mobile-visual-lessons.md` before starting a new mobile UI phase.

Future features should extend this system instead of replacing it: white
canvas, charcoal typography, open sections, rows/dividers, restrained accents,
crisp icons, user-facing copy, and native iPhone validation before commit.

## Theme Tokens

Light mode is the implemented default. Dark-mode tokens are defined for future
use, but theme switching is not part of this phase.

### Light

| Role | Token | Value |
| --- | --- | --- |
| App background | `canvas` | `#F2F2F0` |
| Standard surface | `surface` | `#F7F7F4` |
| Raised surface | `surfaceRaised` | `#FFFFFF` |
| Product module | `module` | `#FFFFFF` |
| Muted module | `moduleMuted` | `#ECECEA` |
| Primary text | `ink` | `#111111` |
| Secondary text | `muted` | `#7C7C78` |
| Tertiary text | `subtle` | `#A6A6A1` |
| Border | `border` | `#DEDEDA` |
| Line | `line` | `#D4D4CF` |
| Primary action | `primary` | `#141414` |
| Primary action dark | `primaryDark` | `#050505` |
| Primary action soft | `primarySoft` | `#E7E7E3` |
| Legacy sage | `sage` | `#7A9B76` |
| Legacy sage dark | `sageDark` | `#506D4F` |
| Legacy sage soft | `sageSoft` | `#DDE7D8` |
| Water | `water` | `#7895A6` |
| Water soft | `waterSoft` | `#DCE8ED` |
| Carbs | `carbs` | `#B59A5B` |
| Carbs soft | `carbsSoft` | `#EFE4C8` |
| Fat | `fat` | `#A87962` |
| Fat soft | `fatSoft` | `#E9D8CF` |
| Error | `error` | `#A45E54` |
| Error surface | `errorSoft` | `#F1DDD7` |

### Dark, prepared only

| Role | Value |
| --- | --- |
| App background | `#1B2028` |
| Standard surface | `#252B34` |
| Raised surface | `#2B323C` |
| Primary text | `#F2EEE6` |
| Secondary text | `#AEB5BE` |
| Border | `#3A424D` |
| Primary accent | `#91AF8B` |

Colors are centralized in `apps/mobile/src/theme/tokens.ts` and mirrored in
the NativeWind theme.

NativeWind uses semantic class aliases for the same roles. Notable aliases:
`bg-primary`, `bg-primary-soft`, `bg-sage-soft`, `bg-water-soft`,
`bg-gold-soft`, `bg-clay-soft`, and `bg-error-soft`.

Onboarding mirrors the shared neutral presentation tokens so setup and
Progress/Home feel like one product:

| Role | Token | Value |
| --- | --- | --- |
| Onboarding canvas | `onboardingCanvas` | `#F2F2F0` |
| Onboarding surface | `onboardingSurface` | `#FFFFFF` |
| Onboarding muted surface | `onboardingSurfaceMuted` | `#ECECEA` |
| Onboarding text | `onboardingText` | `#111111` |
| Onboarding muted text | `onboardingMuted` | `#7C7C78` |
| Onboarding line | `onboardingLine` | `#D4D4CF` |
| Onboarding accent | `onboardingAccent` | `#111111` |
| Onboarding accent soft | `onboardingAccentSoft` | `#ECECEA` |

## Typography

Use the iOS system font stack. Prefer the rounded system feeling where the
platform provides it; do not bundle a custom font for the foundation phase.

Hierarchy:

- Hero: 52px bold for the most important daily number
- Display: 42px bold for prominent data values
- Title: 32px bold for screen names and key onboarding questions
- Heading: 22px bold for modules and section titles
- Body: 16px regular with 24px line height
- Label: 14px semibold for controls and important metadata
- Caption: 12px medium for dates, units, and secondary labels

Nutrition and weight values use tabular numerals where supported. Units and
descriptive labels must remain visually secondary to the number.

## Spacing

Base spacing scale:

- 4px: tight internal alignment
- 8px: label-to-value and compact control spacing
- 12px: related controls and card groups
- 16px: standard card padding and section internals
- 24px: screen section spacing
- 32px: major content separation

Screens use 16px horizontal gutters and a tighter 20px section rhythm.
Maintain comfortable bottom padding so content is not obscured by the tab bar
or logging wheel.

## Responsive App Shell

The product remains mobile-first on every platform.

- Phone: content uses the full available width.
- Tablet and web preview: the navigation shell is centered and capped at
  `520px`.
- Primary scroll content is centered and capped at `480px`.
- Cards, forms, and tab navigation must not expand into desktop-dashboard
  proportions.
- The surrounding browser viewport uses the app canvas color rather than
  introducing a separate desktop layout.

## Radius And Borders

- Inputs and buttons: 14px
- Product modules: 32px
- Cards: 30px
- Pills and circular controls: fully rounded
- Borders: rare and purposeful. Prefer spacing, soft fills, selected bands, and
  typography before adding visible outlines.

Shadows are minimal and reserved for raised hero cards and the floating action
button. Surface contrast should do most of the separation work.

## Cards

`AppCard` is a legacy reusable surface primitive, not the default Phase 6.5
visual language. New onboarding and Progress/Home surfaces should prefer
open layouts, purpose-built modules, rows, dividers, pills, and rails.

- Use a raised surface only when the card has a clear job.
- Prefer one clear purpose per card.
- Avoid wrapping every text block in a card.
- Use dividers for repeated rows inside a shared card.
- Use color as a small accent, not a full saturated background.
- Do not solve new screens with default `AppCard` or `AppModule` stacks.

`StatCard` is for one numeric fact with a label and optional context.

`AppModule` remains available for soft modules with clear purpose, but it is
not the default answer for future screens. If a screen starts to look like a
stack of modules, redesign the hierarchy around native sections and rows.

## Shared Layout And Data Primitives

Use shared primitives when they fit the desired experience. Do not preserve a
weak screen just because a shared primitive already exists.

- `AppSection`: standard section heading, optional description/action, and
  consistent section spacing.
- `SelectableOption`: accessible card or pill option for onboarding and
  settings-style choices.
- `SummaryRow`: label/value row for review and confirmation screens.
- `MetricRow`: compact label/value row for analytics and nutrient summaries.
- `DataNotice`: quiet informational, warning, success, and danger notices for
  data-quality, connectivity, and validation context.

These components are intentionally small. They standardize recurring structure
without turning screens into a rigid component framework.

## Onboarding Composition

The first-run onboarding flow is allowed to rewrite or replace existing Phase
6.1 onboarding primitives. It should feel like a premium guided setup
experience, not a profile form. The birthday/date-of-birth picker is the
highest-priority visual reset and must clearly replace typed Month/Day/Year
boxes.

- `OnboardingShell`: wraps onboarding content with a native-first full-screen
  distribution: compact progress and back affordance near the top, a dedicated
  interaction zone in the middle, quiet support copy near the lower screen, and
  a stable bottom CTA area.
- `OnboardingProgress`: shows a slim progress bar plus a soft label such as
  `Setup · Profile`, `Birthday`, or `Setup · Review`. Do not expose large
  `Step X of Y` language in the UI.
- `OnboardingQuestion`: presents direct question copy and optional helper copy
  inside the top/question zone so each step feels like one decision instead of
  a settings page.
- `OnboardingPanel`: a focused layout helper, not a visual card by default. If
  a panel makes the flow feel like generic card stacking, avoid it or make it
  an open layout.
- `OnboardingChoiceDeck`: focused selectable modules for categorical choices.
  They should feel like one guided decision, not stacked settings rows.
- `OnboardingScale`: strong centered scale selectors for naturally ordered
  choices such as pace or activity intensity. Marker centers, rail endpoints,
  and progress fill must share the same geometry; selected markers should not
  resize the row or drift off the rail.
- `OnboardingPlanPreview`: renders the review payoff module as a small preview
  of the future app, with calorie target as the primary result, protein as the
  secondary result, and tracking mode as a quiet badge.
- `OnboardingSummaryGroup`: groups supporting review details so the final step
  does not become a wall of rows.

Onboarding copy should remain calm, useful, user-facing, and
non-judgmental. Avoid medical claims, motivational fluff, body-shaming
language, generic SaaS hero copy, and implementation-facing terms such as
baseline, deterministic, payload, setup data, stored value, trend context, and
target calculation. Explain the user's next action and benefit instead of
system mechanics. Decorative motifs must be extremely restrained: use only
subtle thin neutral line/path elements when they improve composition. If a motif
looks forced or cheap, skip it. Avoid overusing bordered boxes; the flow should
feel like one cohesive product surface, not a stack of unrelated cards.
Helper/support text should live in the lower screen as quiet text, not directly
under the main module and not as another bordered card. The review step should
emphasize daily targets first, then show a clear starting-plan payoff and only
quiet supporting inputs below.

Small non-data onboarding moments should be standalone onboarding slides when
they teach one useful idea, such as weight-direction preview or how the first
plan becomes daily action. Do not add a separate mode explainer after the mode
choice. Keep data-entry slides focused on the question, input, quiet support
text, and CTA. These informational slides must reuse existing answers, avoid
collecting extra fields, and sound like product guidance rather than
documentation.

The onboarding progress-direction slide should stay text-first unless a real
designed asset is available and tested on native iPhone. Do not build complex
onboarding illustrations from fragile React Native view geometry. Avoid axes,
gridlines, plotted-dot chart language, blobs, ribbons, pseudo-paths, and
anything that exposes system mechanics. If a custom graphic looks broken,
prefer a clean text-first info slide with current weight, target weight, and
simple next-step rows. Future real illustrations should be custom assets or
properly designed SVG/image assets, not rushed view-block graphics.

Onboarding should avoid the warmer beige/sage-heavy treatment used elsewhere in
the current app. Use the onboarding neutral palette, charcoal text, rare
purposeful borders, a black/charcoal primary CTA, and restrained rounded
modules. No green primary CTA should remain in onboarding. Do not use pastel
blocks, playful decorative marks, large empty hero gaps, random blobs, or
stacked bubbly cards in this flow.

Each onboarding step should read as four zones:

1. compact top progress
2. focused question/header
3. a distinct interaction module
4. quiet lower support copy plus stable bottom actions

The app startup splash is separate from onboarding and only exists while setup
status is loading or retrying after an API error. Onboarding starts at the first
real question. The review screen should feel like "Here is your starting plan":
mini dashboard preview first, weight-direction context below, quiet plan inputs
last, and simple reassurance that targets can be changed later.

For new users, the simple mode PNG mark is the default brand mark. Complex mode
uses the complex PNG mark. Render the actual tracked assets from
`apps/mobile/src/assets/brand/`; do not redraw the mark with React Native view
shapes. On splash/loading it may be centered and slightly larger. Inside
onboarding it should stay subtle at roughly 24-32px, or be omitted when it
makes the header feel crowded. Do not turn the mark into repeated decoration.
Launcher icon and native splash config should only change when explicitly
approved and reviewed.

The default launcher icon uses the simple mode mark from
`apps/mobile/assets/icons/simple.png`. Complex/Detailed mode uses the configured
`ComplexMode` alternate launcher icon from
`apps/mobile/assets/icons/complex.png` through `expo-alternate-app-icons`.
Changing launcher icon config requires rebuilding the Expo development build.

Height, birthday, current weight, and target weight onboarding steps should use
native-feeling wheel interactions. Height supports ft/in and cm views while
saving the existing total `heightInches` value. Weights use lb-based wheels and
continue saving existing lb setup fields. Wheel visuals should use a wide soft
selected band rather than a bordered card wrapper. Wheels should allow natural
momentum while committing selected values only after a snapped row settles or a
row is tapped, so visible values and saved form state remain synchronized.

## Buttons

`AppButton` variants:

- Primary: charcoal fill for the main action
- Secondary: raised surface with border
- Ghost: text action without a competing surface
- Danger: muted clay-red fill for destructive actions

Buttons have a minimum 46px height, a clear pressed state, and loading and
disabled states. A screen should normally have one primary action.

Modal logging forms place their primary action in a stable bottom action area
so the submit button remains easy to reach without making the form resemble a
desktop admin panel.

## Inputs

`AppInput` owns label, field surface, hint, and validation error presentation.

- Minimum height: 46px
- Soft inset surface with a subtle border
- Error border and message use the shared error token
- Numeric fields use the appropriate mobile keyboard
- Long notes use a multiline control
- Do not rely on placeholder text as the only label
- Forms use one stacked column, including numeric nutrition fields.
- Optional nutrition fields remain collapsed until requested.
- System-generated timestamps should be summarized in a compact status row
  instead of exposing raw ISO text unless editing is required.

## Bottom Navigation

The four destinations are:

1. Progress
2. History
3. Insights
4. Profile

Each destination uses a simple icon and label. Active items should be
charcoal/black-led; inactive items can be slightly softer but must remain
readable. There is no full Log tab.

Phase 6 native testing showed weak grey tab glyphs reduce scanability. Bottom
tab icons should be bold, readable, and charcoal-led, with inactive states
slightly softer but still visible at a glance. The selected tab must be clear
without becoming colorful or playful.

The tab bar uses the raised surface token, a subtle top border, and enough
bottom padding for phone safe areas.

## Floating Action Wheel

The central `+` button is the primary logging entry point. It sits above the
tab bar and opens an isolated semicircle menu.

Actions:

- Food: opens manual food logging
- Weight: opens manual weight logging
- Water: visibly disabled until implemented
- Note: visibly disabled until implemented

Unavailable actions include a visible `Soon` label, reduced contrast, disabled
accessibility state, and no press behavior.

The menu must not become a generic square popup or alert. The current
implementation intentionally keeps the positioning and action model isolated
inside `FloatingActionWheel` so animation and geometry can be refined later.
Do not add bulky CTA cards that compete with this primary create action.

## History And Logging

History should feel like a calm daily record, not a database list. Use an open
daily header, a horizontal pill day rail, a visual nutrition snapshot, grouped
ledger rows, quiet separators, and soft pressed states. Avoid wrapping every
meal or log item in a bordered card, and avoid turning the daily summary into
another generic module. Food rows should make the food name, calories, protein,
meal, and time easy to scan, with extra macro detail shown only when it helps.

For History and logging, the preferred base is pure white with charcoal/black
typography and crisp primary icons. Avoid drifting back into beige/off-white
card stacks or washed-out grey UI. Small, restrained accent colors are allowed
only for meaningful scan aids such as calorie day rings, macro rails, and tiny
icon moments. The screen should feel Stoic-led first, with only small Cal
AI-like energy accents. Day rails should behave like native daily-tracker
controls: seven visible days, obvious selected state, subtle today marker with
enough spacing, and tasteful rotated ring colors. Day rails may use circular
donut rings for calorie progress when they are rendered with reliable vector
primitives, not fragile View-built arc hacks. Empty days should read as empty
or dotted rings rather than fake progress. Icons are encouraged when they make
food, calories, protein, macros, or weight easier to scan, but they must remain
intentional and not become random decoration.

Food and weight logging forms should feel fast and native. Keep the primary
fields visible, keep optional nutrition details calm and collapsible, and place
primary actions in the stable bottom footer. Copy should explain what the user
should enter, not how timestamps or records are stored internally.

Food database-powered logging should extend the same ledger language. Search
results, saved foods, and reusable-food choices should render as open rows with
thin dividers, compact serving/nutrition metadata, and small save affordances,
not as stacked cards. Selected foods may use a compact chosen row plus a
serving multiplier control. Simple mode should keep calories and protein most
visible; Detailed mode may expose common macros and a quiet indication that
more nutrients exist, without turning the main logging screen into a full
micronutrient editor.

## Progress Visuals

Progress should read as a calm daily check-in before it reads as analytics.
Use typography as the anchor: one large calorie balance number, one human
status phrase, and restrained supporting rails or rows. A refined horizontal
rail is preferred over a giant ring when the ring would compete with the
message or risk clipping on device.

- Clamp visual progress to the available track.
- Keep over-target numeric values accurate even when the visual track is full.
- Never calculate nutrition facts in the component.
- Components render values returned by the existing dashboard response.
- Avoid stacked dashboard modules, repeated large circular visuals, and CTA
  cards that compete with the center add action.
- Protein, food count, and latest weight should support the main calorie
  status through open rows, quiet dividers, icons, and small accents.
- The current dashboard summary only supports calories, calorie target,
  remaining calories, protein, protein target, remaining protein, food count,
  latest weight, and tracking mode. Do not invent macro totals, trends, or
  advanced nutrition visuals on the client.

## Insights And Recommendations

Insights should feel like a calm personal report, not a dashboard. Use a pure
white base, charcoal typography, open sections, quiet dividers, icon-supported
rows, and small rings or rails only where they improve scanning. Do not solve
Insights with repeated bordered `AppCard` stacks.

Simple mode should emphasize calories, protein, logging consistency, weight,
and direct recommendations. Complex/Detailed mode may show macro split,
nutrition detail, and completeness signals, but it should still read as a
quiet report rather than a dense analytics panel.

Recommendations should read as actionable guidance rows. Prefer an icon dot,
priority pill, clear title, short message, and quiet dismiss action separated by
thin dividers. Avoid alert-card stacks, loud severity colors, and
implementation-facing copy.

Stable `react-native-svg` rings and simple rails are allowed for compact
indicators. Do not add a charting dependency or build fragile pseudo-charts
from arbitrary View geometry.

## Profile And Settings

Profile should feel like a personal control center, not a generic settings
form. Use a pure white base, strong charcoal typography, open settings groups,
quiet dividers, icon-supported rows, and a stable save area.

Avoid solving Profile with repeated bordered cards. Settings groups should read
as headings plus crisp rows, with pills or selected bands for choices. Use the
real Simple and Complex/Detailed mode marks where tracking mode is shown, and
keep the copy focused on what the user can change rather than calculation or
storage mechanics.

Goal and profile editing should preserve the existing request shapes and form
validation while improving rhythm: grouped fields, clear units, helpful helper
copy, charcoal primary save actions, and a quiet local cancel/reset affordance.

## Loading States

Backend-connected screens use layout-matched skeletons during initial content
requests where the user is waiting for page data. Pull-to-refresh uses the
native refresh control where appropriate. Buttons show an inline activity
indicator while submitting.

Loading states should identify what is loading and must not leave a blank
screen.

Phase 7 should replace circular spinners with skeleton loading where
appropriate. Skeleton states are for waiting on actual content or existing
record data. They should:

- preserve the shape of the loaded page
- reduce perceived loading time
- avoid jarring layout jumps
- use subtle neutral placeholder shapes
- follow the white/charcoal Phase 6 visual standard
- avoid heavy or distracting animation
- avoid large dead grey blocks

Use skeletons for Progress, History, Insights, Profile/settings, and
food/weight log flows where they improve the experience. Do not use skeletons
as decorative filler; they should match real content structure. Circular
spinners are no longer the default page-loading pattern, but small inline
spinners remain appropriate for tiny actions such as saving, deleting,
dismissing, or refreshing existing content.

The shared mobile primitive lives in `apps/mobile/src/components/skeleton.tsx`.
Use it for small lines, pills, rails, and blocks, then compose page-specific
skeleton layouts locally. Normal blank create forms should render directly;
food and weight log skeletons are for edit or log-again record fetches.

### Phase 7 Retrospective

What went well:

- Skeleton loading improved perceived performance across key backend-connected
  screens.
- Shared skeleton primitives reduced duplication and kept placeholder styling
  consistent.
- First-load, record-load, and small action-loading states now have clearer
  boundaries.
- Phase 7 stayed within scope: no backend, API, schema, package, lockfile, app
  config, or generated native changes.
- The implementation stayed aligned with the Phase 6 white/charcoal visual
  standard.

Risks to keep watching:

- Skeletons can be overused where immediate rendering is better, especially
  blank create forms.
- Poorly shaped placeholders can become dead grey blocks or fail to match the
  loaded layout.
- Screen-specific skeletons can drift if future screens do not reuse the shared
  primitive.
- Small action spinners should not be replaced with complex skeletons when the
  user is not waiting on page content.

Standards going forward:

- Use skeletons only when real content or existing record data is being fetched.
- Preserve close layout fidelity between the skeleton and loaded state.
- Render new food and new weight create forms immediately.
- Keep skeletons lightweight, neutral, and minimally animated.
- Avoid adding loading complexity where a small inline spinner is clearer.
- Maintain strict scope discipline across UI, backend, schema, package, and
  native boundaries.

## Empty States

Use `EmptyState` when a successful response contains no relevant records.

- State what is missing.
- Explain the next useful action.
- Keep the visual treatment quiet and compact.
- Do not present empty data as an error.

## Error States

Use `ErrorState` for API, validation, and connectivity failures.

- Present the backend message when it is safe and useful.
- Translate known validation paths into field-specific guidance such as
  `Protein must be 0 or higher`.
- Use contextual titles such as `History is unavailable` or
  `Please check your food entry` instead of a generic error heading.
- Include a retry action for screen-level fetch failures.
- Keep previously loaded data visible when a refresh fails.
- Form errors appear beside the relevant input; submission errors appear above
  the form.

## Small-Phone Rules

- Screens must remain usable at 320px width.
- Use wrapping rows for pills and stat cards.
- Avoid fixed-width content wider than the screen.
- Keep primary actions reachable without horizontal scrolling.
- Scroll forms and preserve keyboard access to the final action.
- Do not place critical content behind the tab bar or action wheel.
