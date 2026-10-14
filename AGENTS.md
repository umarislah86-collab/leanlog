# LeanLog release workflow

Standing user instruction (14 October 2026): every request to build an APK also
authorizes pushing source and publishing the APK to GitHub Releases, updating
the public GitHub Pages landing page, and updating HANDOVER.md. Complete all
steps together unless the user explicitly narrows the request.

Latest user override (14 October 2026, after 3.0.9 phone failures): use EAS cloud
builds on umiaq / umiaqs-team again. Do not use local builds unless requested.
Synchronize the remote Android counter above locally distributed codes first.
Record elapsed wall-clock time for the full build command (prebuild through APK
verification) and Gradle time separately for local builds. For EAS, record
submission-to-completion and the reported queue/worker durations separately;
do not present the no-wait submission command as the full build duration.
Keep tests/setup/publication outside
the build-command measurement. Append each result to docs/build-timings.json. Verify original signing identity/package/version,
ARM64 ABI, embedded JS and non-debuggable release before publication.
Local build toolchain/workflow removed at user request. Never recreate it without
an explicit request. APK verifier: scripts/verify-android-apk.py.
Never commit signing credentials. See docs/android-release.md.

Public site uses master/root at https://umarislah86-collab.github.io/leanlog/.
Work in ../leanlog-pages, preserve existing design/assets, refresh feature copy
and public APK link, verify Pages deployment, and mirror web changes onto this
app branch so later merges cannot revert the landing page. Do not advertise
unpublished local proof APKs as public releases.
