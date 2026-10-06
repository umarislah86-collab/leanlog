# LeanLog — Codex handover

Updated: 6 October 2026 (Asia/Kuala_Lumpur).

## Latest published release — v2.9.13 (6 October)

- Published ARM64 APK v2.9.13 / versionCode 18. Source commit `5098cd6b1d0cc7927e43bbe029f84cc6daa3f9e3`; EAS `01d81985-d151-478f-aef2-46ec0b13a259` FINISHED. 42,849,967 bytes (40.86 MiB). Manifest/version/package, ARM64-only libraries, ZIP integrity and APK v2 signing verified; signer unchanged (`62a8aa1dd325bbe4b76855f4f3cc239950c4133b76ff904244cad6c78695161c`). 86 tests, TypeScript, Android Metro and EAS native build passed. Phone testing remains pending.
- APK: https://github.com/umarislah86-collab/leanlog/releases/download/v2.9.13/leanlog-V2.9.13.apk
- SHA-256: `ad32ebf776cffe58bfee17f113bd0a5aa0fcbd527609600ebb693a5b27b0d02c`.
- Fix in `services/redcoins.ts`: custom-account balance rebuild skipped locally logged transfers matched to imports whose destination still named the deleted old account. Opening the app can replay cached FYDB even with auto-sync OFF; no new Drive sync was needed to trigger the bug.
- Source-backed balances now reverse matched raw imports and apply effective local replacements; custom balances replay the complete effective live ledger once, including matched transfers. No double source debit; future rows excluded; deletion suppression retained.
- Read-only actual backup `C:\Users\C5407836\Downloads\RedCoins-backup-2026-10-06.json` + reconstructed cached summary: before fix RM1,556.97 -> RM1,256.97 -> RM956.97; after fix RM1,856.97 remains unchanged for ten replays. Original backup bytes unchanged. Not a fresh FYDB or phone test.
- Relevant local transfer `1790685244309` (Aeon -> Pot aeon, RM300) matches imported `bluecoins-1790685319967` targeting deleted `Saving POT `. Edited RM1,500 transfer also targets custom Pot aeon.
- Added four regressions in `tests/redcoinsAccountIdentity.test.cjs`; 86 tests pass, TypeScript passes. Covers matched custom/unchanged/rerouted transfer, repeated replay, future exclusion, no double debit and user adjustment preservation.
- Do NOT remove the user's historic RM600 Adjustment, add more compensating entries, or hardcode RM1,856.97. Fix preserves the current saved balance; already-drifted balances need explicit user confirmation to correct. Test repeated reopen on the new APK.

## Previous release — Reports & reminders v2.9.12

- Published v2.9.12 ARM64-only, versionCode 17. Source commit `678f649d9751acc4f0ef32e12ad25ae421496e86`, EAS `1e8aaeff-db80-4c06-a6a2-7353fe694e85`. APK 42,848,687 bytes (40.86 MiB), SHA-256 `848b09f9e494bc28b4c5dd35c0465a8704356ee35619e3569135cc4e6a725372`. APK v2 signature verified, signer unchanged. 82 tests, TypeScript, Android Metro bundle and EAS native build passed. All changes below are included in this APK; older pending-build statements below are historical. Phone UI/copy/save validation is still pending.
- Download: https://github.com/umarislah86-collab/leanlog/releases/download/v2.9.12/leanlog-V2.9.12.apk

- Reports now opens `RedCoinsAiPromptModal`: reduction scenario 5/10/15/20/25% (default 10), baseline 3/6 periods, selectable prompt preview, OS clipboard copy (`expo-clipboard`, SDK-compatible native dependency), and `.txt` Save-to-folder/Share via existing export delivery. No external AI/API calls. Included in v2.9.12; native clipboard phone validation remains pending.
- `services/redcoinsAiPrompt.ts` is a read-only live-ledger export with cent totals, complete ID-referenced selected/baseline/future data, explicit current-only account/plan snapshots, coverage warnings and non-forced reduction targets. Actual salary timestamps define prior completed cycles; custom ranges use fixed preceding calendar months without backfilling older history. Expense, liability-directed loan repayments and credit-card settlement transfers stay separate. Missing/deleted destinations are unclassified rather than guessed from names. Prompt treats data text as untrusted and prohibits double counting, invented history and forced cuts to commitments. 67 regression tests and TypeScript pass; copy, folder picker and layout await device validation.
- User approved in-app analysis: `services/redcoinsAnalysis.ts` + `components/RedCoinsAnalysis.tsx` add compact collapsible Reports sections: matched elapsed-span expense pace for salary cycles (daily rates for custom ranges), category/subcategory shifts with transaction drill-down, repeated titles without assuming duplicates/subscriptions, user-confirmed Protected/Flexible/Unconfirmed classifications, and a read-only 5–25% cut simulator with explicit saving/shortfall. `analysisExpenseClasses` is saved in RedCoins state and preserved on Bluecoins import, also included in exported prompts. All classifications default Unconfirmed; loan-transfer payments are always protected. No budget mutation/apply action. Prompts and UI explicitly include loan repayments in total real outgoings and net after commitments, separate from raw expense and credit-card settlement. Data-only generation avoids serializing a full prompt for in-app analysis. No AI API/cloud calls or hardcoded 30% cuts.
- Combined regression suite now has 75 passing tests, including two loans counted once, protected-cut exclusion, equal-span salary comparison, custom daily-rate comparison, repeated-charge grouping, exact cents and user-classification prompt export. Android Metro export and TypeScript checked; phone UI/native clipboard still await the next APK/device test.
- Reminder manager now sorts nearest next due first, with paused/completed at bottom, and displays signed projected source balance (also destination for transfers). `services/redcoinsReminderProjection.ts` is read-only: rolls current balances forward through all active upcoming occurrences up to each next due, including earlier repeats, reminder-only assumptions and unapplied future ledger rows. Linked ledger occurrences count once using ledger values; applied entries/deleted occurrences are not replayed. Simultaneous dues share a post-batch snapshot. Missing-account/invalid-amount schedules have no projection. Predictions explicitly are not live balances. Seven new tests (82 total) cover ordering, cumulative repeats/income/transfers, simultaneous dues, missing accounts, dedup, suppression and exact cents. Included in v2.9.12.

## Latest released feedback fixes — v2.9.11 (5 October)

- Bluecoins account rename now follows source account IDs; legacy migration uses matching, unedited imported transaction IDs and refuses ambiguous matches. Preserves local account IDs/icons and rewrites confirmed references in entries, reminders, defaults, cash selections, guards and widget preferences. Source-ID deletion tombstones prevent renamed deleted accounts resurfacing. Implementation: `services/redcoinsAccountIdentity.ts`.
- Fixed repeated import replay of effects onto custom accounts whose saved balances already included those effects. Regression syncs the edited-import/local-transfer/dividend case three times without balance growth. This prevents further inflation; it does NOT infer or repair previously inflated balances. User's read-only 5 October backup has Pot aeon RM6,358.38, versus approximately RM1.8k reported externally; exact reconciliation needs a confirmed balance. Do not overwrite the original backup or guess a correction. An orphan transfer reminder still targets the deleted Savings POT Aeon: missing-account auto-log is blocked and UI requests repair.
- Ledger TOTALS summarizes the complete live search/filter set and manual selections (Income/Expense/Transfer/Net); Select All is no longer limited by pagination. Future rows included in the visible list are disclosed. `services/redcoinsLedgerSummary.ts` is the shared filter/summary source.
- User-approved Bluecoins-style batch actions now live in `components/RedCoinsBatchModal.tsx` and `services/redcoinsBatch.ts`: title/date/amount/accounts/category/labels/status/copy-paste/delete. All mutations validate the complete set and confirm before save. No Void status. Paste detaches schedules/exports and records `duplicateOfId`, so source reconciliation cannot swallow an intentional copy. Reconciled local edits suppress their old source row; edited imports are reflected in Home coach deltas. See `docs/bluecoins-multiselect-audit.md`. Batch UI still unverified on a phone.
- Daily widget is now configurable per instance: existing Spending Guards or up to four selected accounts, in selection order, in the same compact 2x2 slots. Preferences use stable account IDs; import refresh now preserves those IDs. Daily `widgetFeatures: reconfigurable` requires the next native APK. Tests exercise instance isolation, current balances/renames/deletion and the actual widget tree builder; launcher/device verification still pending.
- Historical release is v2.9.11, code 16, source commit `abe3f4f0f3e756d85c69e4f0c3a8a52fea837e0b`, EAS `81bdabaf-11a8-41fc-9b55-567c43b5485f`. ARM64-only APK 42,776,303 bytes (40.80 MiB), SHA-256 `3bbfa96c4774fdce863a84d49d359ddcf17d2bf545857aa2d5f6cd63025d4ee4`. Published on GitHub; 60 tests, TypeScript, Metro export and EAS Android build passed. APK v2 signature verified with the same signer as v2.9.10. Real-device behavior still pending. Older release metadata below is historical.
- Guard evaluations now load live configurations, evaluate active state.entries, and publish local state/guard changes to mounted RedCoins/Home screens. Included in v2.9.11.
- Bluecoins `CATEGORYGROUPTABLE` verified read-only: group 2 Income, 3 Expense. Import carries per-subcategory type arrays (Bank/People/Others can exist on both sides). Logger uses these declarations, legacy ledger evidence as fallback, and hides unknown pairs. Custom subcategory type can be set in Manage; saved declarations survive source refresh.
- Logger suggestions show the most recent amount for the same transaction type, exclude future rows, and focus amount without prefilling it. Ledger displays live state immediately; regular saves use a SQLite upsert instead of full rebuild and never wait for notification scheduling.
- Android reminders use `RedCoinsAlarmScheduler.kt`, exact/inexact AlarmManager scheduling, reboot/package/time-change restoration, due notifications, and `RedCoinsAutoLogService` short foreground Headless JS task. `redcoinsRuntime.ts` registers the task and catches up on app resume/start. Native module has an explicit React Android dependency.
- Exact access is user-controlled (SCHEDULE_EXACT_ALARM, not USE_EXACT_ALARM). Without it, notifications can be inexact and auto-log catches up on app resume. UI shows precise alarm and notification access, plus actual `loggedAt` versus scheduled due time. Force-stopping and OEM battery restrictions still require device verification; do not promise exact timing universally.
- State writes are serialized with only pending-write cache, preserving external backup/cloud restores. Tests cover ordering, due idempotence, future/deleted/paused/manual exclusion and correct balance application.
- Native Kotlin/Android compilation and real Doze/locked/closed app behavior have NOT been verified locally (no Android SDK/device). Before release validate native build, first-time permissions, denied notification access, exact-alarm grant/revoke, due task, cancel/edit/pause, reboot, no duplicates, and normal/shortcut camera flows.

## Read this first

This document is the entry point for continuing LeanLog on another PC. Read it first, then inspect only the files needed for the current request. Do not scan the whole repository to rediscover project history. Verify current git status before editing; older feedback sections below describe already released work.

User speaks casually in Malay/English. Match that tone, give concrete progress updates, and avoid claiming a fix is confirmed on-device when only static checks passed. Several past regressions survived TypeScript checks, so runtime evidence matters.

## Project and last release

- App: LeanLog, with integrated finance module RedCoins.
- Existing checkout: `C:\Users\C5407836\CalorieTracker`. Use the actual clone path on the new PC, not this old absolute path.
- Repository: https://github.com/umarislah86-collab/leanlog
- Working branch: `github-release-v221` (historical name; still the current development/release branch).
- Last released source commit: `5098cd6b1d0cc7927e43bbe029f84cc6daa3f9e3`.
- Last release: `v2.9.13`, Android versionCode `18`.
- APK: https://github.com/umarislah86-collab/leanlog/releases/download/v2.9.13/leanlog-V2.9.13.apk
- ARM64-only, 42,849,967 bytes / 40.86 MiB.
- SHA-256: `ad32ebf776cffe58bfee17f113bd0a5aa0fcbd527609600ebb693a5b27b0d02c`.
- EAS build: `01d81985-d151-478f-aef2-46ec0b13a259`.

## Migration

Clone the GitHub branch; release source and handover are pushed. Prior camera/parser/budget/widget/export files below are already tracked and released; no special untracked-file transfer is needed. Phone records and local credentials are separate from source migration.

On the new PC:

1. Install Git and a Node.js version compatible with the project's Expo SDK. Use `npm ci` against the existing lockfile; do not upgrade packages incidentally.
2. Open this repo as the Codex workspace; read this document, then `git status --short` and `git log -3 --oneline`.
3. Authenticate GitHub CLI (`gh auth login`) and EAS (`npx eas-cli login`) with the user's accounts. Credentials/session caches are not included in the source transfer.
4. Run `npx tsc --noEmit`. Start with `npx expo start` for JS development. Native modules/widgets/manifest changes require a native APK.
5. Android signing is managed by EAS remote credentials. Reuse them; do not generate a different signing key or change the package name, otherwise installed-app updates may fail.

Firebase backend configuration exists in source. Do not paste credentials, tokens, private keys or environment secrets into handover/chat. Firebase CLI login is only needed for backend operations. App data on the phone is separate from this PC migration; moving source does not transfer phone records.

## Earlier feedback fixes — released, do not redo

These changes are already included in v2.9.12. Device verification caveats remain valid; old no-build instructions do not override the current release request.

### 1. Food Camera/Gallery fails through launcher shortcut

File: `screens/TodayScreen.tsx`.

User clarified Camera/Gallery work after opening the app normally, but fail when entering via app-icon quick action. Feature and native permission/plugin were still present.

The v2.9.10 delay mitigation failed on the user's phone. Released change removes shortcut-specific delays/InteractionManager. Quick actions wait for a focused Log screen and active app. Native picker requests are queued until the source dialogs have unmounted, then launched with a busy guard. Camera checks existing permission first instead of always opening a redundant permission request; gallery uses the system photo picker without a broad library permission request. Picker failures display their actual error rather than only a generic permissions message. Food and activity share this path.

**Cause remains unconfirmed on the phone.** Earlier assistant overstated confirmation. Test cold launch AND warm launch via shortcut, Camera AND Gallery, normal launch, cancel and retry, first-time permissions and denied permissions. Do not equate TypeScript success with device verification. No phone is connected locally; if this still fails collect Android logcat around the tap and permission/activity transitions.

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

### Additional released work

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
- Reminder Save creates a schedule, not an immediate ledger row. Auto-log materializes once when due. Both modes request notifications. Native AlarmManager/Headless JS supports closed-app processing, with resume catch-up; exact permission, force-stop and OEM restrictions mean universal exact delivery is not guaranteed.
- Widgets: Daily, Account Snapshot (per-instance account), Cash Reality, Quick Log, Automation & Bills. No agenda in Daily widget. Widgets require native build for launcher verification.
- Health Connect workout import removed by request; user logs workouts manually. Keep steps/sleep/heart-rate features. Barcode engine was removed; do not reintroduce it.
- UI: use established LeanLog cream/navy/mint/coral aesthetic, serif editorial headings and clean standard icons. Avoid emoji-heavy generic cards/pills. Body Timeline and monthly mirror photos are merged; photo-less weight logs collapsed by default.

## Build and GitHub release convention

When user says **build**, they mean build AND commit/push AND GitHub release with APK. Do not stop after EAS submission unless user explicitly says they will follow up when ready. The v2.9.13 request is complete; do not start another build without a new request.

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

Read `git status --short` and the v2.9.13 section first. Confirm release metadata below when available, then resume the newest user feedback. Do not equate TypeScript or in-memory replay success with phone verification. Preserve user data and adjustments.
