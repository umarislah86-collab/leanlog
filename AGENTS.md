# LeanLog release workflow

Standing user instruction (14 October 2026): every request to build an APK also
authorizes pushing source and publishing the APK to GitHub Releases, updating
the public GitHub Pages landing page, and updating HANDOVER.md. Complete all
steps together unless the user explicitly narrows the request.

Build locally using npm run build:local; do not consume an EAS cloud build slot.
Record elapsed wall-clock time for the full build command (prebuild through APK
verification) and Gradle time separately. Keep tests/setup/publication outside
the build-command measurement. Verify original signing identity/package/version,
ARM64 ABI, embedded JS and non-debuggable release before publication.
Never commit signing credentials. See docs/local-android-build.md.

Public site uses master/root at https://umarislah86-collab.github.io/leanlog/.
Work in ../leanlog-pages, preserve existing design/assets, refresh feature copy
and public APK link, verify Pages deployment, and mirror web changes onto this
app branch so later merges cannot revert the landing page. Do not advertise
unpublished local proof APKs as public releases.
