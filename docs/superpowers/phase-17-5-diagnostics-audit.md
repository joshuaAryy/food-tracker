# Phase 17.5 diagnostics audit

## Client

The temporary staging Insights formatter and route state were removed in R12.1.
The mobile UI no longer renders `Diagnostic:` text or exposes HTTP classes,
request identifiers, cache state, parser stages, reducer stages, or backend
diagnostic categories. Safe development diagnostics from the shared API parser
remain console/operational instrumentation only and are not rendered by a
reporting component.

## Server

`apps/api/src/modules/analytics/trends/insights-diagnostics.ts` remains enabled
only when `APP_ENV=staging`. It emits category names and sanitized operational
error metadata through the existing server diagnostic sink. Its redaction
removes authorization values, URLs, email addresses, user identifiers, food
names, nutrient values, and quoted arbitrary payloads. No server diagnostic is
passed to the mobile report UI.

## Release gate

The mobile diagnostics visibility regression test must remain green, and the
Release source scan must contain no user-facing `Diagnostic:` formatter or
staging Insights diagnostic import.
