# Coding principles

These conventions guide new code and refactoring. Apply them within each application's existing architecture; the browser app and extension remain independent clients.

## Cohesive responsibilities

Give each function one coherent purpose and keep its steps at a consistent level of abstraction. Separate transformations, browser operations, and UI orchestration when they change for different reasons. A coordinating function may call several meaningful steps. Extract helpers when they clarify a decision or remove repeated knowledge; avoid arbitrary function-length limits and wrappers that only rename a call.

The browser's storage module owns browser access. Validation rebuilds trusted values from unknown data. Migration converts earlier shapes. The picker view renders controls, its hook coordinates browser work, and its reducer calculates state transitions.

## Explicit side effects

Reads return data. Writes, migration commits, DOM changes, and network requests have explicit execution points. Initialize storage migration before mounting React. React render functions, initial state calculations, reducers, and state updaters stay pure: they compute values without saving data or creating requests.

Keep normalizers independent of browser globals. Inject dependencies where behavior actually varies, such as browser storage access, the metadata transport, and controlled randomness in tests. Keep those interfaces small.

## Validate at entry

Treat persisted JSON, imported files, and network responses as untrusted. Start with `unknown`, narrow its shape, validate identity, and reconstruct the complete application value. A type assertion alone provides no runtime guarantee. Normalize absent metadata to safe `null`/array values before rendering. Reject mixed-provider records and unsupported identities.

Use TypeScript strict mode. Use discriminated unions for alternative outcomes and states, narrow them before property access, and handle every action. Keep unavoidable assertions local to the platform integration that requires them, such as JSONP's dynamic global callback.

## One source of truth

Store each piece of application knowledge once. Represent the selected provider with one value in memory; translate the compatible two-flag disk layout at serialization. Store a picked title's ID and derive its details from the full source list. Derive eligible titles, counts, and status text from source data and current preferences.

Group related changes into explicit reducer actions so import, replacement, filter, provider switch, enrichment, and clear preserve their invariants together. Source lists remain complete even when a filter hides titles. Replacing or clearing a source invalidates its pending work.

## Honest failure contracts

Distinguish empty storage, damaged data, inaccessible storage, and failed writes. Expected failures return explicit results or visible feedback; an exception must have a defined owner that handles it.

Browser picker policy: successful parsing updates the current session. Failed persistence keeps that session usable and displays a warning that changes were not saved. A later successful write saves the current complete options snapshot. File-read/parse/provider failures preserve the previous source. Optional metadata failures leave picks usable and remain retryable. Obsolete-key cleanup occurs only after a successful unified write; cleanup failure cannot turn a committed write into a reported save failure.

## Explicit interfaces

Use named argument objects for operations with several related inputs. A caller should be able to see important effects and required context from the operation's contract. Prefer explicit provider/action values over defaults drawn from unrelated mutable state. Keep public interfaces smaller than the behavior they hide.

## Meaningful domain data

Keep data in its useful native form and format it for display at the view. Runtime is stored as `runtimeMinutes`; older formatted runtime text is decoded during restoration. `importedAt` records source import time; `updatedAt` records subsequent filter/enrichment writes. Names and parameter behavior must match their meaning.

Canonicalize provider-native IDs and URLs at import/restoration. IMDb IDs are lowercase; Letterboxd short-link codes retain case. Accept supported public HTTP film URLs, reject conflicting identities, and deduplicate only after a usable identity exists. Offline short and long Letterboxd aliases remain separate unless a verified mapping becomes available.

## Reuse knowledge deliberately

Share repeated rules such as provider labels, filtering, identity normalization, metadata merging, and CSV tokenization. Tokenize each imported CSV once before provider-specific normalization. Reuse complete transformations rather than scattering partial copies through event handlers. Provider-specific behavior belongs with its provider parser; shared rendering consumes the common title model.

Use semantic CSS tokens for recurring spacing and palette values. Keep theme colors separate from layout geometry, preserve native accessible controls, and keep visible focus and reduced-motion support.

## Async ownership

Each async operation has a defined lifetime and cleanup path. Ignore stale file reads after newer imports, switches, clears, and unmounts. Tie enrichment to the selected source revision and pick; merge results into the latest state so concurrent preference changes survive.

Deduplicate in-flight metadata requests by canonical ID. Clean up JSONP scripts, timers, and globals on success, failure, and timeout. Cache validated responses; keep transient failures retryable. Optional metadata must never attach a different film's details to the selected identity.

## Documentation that explains decisions

Document public contracts and non-obvious decisions, especially compatibility, identity, error policy, and asynchronous ownership. Use names and structure to explain ordinary mechanics. Update comments and architecture references as implementations change. Keep future proposals clearly separate from implemented behavior.

## Evidence for changes

Use tests that exercise observable contracts and meaningful failure modes. For browser changes, run the TypeScript/Vite build, lint, and relevant regression suites described in the codebase guide. State and persistence refactors require migration, provider isolation, full-source preservation, failed-import preservation, and failed-write coverage. Browser orchestration changes also require real browser checks for the affected user flows. Distinguish local fixtures from live provider/account verification in reports.

Preserve compatibility with existing user data. Introduce schema changes through an explicit decoder/migration, retain original records when the new write fails, and document any data that cannot be reconstructed from an earlier schema.
