# Bluecoins multi-select audit — 5 October 2026

Reference: local Bluecoins v13.1.65 (Premium).apk, read-only JADX output in `C:/Users/C5407836/Documents/Codex/2026-09-24/bro-2/bluecoins-apk-audit`. `resources/AndroidManifest.xml:4` confirms version 13.1.65. This is static APK inspection, not an interactive device test.

## Confirmed actions

- Select All and Copy appear in the selected-mode action list in `sources/com/rammigsoftware/bluecoins/accounts/AccountTransactionsKt.java:576`. The normal list has Filter and Print. Do not claim Print is a selected-mode action based on this evidence.
- Shared multi-select dispatch in `basefeature/multiselect/MultiSelectAppBarControlKt$MultiSelectAppBarControl$3$1.java` handles Select All, Paste, batch Change Name, Date, Category, Account, Amount, Add Labels, Reconcile/Status, and Delete.
- `MultiSelectAppBarControlKt.java` implements labels removal, optional replacement of existing labels before applying new ones, and a status picker. Deletion has a confirmation.
- `MultiSelectAppBarControlViewModel.java` calls corresponding independent batch use cases, including BatchCopyTransaction. Copy/paste is a transaction duplication flow, not merely copying a displayed RM total.
- Shared dispatch excludes Void amounts from Bluecoins' Select All sum. LeanLog does not currently model that same status set; this audit does not add Bluecoins accounting semantics silently.

## Implemented in this request

Ledger TOTALS opens a read-only summary of the full current search/filter set: entry count, Income, Expense, Transfer and Net (Income minus Expense). Transfers count once, even when both source and destination accounts are selected. Matching future-dated rows are included and explicitly disclosed. Manual-selection totals use the same summary. Select All uses the complete matching set instead of the currently paginated rows.

## Subsequent implementation (same day, user-approved)

All listed batch action groups are implemented through `components/RedCoinsBatchModal.tsx` and `services/redcoinsBatch.ts`: title/date/amount/source and destination account/category, label add/replace/remove/clear, Pending/Cleared/Reconciled status, Copy/Paste, permanent deletion. Void is not offered: LeanLog does not model Bluecoins' void accounting. Status changes are review metadata, not a second balance movement.

The entire selected set is validated before a cloned state is changed. Mutations require review confirmation; deletion cannot restore and does not cancel associated recurring schedules. Dates preserve local time; future entries do not affect current account balances. Copy persists an internal transaction snapshot; paste gets fresh IDs and clears recurring/export/reconciliation metadata. Paste can use original dates or a chosen date. Explicit copy identity prevents source refresh from mistaking it for an accidental duplicate.

Persistence publishes state changes to ledger, budgets, guards and widgets; SQL indexing follows successful saves. Reconciled local edits suppress their old imported counterpart; edited imported amounts/categories produce old-to-new deltas in the Home budget coach. Batch UI/device behavior still needs APK testing.
