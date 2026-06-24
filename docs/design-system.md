# Mobile Design System

## Direction

The mobile product combines Apple Health's calm spacing, native-feeling
typography, and data clarity with Cronometer's serious nutrition information
architecture.

The interface must feel:

- calm, premium, and health-oriented
- information-dense only where the data requires it
- natural rather than highly saturated
- native to a small phone rather than adapted from a desktop dashboard

Avoid generic SaaS layouts, purple or blue gradients, random screen-specific
colors, playful food illustrations, and excessive card nesting.

## Theme Tokens

Light mode is the implemented default. Dark-mode tokens are defined for future
use, but theme switching is not part of this phase.

### Light

| Role | Token | Value |
| --- | --- | --- |
| App background | `canvas` | `#EDE4D1` |
| Standard surface | `surface` | `#F8F3E8` |
| Raised surface | `surfaceRaised` | `#FFFCF5` |
| Primary text | `ink` | `#252821` |
| Secondary text | `muted` | `#74776E` |
| Border | `border` | `#D8CEBB` |
| Primary accent | `primary` | `#7A9B76` |
| Primary dark | `primaryDark` | `#506D4F` |
| Primary soft | `primarySoft` | `#DDE7D8` |
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
`bg-sage-soft`, `bg-water-soft`, `bg-gold-soft`, `bg-clay-soft`, and
`bg-error-soft`.

## Typography

Use the iOS system font stack. Prefer the rounded system feeling where the
platform provides it; do not bundle a custom font for the foundation phase.

Hierarchy:

- Display: 36px semibold for the most important daily number
- Title: 30px semibold for screen names and greetings
- Heading: 20px semibold for sections and card titles
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
- Cards: 20px
- Pills and circular controls: fully rounded
- Borders: 1px using the shared border token

Shadows are minimal and reserved for raised hero cards and the floating action
button. Borders and surface contrast should do most of the separation work.

## Cards

`AppCard` is the standard surface primitive. Standard card padding is 18px;
compact cards and form sections use 16px.

- Use a raised off-white surface on the cream canvas.
- Prefer one clear purpose per card.
- Avoid wrapping every text block in a card.
- Use dividers for repeated rows inside a shared card.
- Use color as a small accent, not a full saturated background.

`StatCard` is for one numeric fact with a label and optional context.

## Shared Layout And Data Primitives

Use shared primitives before creating new screen-local row, section, or notice
layouts.

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

## Buttons

`AppButton` variants:

- Primary: sage fill for the main action
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
