# LeanLog — Codex handover

Updated: 2 October 2026 (Asia/Kuala_Lumpur).

## Read this first

This document is the entry point for continuing LeanLog on another PC. Read it first, then inspect only the files needed for the current request. Do not scan the whole repository to rediscover project history. Verify current git status before editing; the working tree contains unreleased fixes listed below.

User speaks casually in Malay/English. Match that tone, give concrete progress updates, and avoid claiming a fix is confirmed on-device when only static checks passed. Several past regressions survived TypeScript checks, so runtime evidence matters.

## Project and last release

- App: LeanLog, with integrated finance module RedCoins.
- Existing checkout: `C:\Users\C5407836\CalorieTracker`. Use the actual clone path on the new PC, not this old absolute path.
- Repository: https://github.com/umarislah86-collab/leanlog
- Working branch: `github-release-v221` (historical name; still the current development/release branch).
- Last released commit: `4174b7a41a6231b83e9825fd3b22c3013041998a`.
- Last release: `v2.9.9`, Android versionCode `14`.
- APK: https://github.com/umarislah86-collab/leanlog/releases/download/v2.9.9/leanlog-V2.9.9.apk
- ARM64-only, 42,692,655 bytes / 40.71 MiB.
- SHA-256: `69e5c627c416537aa51115d68ddb69ea4d58e86c4da92bcf5c61856c8a27c95f`.
- EAS build: `a0daa4ec-bcfd-41d7-96ed-d205e4e45c2b`.
- That build was submitted before the release commit, from a dirty tree containing the release changes. EAS metadata therefore says previous commit `13006a9`; this is not evidence that the APK omitted v2.9.9 changes.

## Migration — do not lose local fixes

**Cloning GitHub alone currently loses the unreleased fixes below.** They are not committed or pushed as of this handover.

Simplest transfer: copy this entire checkout including hidden `.git` and `HANDOVER.md`, excluding `node_modules`, `.expo`, generated build directories and `release-artifacts`. This preserves both history and uncommitted tracked/untracked source files. Run `git status --short` on both PCs and compare the files below.

If cloning instead, explicitly transfer the changed source files listed below, including the NEW `services/redcoinsBudget.ts`, and this handover. A normal `git diff` patch does not include untracked new files.

On the new PC:

1. Install Git and a Node.js version compatible with the project's Expo SDK. Use `npm ci` against the existing lockfile; do not upgrade packages incidentally.
2. Open this repo as the Codex workspace; read this document, then `git status --short` and `git log -3 --oneline`.
3. Authenticate GitHub CLI (`gh auth login`) and EAS (`npx eas-cli login`) with the user's accounts. Credentials/session caches are not included in the source transfer.
4. Run `npx tsc --noEmit`. Start with `npx expo start` for JS development. Native modules/widgets/manifest changes require a native APK.
5. Android signing is managed by EAS remote credentials. Reuse them; do not generate a different signing key or change the package name, otherwise installed-app updates may fail.

Firebase backend configuration exists in source. Do not paste credentials, tokens, private keys or environment secrets into handover/chat. Firebase CLI login is only needed for backend operations. App data on the phone is separate from this PC migration; moving source does not transfer phone records.

## Current unreleased fixes — already coded, DO NOT redo from scratch

User explicitly said: **do not build yet; collect feedback first**. There has been no build/commit/push of these fixes. Continue collecting/fixing; release only when asked.

### 1. Food Camera/Gallery fails through launcher shortcut

File: `screens/TodayScreen.tsx`.

User clarified Camera/Gallery work after opening the app normally, but fail when entering via app-icon quick action. Feature and native permission/plugin were still present.

Current mitigation adds `launchedFromShortcut` ref and `InteractionManager` waits: delay opening logger after a deep-link launch, then give native picker additional time after source modal dismissal (750ms for shortcut, 450ms otherwise). Catches picker errors and shows an alert. Shared food/activity picker path benefits.

**Cause remains a lifecycle/timing hypothesis, not confirmed on the phone.** Earlier assistant overstated confirmation. TypeScript passed; test cold launch AND warm launch via shortcut, Camera AND Gallery, normal launch, cancel and retry. If timing workaround fails, inspect Android activity/deep-link lifecycle and real logs; do not just keep lengthening timeouts.

### 2. AEON Bank notification missed

File: `modules/bluecoins-drive-reader/android/src/main/java/expo/modules/bluecoinsdrivereader/TransactionNotificationListenerService.kt`.

Exact observed text: `Your card transaction was successful. MYR13.90 paid to 1011-MYNEWS-AXIS BIZ PRK SELANGOR MY on 02/10/2026. Contact us if you did not perform this action.`

Old ignore regex matched `tac` inside `Contact` and rejected the payment. Fixed with word boundaries around OTP/TAC/security/incoming-payment keywords. Amount regex already supports `MYR13.90` without a space. Local regex checks accept AEON amount 13.90 and still reject OTP, TAC, SecureTAC, credited and refund samples. Native notification reception still needs phone verification. No API key: detection is local Android notification-listener parsing.

### 3. Plan budget subcategory actuals incorrect

Files: `screens/RedCoinsScreen.tsx`, NEW `services/redcoinsBudget.ts`.

Screenshot: Reports Dining Out 128.95, widget rounded 129, Plan 12. Entertainment category 173.95. Root cause: `Object.fromEntries` over per-item details overwrote repeated category/subcategory keys instead of summing. Also used a truncated top-category/top-item summary, dropping less prominent items.

New pure `aggregateCycleSpending` sums the full reconciled `state.entries` ledger for category/subcategory actuals. Excludes future, out-of-cycle and non-expense entries; income summed separately. Plan uses Budget Coach cycleStart/cycleEnd when available. Retains merged `monthly.spent` for the cycle ceiling, including mortgage/car commitments, and preserves synthetic Debt commitment category reservation.

Regression checks on the actual helper: Dining Out 128.95, Entertainment 173.95; >5 categories retained; future/out-of-cycle excluded; transfers excluded; income separate. TypeScript passed. Phone data comparison remains outstanding.

### 4. Account Snapshot widget cannot be added

Files: `widgets/RedCoinsWidgets.tsx`, `widgets/WidgetConfigurationScreen.tsx`.

AccountSnapshotWidget used React Fragment `<>...</>` for its populated content. Library `buildWidgetTree` tries to invoke element types and does not support the Fragment symbol. Replaced fragment with `FlexWidget`. Configuration now catches account-load/save/render failures and prevents double Save taps.

Test used the library's actual `buildWidgetTree` with widget primitive stubs for configured and empty account; both passed. TypeScript passed. Still test the real Android launcher, account configuration, add/cancel/reconfigure, multiple instances and updates.

## Architecture and where to look

### Additional unreleased work after this handover was first written

- Home's large Bluecoins sync/change-source buttons moved to Settings → Bluecoins import. Manual import confirms before reading/applying. `bluecoins_auto_sync_v1` defaults off; background task checks it. Existing local `.fydb` is used for recalculating summaries without fetching a new Drive baseline when auto-sync is off. `refreshBluecoinsSummary(folder, true)` explicitly imports a new backup.
- `services/exportFile.ts` provides Android Save to folder (SAF) or Share for RedCoins CSV and Progress PDF/CSV. Cancel returns false and does not record an export batch. Mark as imported remains separate.
- Progress PDF/CSV rewritten around `services/progressReport.ts`: selected 7/30/All range, escaped HTML, overview/rhythm chart, paginated daily/meal/activity/weight journals. No silent record caps. PDF HTML visually inspected; helper tested with 240 records. Android print/folder/share flow still needs APK verification.
- Added files to transfer: `services/exportFile.ts`, `services/progressReport.ts`. Additional changed files: `screens/HomeScreen.tsx`, `screens/SettingsScreen.tsx`, `screens/ProgressScreen.tsx`, `services/bluecoins.ts`, `services/bluecoinsBackground.ts`, `services/redcoins.ts`.

Stack: Expo SDK 57, React 19.2.3, React Native 0.86.2, TypeScript, React Navigation, AsyncStorage, SQLite, Firebase, native Kotlin bridge.

| File / area | Responsibility |
| --- | --- |
| `App.tsx` | Navigation, quick-log dock, linking, notification interactions |
| `screens/TodayScreen.tsx` | Food logger, Camera/Gallery/Text, image analysis, activity/weight; launcher food shortcut |
| `screens/RedCoinsScreen.tsx` | Finance Home/Activity/Accounts/Plan/Reports, transaction editor, filters, structure/icon editors, automation manager, PDF report |
| `services/redcoins.ts` | Durable finance state, Bluecoins reconciliation, deletions, balance effects, CSV export, Budget Coach merge |
| `services/redcoinsLedger.ts` | SQLite ledger query/index/sync; search and filtering |
| `services/redcoinsBudget.ts` | NEW complete-ledger cycle aggregation |
| `services/bluecoins.ts` | Read Bluecoins `.fydb`, salary cycle, commitments, finance summaries |
| `services/spendingGuards.ts` | Spending guard/cash settings and snapshots |
| `services/redcoinsReminders.ts` | Recurrence calculations, due-only materialization and notification scheduling |
| `services/bluecoinsBackground.ts` | Background Bluecoins sync |
| `services/widget.tsx` | Refresh all five widget providers |
| `widgets/widget-task-handler.tsx` | Widget add/update/resize/delete events |
| `widgets/LeanLogWidget.tsx`, `widgets/widget-data.ts` | Original Daily widget |
| `widgets/RedCoinsWidgets.tsx`, `widgets/redcoins-widget-data.ts` | Account, Cash Reality, Quick Log, Automation widgets and their data |
| `widgets/WidgetConfigurationScreen.tsx` | Per-instance account choice |
| `plugins/withLeanLogShortcuts.js` | Android app-icon shortcuts and native resources |
| `modules/bluecoins-drive-reader/` | Local Expo Android module: document-provider reads and notification detector |
| `screens/SettingsScreen.tsx` | Update checks, widget pinning, cloud backup, settings |
| `components/LeanLogChronicle.tsx` | Hikayat narrative changelog; add a chapter for every release |
| `services/ai.ts`, `firebase.ts`, `functions/` | AI/backend and Firebase integration; inspect only if relevant |
| `app.json`, `eas.json`, `index.ts` | Native configuration, ARM64 build profile, app/widget registration |

## Product rules agreed with user

- LeanLog Home Budget Coach is read-only. Finance operations belong in RedCoins.
- Accounts, category and subcategory icons are user-editable. Expense ledger prioritizes subcategory icon, then category, then inferred fallback. Income/transfer currently use standard transaction icons. Icon library uses bundled Ionicons, not extracted Bluecoins assets.
- RedCoins state is `redcoins_state_v1`; SQLite ledger is a query layer. Keep both synchronized after mutations.
- Imported Bluecoins history and locally logged rows are reconciled: never sum both versions of the same payment. Deleted entries must not survive in coach/guards/reports/suggestions.
- No user-facing Trash. Compact deletion markers remain internally to suppress deleted imported transactions on later sync.
- `(New Account)`, `(No category)`, `(Transfer)` are Bluecoins system categories, filtered out of user structure. Do not delete historical transactions referencing them.
- Structure Delete removes future choices, preserves ledger history, and uses deleted-name/subcategory markers so import does not recreate it. Current implementation blocks deletion if any schedule references it. Recreating the name clears its marker.
- Transactions dated in the future stay visible in ledger but do not affect current account cash or current spending yet.
- Transfers show source AND destination balance after the transaction. Card settlement is not a second expense.
- Cash Reality and cycle budget are distinct: selected cash minus card debt/buffer/unpaid commitments versus budget remaining. Labels and coach notes must agree with formulas.
- Mortgage/car commitments must remain included in cycle planning. Do not silently remove them during aggregation refactors.
- Logger suggestions appear only after typing, use active ledger entries, populate title/account/subcategory but NOT amount. Notification detection must NOT populate the editor title.
- Ledger shows hour/minute, newest first. Must remain virtualized and fast; use SQLite queries rather than rendering all transactions.
- Filter has multi-choice dropdowns for type/account/category/subcategory, date and salary cycle. Clear All applies immediately.
- Reports supports salary cycles based on salary entries and custom ranges, with styled PDF export.
- Search/picker results must stay above the keyboard. Modal outside-tap and Android Back should dismiss; RedCoins Back traverses internal tab history before exiting.
- Reminder Save creates a schedule, not an immediate ledger row. Auto-log materializes once when due. Both reminder and auto-log send notifications. When app is closed, transaction creation currently occurs when app resumes; do not promise guaranteed background creation.
- Widgets: Daily, Account Snapshot (per-instance account), Cash Reality, Quick Log, Automation & Bills. No agenda in Daily widget. Widgets require native build for launcher verification.
- Health Connect workout import removed by request; user logs workouts manually. Keep steps/sleep/heart-rate features. Barcode engine was removed; do not reintroduce it.
- UI: use established LeanLog cream/navy/mint/coral aesthetic, serif editorial headings and clean standard icons. Avoid emoji-heavy generic cards/pills. Body Timeline and monthly mirror photos are merged; photo-less weight logs collapsed by default.

## Build and GitHub release convention

When user says **build**, they mean build AND commit/push AND GitHub release with APK. Do not stop after EAS submission unless user explicitly says they will follow up when ready. Current latest instruction, however, is to collect fixes without building yet.

1. Inspect git status and relevant diffs. Preserve unrelated changes.
2. Bump `expo.version` in `app.json` to the next agreed version and add a factual narrative chapter to `components/LeanLogChronicle.tsx`.
3. Run `npx tsc --noEmit`, `npx expo config --type prebuild --json`, `git diff --check`, plus focused runtime/regression checks for risky changes.
4. Commit exact release source and push `github-release-v221`; preferably submit EAS from that clean commit for accurate traceability.
5. Build ONLY `npx eas-cli build --platform android --profile preview-arm64 --non-interactive --json --no-wait`.
6. EAS project: owner `umarosli93`, slug `umarcoc93`, project ID `624ee9c5-768a-4781-a2c5-1f1608c1500a`; Android package `com.calorietracker.app`. VersionCode is managed remotely with autoIncrement. Reuse remote keystore.
7. Follow build via `npx eas-cli build:view BUILD_ID --json`. If cloud build fails, inspect logs and fix before publishing. Avoid excessive polling.
8. Download official finished APK, inspect ZIP native libraries: ONLY `lib/arm64-v8a`. Check size, version/package/signing where tools available. Do not publish old queued artifacts.
9. Publish GitHub tag/release pointing at release commit, with asset named EXACTLY `leanlog-VX.Y.Z.apk`. Both auto-update and Settings update depend on GitHub latest release/assets; filename casing matters for the Home hardcoded URL.
10. Verify uploaded asset digest matches local SHA-256 and download returns HTTP 200. Report release link, size, commit and what phone testing remains.

ARM64 installs on user's phone; keep ARM64-only (~40MiB). Universal APKs were ~100–130MB and user explicitly rejected them.

## Next agent's starting checklist

Read `git status --short` and the relevant unreleased section above. Confirm six changed/new source paths for camera, AEON parser, budget helper/screen and widget renderer/config screen have been transferred. Resume the user's newest feedback. Do not build merely because this handover mentions the release process. Do not equate TypeScript success with phone behavior.
