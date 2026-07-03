# Mobile Design System

## Direction

The mobile product is moving toward a visual identity summarized as "Simple
tracking, serious insight." Phase 6.5 starts the shared onboarding plus
Progress/Home visual system reset. Stoic is the strongest mood/style reference:
quiet grey canvas, confident black typography, soft white modules, restrained
icons, and minimal chrome.

The interface must feel:

- calm, premium, and serious
- information-dense only where the data requires it
- light/off-white, neutral, and professional rather than highly saturated
- native to a small phone rather than adapted from a desktop dashboard

Avoid generic SaaS layouts, Apple Health-style stacked cards as a default
answer, purple or blue gradients, beige/yellow dominance, green-heavy action
systems, random screen-specific colors, playful food illustrations, childish
illustration styles, random blobs, and excessive card nesting. Do not copy
Lifesum/Cronometer-style visuals. Cal AI is useful for onboarding and nutrition
flow structure, not as the primary visual style.

Design references and explicit user feedback override old visual assumptions.
Current Phase 6.5 references live in
`docs/design-references/phase-6-5/`. For native device-testing priorities, see
`docs/mobile-ui-and-device-testing-context.md`. For the product and visual
lessons learned during Phase 6 iteration, read
`docs/mobile-visual-lessons.md` before starting a new mobile UI phase.

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
purpose-built modules such as `AppModule`.

- Use a raised surface only when the card has a clear job.
- Prefer one clear purpose per card.
- Avoid wrapping every text block in a card.
- Use dividers for repeated rows inside a shared card.
- Use color as a small accent, not a full saturated background.

`StatCard` is for one numeric fact with a label and optional context.

`AppModule` is the preferred Phase 6.5 product module primitive for the first
main screen and reference-led onboarding surfaces. Use it for soft white or
muted modules with clear purpose, not for wrapping every text block.

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

Each destination uses a simple icon and label. Active items use dark sage;
inactive items use muted text. There is no full Log tab.

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

## Progress Visuals

`ProgressRing` presents one dominant completion ratio and a centered value.
`MacroProgressBar` presents nutrient consumed versus target.

- Clamp visual progress to the available track.
- Keep over-target numeric values accurate even when the visual track is full.
- Never calculate nutrition facts in the component.
- Components receive deterministic values from the backend response.

## Loading States

Backend-connected screens show `LoadingState` during the initial request.
Pull-to-refresh uses the native refresh control where appropriate. Buttons show
an inline activity indicator while submitting.

Loading states should identify what is loading and must not leave a blank
screen.

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
