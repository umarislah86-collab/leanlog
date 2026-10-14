# LeanLog — latest published release v3.0.10 (EAS)

## User-confirmed recovery and local build removal — 14 October 2026

User confirms EAS3.0.10 resolves all reported slow boot, Android Back and
cloud upload problems. This is device feedback, superseding the pending-QC
status below. Exact technical reason for local/EAS divergence remains unknown.

User requested all local APK compiler setup removed. Completed:
- Deleted %LOCALAPPDATA%\LeanLogBuild SDK/JDK/tool downloads, ~/.gradle,
  generated repo android/, .local-build/, native module build/.cxx/.gradle
  outputs, local proof APK copies3.0.7-local44/3.0.8/3.0.9 and build junction.
- Disk free increased10,291,068,928 bytes (10.29GB /9.58GiB), measured before
  and after deletion. Audit ../../outputs/local-build-cleanup-result.json.
- Removed npm build:local, local build PowerShell/init scripts and setup doc.
  Generic APK verifier retained as scripts/verify-android-apk.py for EAS.
- Source, JS dependencies, Expo Go QC and EAS3.0.10 APK retained. Original
  recovery signing copy (about4KB) preserved at %LOCALAPPDATA%\LeanLogSigning,
  with existing ACLs and DPAPI encryption. EAS remote credentials unchanged.
- EAS-only workflow documented in docs/android-release.md and AGENTS.md.
  Historical local notes below describe deleted experiments, not current setup.
- Small SDK repository metadata remains in C:\Users\Taqip\.android; automatic
  approval review rejected its removal, including a more limited file cleanup.
  SDK/JDK/compiler and large caches are removed. Do not report this metadata
  folder as deleted or bypass the rejection.

## Release 3.0.10 — 14 October 2026; phone issues NOT yet confirmed resolved

User tested3.0.9 and reports boot still extremely slow, Android Back still
unresponsive and cloud upload remains0/25. Prior361 tests/verification did not
establish successful device runtime. User explicitly requested return to EAS;
AGENTS.md now makes EAS on umiaq/umiaqs-team the default. Do not use local builds
again without a new request. Do not claim PC compilation was proven to be cause.

- Clean EAS rebuild of the SAME application logic as3.0.9, with a new version
  and counter. No further speculative runtime fixes added. Dependencies remain
  Expo57.0.12 / RN0.86.2 and corrected locked tarballs.
- EAS build e1506ce5-c313-4390-8496-dbead9356c9c, preview-arm64, clear-cache.
  https://expo.dev/accounts/umiaqs-team/projects/umarcoc93/builds/e1506ce5-c313-4390-8496-dbead9356c9c
  Source d4da42220cd1bf064ee5fc3ba2ea316e9f072e79. Log confirms clean prebuild
  and661 tasks executed. Remote counter set46 before auto-increment to47.
- APK https://github.com/umarislah86-collab/leanlog/releases/download/v3.0.10/leanlog-V3.0.10.apk
  Local ../../outputs/leanlog-V3.0.10.apk;48,426,094 bytes.
  SHA256193d6da661ae1cd1e0e3b3c835123ae841494e8525119e3391c6d9480b3033c9.
  Original signer62a8aa1dd325bbe4b76855f4f3cc239950c4133b76ff904244cad6c78695161c,
  V2 signature/content digest, ZIP CRC, com.calorietracker.app,3.0.10/47,
  ARM64-only, non-debuggable and embedded JS verified. GH hash/size matched;
  public download HEAD200. Install as update without uninstalling.
- Timing: EAS worker448.178s (7m28.178s), queue4.649s, wait1.271s.
  Gradle6m31s; phase392.041s. Server created-to-completed454.098s;
  submission-start-to-completion504.785s (archive/upload/fingerprint included).
  Differs from local command timing; download verification/publication excluded.
  See docs/build-timings.json and ../../outputs/leanlog-3.0.10-build-timing.json.
- 361 tests and TypeScript passed. No physical-device verification; Back/boot
  and upload0/25 remain open until this EAS APK is tested. Unknown why the prior
  upload timeout was not observed on the phone.
- Source/release pushed; landing master13e4c1a points to3.0.10, mirrored here.
  Public https://umarislah86-collab.github.io/leanlog/.
- Current remote/app baseline47; next EAS48. Local counter file remains46,
  but app baseline47 keeps any future authorized local build above47.

## Release 3.0.9 published — 14 October 2026

- APK: https://github.com/umarislah86-collab/leanlog/releases/download/v3.0.9/leanlog-V3.0.9.apk
  Version3.0.9/code46; exact build-start source cd9c5ea3e6d6adab135d8493ff4c3758426ee7a7.
  Local ../../outputs/leanlog-V3.0.9.apk; 48,979,946 bytes.
  SHA256 f03d31782bb9f8cd459328791ac0558536c112b6bc86f802472540aac4a14af9.
- Full npm run build:local: 801.9392523 seconds (13m21.94s), UTC
  2026-10-14T02:57:25.6242273Z to03:10:47.6736622Z (10:57–11:10 Singapore).
  Includes prebuild, Gradle, APK verification; excludes npm ci, tests and publishing.
  Gradle12m50s; all661 tasks executed after dependency reinstall. No EAS slot used.
- Restored dependencies with npm ci: Expo57.0.12 / RN0.86.2. Seven stale
  lockfile version labels were corrected to match their already-existing
  resolved tarball/integrity and installed manifests; no package content changed
  during build. See ../../outputs/leanlog-3.0.9-dependencies.json.
- Original signer62a8aa1dd325bbe4b76855f4f3cc239950c4133b76ff904244cad6c78695161c,
  V2 signature/content digest, ZIP CRC, package com.calorietracker.app, version/code,
  ARM64 ABI, non-debuggable and embedded JS verified. Bundle includes the new
  startup timeout and pending-upload messages. GitHub asset hash/size matched,
  public download HEAD200.
- 361 tests, TypeScript and diff checks passed. No physical Xiaomi runtime test
  or live user-account Firebase reproduction. PC compilation is not established
  as the cause; dependency drift was real and has now been resolved.
- Back: Today, Progress, Settings native Modals handle onRequestClose; tab
  history is enabled and RedCoins exits through navigation history. Native
  predictive-Back opt-out already existed; it was not changed.
- Startup: valid empty histories no longer trigger restore every launch;
  tabs mount lazily and stored theme renders before optional fonts finish.
  Restore/license calls have12-second limits and retry UI. Late restore checks
  account identity before applying. Actual phone startup improvement unmeasured.
- Cloud upload: removed duplicate individual-record phase, shows completed/total,
  returns an unconfirmed-upload error at60 seconds. Submitted Firebase writes
  cannot be cancelled; later keys/metadata are gated after expiry and per-user
  retries blocked until the pending write settles. RedCoins remains excluded;
  JSON finance backup unchanged. A timeout is not confirmed backup success.
- Landing master912b992 updates download and cloud guidance; mirrored index.html
  on this app branch. Public https://umarislah86-collab.github.io/leanlog/.
- App baseline/local counter46; next local47. EAS remote last synchronized44:
  synchronize to at least46 before using an EAS build again.

## Release 3.0.8 published — 14 October 2026

Complete: locally built, original signature verified, GitHub release published
and landing page refreshed. Standing user instruction persisted in AGENTS.md:
future APK requests include local build, GitHub source/release, website and
handover together; timings recorded separately and appended to docs/build-timings.json.

- 3.0.8 / versionCode45, exact built source55ad79158761a962936e3185fe93767edfdbc69d.
- Full npm run build:local: 361.1916276 seconds (6m1.19s), includes prebuild,
  Gradle and APK verification; excludes tests/setup/publication. UTC start
  2026-10-14T01:44:33.5329813Z, end01:50:34.7330463Z (09:44:33–09:50:34 Singapore).
  Gradle5m27s; 661 actionable tasks:32 executed,629 up-to-date.
- APK https://github.com/umarislah86-collab/leanlog/releases/download/v3.0.8/leanlog-V3.0.8.apk ;
  local ../../outputs/leanlog-V3.0.8.apk (48,972,962 bytes).
  SHA2565bbab0d4592ec8e8ab4c4441e0e55a4fb9d4f35b7f321a56b5533ebf1d63676c.
- Verified original signer62a8aa1dd325bbe4b76855f4f3cc239950c4133b76ff904244cad6c78695161c,
  APK V2 signature/content digest, ZIP CRC, ARM64-only ABI, package
  com.calorietracker.app,3.0.8/45,non-debuggable and embedded standalone JS.
  GitHub asset size/digest match, tag exact built source and download HTTP200.
- 355 tests and TypeScript passed. Includes LeanLog-only cloud upload/restore and
  upload diagnostics. No real-user Firebase upload/restore or phone runtime test;
  old remote finance docs retained, not deleted; JSON finance backup unchanged.
- Landing https://umarislah86-collab.github.io/leanlog/ updated to3.0.8 public APK
  and LeanLog-only cloud/RedCoins JSON coverage. Pages master commit
  6a31d7a1851aba3501b4481ec6312e13d0a55ae6 confirmed built; mirrored04362e1
  to this app branch. Public footer/download/backup FAQ verified, no JS errors
  or desktop overflow. Proof ../../outputs/leanlog-3.0.8-landing-live.png.
- Baseline app.json/code and local state now45; next local auto-code46.
  EAS remote last synced44; sync>=45 before a future cloud build. No EAS build
  submitted for this release.
- Artifacts ../../outputs/leanlog-3.0.8-build-timing.json, local-build.log,
  tests.txt, apk-verification.json, github-release.json and release.md
  (all prefixed leanlog-3.0.8-).

## Included in 3.0.8 — exclude RedCoins from LeanLog cloud, 14 October 2026

User explicitly requested Upload Data to Cloud contain no RedCoins data.
Shared cloudBackupScope.ts excludes all redcoins*/bluecoins* storage namespaces
plus existing auth/cache/widget/device-runtime exclusions. Settings no longer
reads SQL RedCoins raw state, inserts ledger into fullState, or parses/replaces
RedCoins during cloud restore. Finance JSON export/restore untouched.

Defence in depth: fsUploadAppState filters payload even if another caller supplies
an old full-state object. fsFetchAppState filters legacy manifest keys BEFORE
downloading docs, so old finance payloads are not fetched/applied. Finance-only
legacy checkpoint returns null; normal old food/activity/weight fallback remains.
Settings applies only filtered LeanLog pairs. Budgets/payday/guards/receipt and
backup folder settings/layouts/recovery snapshots stay local/JSON. UI copy now
explicitly says LeanLog only and separate RedCoins JSON backup.

355 tests passed including four new tests for upload transport exclusion, mixed
legacy restore preserving local ledger/preferences, finance-only legacy metadata,
all JSON preferences/prefixes and retained LeanLog state. TypeScript passed.
No live Firebase upload/delete/deployment; existing remote financial documents
are retained, not purged. These scope and diagnostic changes are now in published
3.0.8; landing cloud coverage copy was updated with the release.

## Included in 3.0.8 — cloud upload diagnostics investigation, 14 October 2026

User reports Settings Upload Data to Cloud always shows generic Check internet.
Traced Settings upload: scans durable AsyncStorage keys, inserts live SQL RedCoins
state as redcoins_state_v1, writes individual food/activity/weight records and
profile/goal, then each full serialized storage key to one Firestore appState
document. Manifest latest written after those writes. Account auth required.
Media paths are metadata, not file uploads; Mirror photos are stored separately
directly in Firestore by Progress. Existing fsUpsert/settings helpers swallow
their own errors. Current checkpoint writes are mutable/non-atomic: a failed
upload can have partially written key documents; do not promise last-good snapshot
integrity or complete media portability.

Firestore's 1MiB per-document limit is a strong design-level candidate for growing
RedCoins/food/activity histories, but exact phone error and actual key sizes have
not been obtained. Deployed rules/quota/session/network not inspected. Source
rules permit account-owned appState; cannot equate source to deployed rules.

Added cloudBackupErrors.ts and wrapper on appState writes preserving Firebase
error code and failed key/UTF8 value byte count without attaching the payload.
Settings now shows distinct size/quota/permission/login/network/other failures,
rather than always blaming internet. Upload description narrowed to app records
and settings. Two diagnostic tests plus TypeScript pass. No chunking/snapshot protocol change or server writes/deployment. Diagnostic
changes were subsequently included in published APK3.0.8.

## Public website refreshed — 14 October 2026

Updated GitHub Pages master/root to public app release 3.0.7 (APK code39),
fourteen themes including Cutie, actual anime PNG previews and matching
Pirata One/Bangers headings. Retained existing generated hero/cardio artwork;
no old screenshots. Cutie public preview uses the supplied illustrated meal
sticker rather than a family portrait. All palettes re-exported from app source.

Explains Auto pace, active calories excluding resting energy, GPS signal gaps,
measured distance requirement for timer/Quick log, AM/PM and PG/PTG normalization,
local activity save confirmation and weight-chart contrast. Pricing rechecked:
RM7/month, RM49/year, 3-day trial. Local proof APK/code44 is not advertised as a
public release. APK CTA points to published GitHub v3.0.7 asset.

Live https://umarislah86-collab.github.io/leanlog/ ; master commit
4d46e92c8aed2fc046241eb50e866d5b09509921, Pages build confirmed built.
Mirror cherry-pick cb1f342 on github-release-v221 avoids reverting public files.
Browser verified public footer/date, APK link, 14 theme entries and Auto pace.
Local QA: every theme/art load, all five tabs, monthly pricing, no JS errors,
no desktop or 390px mobile horizontal overflow. No app APK build in this task.
Proof ../../outputs/leanlog-website-update-2026-10-14.png.

## Local Android build ready — 13 October 2026

User authorized setting up Windows APK builds without EAS cloud. Implemented
npm run build:local (scripts/build-local-android.ps1), local init Gradle worker
limits and scripts/verify-local-apk.py. docs/local-android-build.md has maintenance,
signing protection, environment and version-counter instructions.

- Tools under %LOCALAPPDATA%/LeanLogBuild: checksum-verified Temurin JDK 17,
  Android command-line tools 15859902, SDK 36, build tools 35/36, NDK 27.1.12297006,
  CMake 3.22.1/platform-tools. No Android Studio/emulator/system PATH change.
- Original EAS umiaq/umiaqs-team keystore downloaded once and moved outside Git.
  signing/ folder ACL current Windows user + SYSTEM only; passwords in signing.json
  are DPAPI-encrypted for this Windows user. Repository credentials.json removed.
  Do not expose, commit or move this metadata as a portable backup.
- Same-drive %USERPROFILE%/leanlog-local junction targets this checkout, avoiding
  mixed C:/L: Kotlin codegen roots. A drive-root alias also breaks Expo package
  lookup; do not reintroduce SUBST drive building. Build retains native caches.
- Gradle two workers/4GB heap, CMake Ninja pool two compile jobs per project,
  Metro two workers; native pool configuration verified. Explicit PSHOME Security
  import avoids npm inheriting incompatible PowerShell 7 module paths.
- Signed local 3.0.7 APKs verified: code 42 full build 13m01s, code 43 10m04s,
  final code 44 incremental build 2m24s (31 executed, 630 up-to-date). Failed setup
  attempts consumed 40/41; no cloud builds were submitted.
- Final APK .local-build/apks/leanlog-V3.0.7-local-44.apk, also copied to
  ../../outputs/leanlog-V3.0.7-local-44.apk; 48,970,866 bytes; SHA256
  2f94c39211087481c4f908044efbf1537648962026d9bcf985389422609ee242.
- Verified APK V2 signature/content digest, ZIP CRC, package com.calorietracker.app,
  3.0.7/44, ARM64-only, debuggable false and embedded standalone JS bundle.
  Original signer 62a8aa1dd325bbe4b76855f4f3cc239950c4133b76ff904244cad6c78695161c.
- Counter baseline app.json android.versionCode 44; local .local-build/version-state.json
  also 44, next local build auto-reserves 45. Named mutex rejects concurrent builds;
  failed attempts may leave gaps. Dev package scripts retained; env restored.
  EAS remote counter synchronized to 44 for fallback (not a cloud build).
- Generated android/, module Android build directories, .cxx/.gradle, local outputs
  and credentials ignored. No local APK published as a new GitHub release; public
  release remains v3.0.7/code39. Local proof APK installation/runtime not phone-tested.
- Proof uses installed Expo 57.0.27/RN0.86.2; existing lock still Expo57.0.12/RN0.86.2.
  Builder does not mutate/install dependencies. Before a locked production rebuild,
  npm ci then validate its native output; fresh npm-ci build not claimed verified.
- Logs ../../outputs/leanlog-local-build.log (code44), leanlog-local-build-code42.log,
  leanlog-local-build-code43.log; .apk.verification.json beside each artifact.
  Concurrent build rejection log ../../outputs/leanlog-local-lock-check.log.

## Release 3.0.7 published — native character artwork, 12 October 2026

Published and verified, user authorized APK and GitHub release.
- Exact built source: 4696bb7a4f538f5777910e1ee39e6b4c3ed69967, github-release-v221, pushed.
- EAS umiaq / umiaqs-team, preview-arm64, build 10cbcc6b-1b55-4e29-a069-1290604ee52b FINISHED; 3.0.7 / versionCode 39.
- APK: https://github.com/umarislah86-collab/leanlog/releases/download/v3.0.7/leanlog-V3.0.7.apk ; local ../../outputs/leanlog-V3.0.7.apk, 48,418,910 bytes.
- SHA256 9338ec44d0749c3bd99822fdae9632486114f76b242f1187dacd5cb6088ad468; GitHub published digest/size match, public download HTTP 200, tag matches built source.
- APK V2 signature/content digest, ZIP CRC, ARM64-only ABI, com.calorietracker.app and 3.0.7/39 verified. Original signer 62a8aa1dd325bbe4b76855f4f3cc239950c4133b76ff904244cad6c78695161c retained.
- 349 automated tests and TypeScript passed. Artifacts ../../outputs/leanlog-3.0.7-build.json, leanlog-3.0.7-apk-verification.json, leanlog-3.0.7-github-release.json, leanlog-3.0.7-tests.txt.
- Expo Go QC source synced. Runtime expo-notifications failure fixed in QC-only Metro resolver with qc/notifications.ts; Android bundle confirms native push listener absent. Session 84296, exp://p2n3imy-umiaq-8084.exp.direct while running, QR ../../outputs/leanlog-artwork-fix-qc-qr.png. Starts Home, header ARTWORK FIX QC. Native launcher visual confirmation remains pending.

User reports both anime themes render no character artwork, Cutie widget blank, and drawer artwork badly placed in installed 3.0.6. Previous desktop SVG rendering/headless tests did not verify Android pixels; do not claim that release's artwork works on device.

- Replaced raster-in-SvgXml app artwork with React Native Image (data PNG, contain). Other vector themes retain SvgXml.
- Replaced raster-in-SvgWidget widget artwork with ImageWidget, using native BitmapFactory-supported data PNG input. Widget alpha is baked into pixels at 24%; no SVG mask/image dependency.
- scripts/bundle-native-art.cjs flattens existing crop/fade/outline into transparent 320px PNGs, deduplicating the 15 characters/images. Generated services/nativeArtwork.ts is about 1.37MB. No new runtime image dependency/download.
- Drawer header uses a dedicated 64px character slot beside the title with shrink/wrap space and separate close action, replacing the clipped 140px bottom-positioned watermark.
- Existing 347 tests plus two new regressions pass: decode all 30 page/widget mappings and assert visible pixels, PNG dimensions, transparent edges and baked widget alpha; assert native app Image route and headless ImageWidget path. TypeScript and Android production export pass.
- Actual PNG review sheet ../../outputs/native-art-fix-preview.png visually inspected (asset sheet, not Android screenshot). Native phone/launcher confirmation still pending. Exact cause of the previous Android SVG failure has not been reproduced on a device; the failing image-in-SVG route is removed.
- Correction included in published 3.0.7. Regenerate using node scripts/bundle-native-art.cjs after changing source character/Cutie art.

## Release v3.0.6 published — 12 October 2026

Published and verified. Source dfd2cceb6e2bb64bcaa194e9d8536b9a116b345f, branch github-release-v221, pushed to origin.

- EAS umiaq / umiaqs-team; build d30a9ba7-81f1-41dc-b6fd-90cc270cf16d FINISHED, preview-arm64, version 3.0.6 / versionCode 38.
- APK https://github.com/umarislah86-collab/leanlog/releases/download/v3.0.6/leanlog-V3.0.6.apk; local ../../outputs/leanlog-V3.0.6.apk (47,048,802 bytes).
- SHA256 760bd5b9dcc61780e359930c4fe1f7a65b3d0d498d46aa94cb7c93872f7c4603.
- Verified APK V2 signature/content digest, ZIP CRC, ARM64 ABI, com.calorietracker.app and 3.0.6/38. Original signer 62a8aa1dd325bbe4b76855f4f3cc239950c4133b76ff904244cad6c78695161c retained.
- GitHub release tag points to exact built source; published asset size and SHA256 digest match local APK; public download HTTP 200 verified.
- Artifacts: ../../outputs/leanlog-3.0.6-build.json, leanlog-3.0.6-apk-verification.json, leanlog-3.0.6-github-release.json, leanlog-3.0.6-tests.txt.

- Cardio setup now uses Auto pace instead of choosing walk/jog/run. New sessions estimate active calories (subtract 1 MET resting energy) from accepted GPS segment speeds and latest logged weight at session start, using 2024 Adult Compendium level-ground speed bands. Signal gaps/stationary fixes are not filled with fixed Jog MET. Timer-only/Quick log requires measured distance. Old sessions retain their original calculation. Uniform 5.9km/62min/117kg regression gives 482 active kcal; mixed-pace GPS results can differ. Sources: https://pacompendium.com/walking/ and https://pacompendium.com/running/ . This approximation cannot identify actual gait, incline or heart-rate effort.
- Activity picker emits local HH:mm explicitly. Review/storage accept English AM/PM and Malay PG/PTG, normalize to 24h, and distinguish date/time validation errors. Save confirms local storage before closing. Today shows a saved-record banner with its date/time. Removed stale whole-array activity autosave from Today; create/edit/delete persist latest rows explicitly. activityStorage serializes its own writers; cardio/coach still use separate persistence paths. Original silent no-backdate disappearance was not reproduced; its cause is not proven.
- Progress WeightAreaChart chooses line/dot/fill ink with >=3:1 contrast against the actual hero card, including Arsenal/Liverpool.
- One Piece/Dragon Ball abstract portraits replaced with offline official character images: Luffy/Zoro/Sanji/Chopper and Goku/Vegeta/Piccolo/Gohan. Pages, drawer, native widgets and theme-preview icons select actual artwork. Original pixels framed using SVG viewBoxes and feathered edges; app portraits 32–42% opacity, widget 24%. Provenance: assets/theme-characters/SOURCES.md. Regenerate characterImageData.ts using scripts/bundle-character-art.cjs. No runtime image downloads. Actual Android launcher raster-in-SVG appearance requires phone QC; desktop SVG rendering and headless widget construction are verified.
- Cutie added as theme 14, using all seven user-supplied images from C:/Users/Taqip/Pictures/theme/cutie. Pink/cream surfaces, plum text/heroes, sunny yellow actions, sky-blue tints; bundled Manrope typography. Home pinkSky portrait, Log yummy, Progress cheer, Coach cool, drawer thumbsUp, daily widget/navigation wow, account widget sunshine. All native widget variants and the persistent Appearance preview support it through existing theme IDs. Artwork sources and regeneration instructions: assets/theme-cutie/SOURCES.md, scripts/bundle-cutie-art.cjs. Original stickers are preserved; an SVG outline clip hides their connected outer black canvas, retaining enclosed dark eyes/hair. Cutie app watermark 30%, native widget 24%; brightest-portrait-pixel text contrast covered. Preview artwork/palette contact sheet: outputs/cutie-theme-preview.png (not a phone screenshot). Included in the published 3.0.6 APK.
- Cutie contrast follow-up: SurfaceArtworkContext carries the bare background plus black/white image-pixel composites at 30% opacity. ThemeText and ThemeTextInput select ink readable across all those backgrounds (>=4.5:1), rather than checking only the plain card; placeholder text is included. Opaque child controls reset the painted background and translucent controls compose it. Boundaries cover Home header/briefing, Log/Progress/Coach pages, Settings drawer header, both navigation docks and candidate Appearance preview (even while Original is active). Widget tests also check black/white artwork pixels at 24%. Theme original artwork/palette remains intact; foreground ink adjusts as necessary.
- Validation: 347 automated tests passed; TypeScript passed. Android production export passed (1,355 modules; outputs/leanlog-cutie-android). Published 3.0.6 includes these changes; users must install the update. Native phone/launcher pixel QC remains pending.

## Public feature page — 12 October 2026

User requested a complete app feature/pricing page, fresh ImageGen artwork (no old screenshots), then explicitly requested hosting in their GitHub. Live public GitHub Pages: https://umarislah86-collab.github.io/leanlog/ . Hosting source is `master` root; page commit 62bf96a98aa61fc8e808ee9995537c72c012d431, Pages build confirmed built, actual public URL passed browser checks. Same web files cherry-picked onto github-release-v221 to prevent future branch merges reverting the page. No Android version/build change.

Web files: index.html, style.css, app.js, themes.js, page-assets/, .nojekyll; LANDING_PAGE.md documents maintenance. Feature tour, complete expandable directory, cardio, 13 real theme palettes/motifs, five widgets, RM7/month or RM49/year, 3-day trial/paywall, manual payment/activation, APK v3.0.5 download and WhatsApp links. Demo data explicitly labelled. Real receipt-folder/Drive and local-media backup limits stated.

QA on the public URL: 320/375/390/768/1440px, all five tabs + keyboard arrows, example protein history, all 13 themes, both pricing choices, nine directory groups and FAQ. No horizontal overflow, JS errors, missing images or HTTP asset failures. Editable local source, original generated artwork and prompts retained at ../../sites/leanlog-guide; generated WebP images are committed in page-assets. An earlier private Sites registration was created during initial preparation, but no Sites deployment was started; the user's selected hosting is GitHub Pages.

## Previous release v3.0.5

Published 12 October 2026 (Asia/Singapore). User authorized build and push after watermark visibility correction; complete. The stronger-watermark section below is included in this release.

- Source 9051be11dec733cd128acc646df3bd98928632e8, branch github-release-v221, pushed to origin.
- EAS umiaq / umiaqs-team, build 32bca635-84f8-4c60-8959-7935878099af FINISHED; preview-arm64, 3.0.5 / versionCode 37.
- APK https://github.com/umarislah86-collab/leanlog/releases/download/v3.0.5/leanlog-V3.0.5.apk; local ../../outputs/leanlog-V3.0.5.apk (44,567,766 bytes).
- SHA256 441c5825bcf44551287c3c8eaff385658b509ac6784741bcdb53d4571193f5f6.
- Verified V2 signature/content digest, ZIP CRC, ARM64 ABI, com.calorietracker.app and 3.0.5/37. Original signer 62a8aa1dd325bbe4b76855f4f3cc239950c4133b76ff904244cad6c78695161c retained.
- Includes larger central theme motifs, 280dp Home/page and 140dp card/drawer artwork, opacity 18–24%, measured dock zoom/crop at 20%, larger top-aligned widget motif at 24%, and text contrast correction on both plain and painted widget areas. All 13 themes covered; Chronicle 3.0.5.
- 336 automated tests, production/QC TypeScript and Android QC bundle passed. GitHub asset size/digest and HTTP download verified. Physical phone watermark/crop/launcher acceptance remains pending; do not claim native pixel verification.
- Artifacts: ../../outputs/leanlog-3.0.5-build.json, leanlog-3.0.5-apk-verification.json, leanlog-3.0.5-github-release.json, leanlog-3.0.5-tests.txt.

## Current unreleased — stronger watermark visibility and dock crop (12 October 2026)

User screenshots of 3.0.4 show nearly invisible artwork and tiny dock emblem. Increased shared artwork central motif bounds from 40/64 to 56/64 (club aspect preserved), Home/page artwork from 220 to 280dp, card/drawer from 76 to 140dp. Opacity Home 24%, page/card 18%, dock 20% (previous 4.5–10%). Dock measures its own height and sizes/centres the SVG so approximately two-thirds of the central emblem height is visible; wide Arsenal cannon gets a larger SVG box to match other themes. All 13 themes share these rules. Widget watermark now 150dp (short Quick Log 90dp), 24% SVG group opacity instead of 7.5%; top alignment and negative top offset expose the artwork in header space rather than hiding it behind filled account/guard cells. Foreground text colour checks now retain contrast on both plain background and the fully painted watermark stroke, tracking each opaque child surface separately. No row/height/action changes; artwork remains excluded from touch/accessibility. Main/QC source synced. No new APK requested for this correction; published APK remains 3.0.4, physical acceptance pending.

# LeanLog — latest published release v3.0.4

Published 12 October 2026 (Asia/Singapore). User authorized build and GitHub publication after anime themes, per-surface artwork and matching typography; complete. All watermark/theme sections immediately below are included and superseded by this release record.

- Source 132030d8dafc4e0a78d405eb75c0483d29030b09, branch github-release-v221, pushed to origin.
- EAS umiaq / umiaqs-team, build bc4eda43-3603-4a1b-8c35-987e7787051e FINISHED; preview-arm64, 3.0.4 / versionCode 36.
- APK https://github.com/umarislah86-collab/leanlog/releases/download/v3.0.4/leanlog-V3.0.4.apk; local ../../outputs/leanlog-V3.0.4.apk (44,566,590 bytes).
- SHA256 c9228fd58c1a479795dc1b9fc70fc206c7ca3ef8f0fbf8961f08e479b07c2f2c.
- Verified V2 signature/content digest, ZIP CRC, ARM64 ABI, com.calorietracker.app and 3.0.4/36. Original signer 62a8aa1dd325bbe4b76855f4f3cc239950c4133b76ff904244cad6c78695161c retained.
- Includes Grand Line / One Piece and Saiyan / Dragon Ball (13 total), bundled Pirata One/Bangers headings, readable body/numbers, different line-art characters on Log/Progress/Coach/drawer, matching motif compositions per surface for all themes, and background watermarks on Home/navigation/all five launcher widgets.
- Native widget font assets verified inside APK: eleven TTFs including Pirata One and Bangers. Both fonts' OFL licences included in Appearance credits; single regular heading faces resolve all requested weights.
- 336 automated tests, production/QC TypeScript and Android QC bundle passed. All-theme widget contrast includes watermark strokes behind text. GitHub release asset size/digest and HTTP download verified. Physical phone visual acceptance remains pending.
- Handover/artifacts: ../../outputs/leanlog-3.0.4-build.json, leanlog-3.0.4-apk-verification.json, leanlog-3.0.4-github-release.json, leanlog-3.0.4-tests.txt, leanlog-3.0.4-qc.android.bundle, leanlog-anime-artwork.png.
- QC folder synced, Metro running LAN on port 8084 (old tunnel stopped; ngrok package unavailable following npm install). Start local QC using npm start; do not promise previous tunnel URL is live.

## Current unreleased — anime themes and artwork per surface (12 October 2026)

Added Grand Line / One Piece (parchment/navy/straw-gold/pirate-red, Lora/Manrope/Space Grotesk) and Saiyan / Dragon Ball (deep blue/orange/gold, Space Grotesk/Manrope). Total 13 themes. Native app, pinned appearance preview, launcher widgets and offline preferences share the palettes. Bundled original line-art character interpretations: Grand Line Log=Luffy, Progress=Zoro, Coach=Sanji, drawer=Chopper; Saiyan Log=Goku, Progress=Vegeta, Coach=Piccolo, drawer=Shenron. Home uses straw-hat compass/four-star orb. No remote artwork/fonts. Every theme now gets a distinct composition per surface (Home, Log, Progress, Coach, drawer, Daily/Account/Cash/Quick/Upcoming widgets) while retaining its central motif; original club SVG proportions preserved. Watermark remains behind content with prior touch/accessibility exclusions. Anime contact sheet ../../outputs/leanlog-anime-artwork.png shows vector artwork at full opacity for inspection, not actual watermark intensity. 336 tests including 13-theme surface/widget contrast and distinct per-surface artwork. Main/QC TypeScript and QC Android bundle validation; physical visual acceptance pending. No build requested; published APK remains 3.0.3 and all watermark patches above it are unreleased.

## Current unreleased — motifs on Log, Progress and Coach (12 October 2026)

Extended the shared active-theme watermark to Log (TodayScreen), Progress and Coach backgrounds for all eleven themes. Large 220dp motif at top/right with 4.5% opacity, clipped within the screen, behind content and hidden from touch/accessibility. Log/Progress header fill is transparent over the existing identical screen background so it does not hide the motif. Cards remain opaque for reading; navigation, log/graph/workout data and controls unchanged. Expo Go QC synced. No new APK requested; published version remains 3.0.3, earlier widget/Home watermark changes also pending release.

## Current unreleased — Home greeting and navigation watermark (12 October 2026)

User marked the Home greeting background and bottom navigation area, requesting theme motifs there for every theme. Shared ThemeWatermark now has home/dock/card placements. Home greeting uses large 220dp right-aligned artwork at 4.5% opacity; main navigation uses 110dp at 4.5%, with a matching hero-colour motif within the animated RedCoins dock. Watermarks paint behind content, clip within their host, ignore touches and hide from accessibility. Header spacing, navigation actions, dock motion and large + remain unchanged. All eleven themes use the active palette's shared motif. Synced Expo Go QC; Android visual acceptance pending. No APK build requested for this addition; published 3.0.3 unchanged. Background widget correction below also unreleased.

## Current unreleased — widget background watermark correction (12 October 2026)

User clarified that motifs should be subtle backgrounds, not inline header icons. Replaced all five widget types' inline symbols with a shared OverlapWidget (native FrameLayout) background: right-centred SVG watermark, 7.5% group opacity, 76dp tall normally, 48dp cannon, 42dp short Quick Log. Original widget content stays in a foreground layer with original padding, text, rows and click actions; the painted rounded background moves to outer frame, and no opaque foreground root hides the motif. Cash Reality uses hero motif colours. No extra header row or icon width. All eleven themes covered by headless tree tests checking background-first ordering, foreground transparency, alpha and no motif click action, plus existing values/actions/grid checks. Text contrast checks include a fully painted watermark stroke behind text; foreground colours adjust lightness only where required to retain 4.5:1. 335 tests and production TypeScript passed. Native launcher visual QC requires next APK; Expo Go cannot show Android launcher widgets. No new build requested for this correction; published 3.0.3 still has inline icons.

# LeanLog — latest published release v3.0.3

Published 12 October 2026 (Asia/Singapore). User authorized APK build and GitHub publication; complete. The persistent drawer and all-theme motif sections below are included in this release.

- Source 4ea1d90d4e9e303f442064310da4ffa30e85c680, branch github-release-v221, pushed to origin.
- EAS umiaq / umiaqs-team, build c0ff0a13-2465-4684-86be-028df89aa61f FINISHED; preview-arm64, 3.0.3 / versionCode 35.
- APK https://github.com/umarislah86-collab/leanlog/releases/download/v3.0.3/leanlog-V3.0.3.apk; local ../../outputs/leanlog-V3.0.3.apk (44,417,980 bytes).
- SHA256 6b36a4d87e02a3afdce72b87aad7619b037cd4d551f0cad5197a094e50373dff.
- Verified V2 signature/content digest, ZIP CRC, ARM64 ABI, package com.calorietracker.app and version 3.0.3/35. Original signer 62a8aa1dd325bbe4b76855f4f3cc239950c4133b76ff904244cad6c78695161c retained.
- Includes persistent Settings drawer, shared motifs for all eleven themes on Home/Settings/preview and all five native widgets, Chronicle 3.0.3.
- 335 automated tests, production/QC TypeScript and Android QC bundle passed. GitHub published asset size and HTTP download checked. Physical phone drawer timing and native launcher visual acceptance remain pending.
- Verification files: ../../outputs/leanlog-3.0.3-build.json, leanlog-3.0.3-apk-verification.json, leanlog-3.0.3-github-release.json and leanlog-3.0.3-tests.txt.

## Current unreleased — identity for every theme (12 October 2026)

All eleven themes now share offline vector motifs across Home Daily Briefing, Settings drawer header, pinned appearance preview, theme list thumbnails and all five native widget types. Original: sunrise; Midnight: crescent; Soft Neutral: balanced stones; Grove: leaf; Dusk: orbit; Folio: quill; Onyx: diamond; Cyberpunk: original neon circuit; Arabia: original geometric arabesque; Arsenal/Liverpool retain sourced cannon/Liver bird. Arabia uses geometry rather than arbitrary calligraphy, Cyberpunk uses original art rather than a game logo. Shared services/themeMotifs.ts provides palette-coloured XML; native SvgWidget needs no network or asset resolution. Decorative watermarks ignore touches/accessibility and use low opacity; widget symbols remain in existing rows. 335 tests pass, including all-theme widget trees/contrast and distinct offline motif XML. Main/QC TypeScript checked; actual Android launcher and drawer performance QC still pending. No new APK/release requested; published version remains 3.0.2.

## Current unreleased — club emblems on widgets (12 October 2026)

User requested Arsenal/Liverpool emblems on matching launcher widgets. Added small inline SVG cannon/Liver bird using the same sourced club assets to all five widget types (Daily, Account, Cash Reality, Quick Log, Upcoming). Red emblem on light surfaces, gold on Cash Reality hero. Emblems sit in existing header rows; no new branding row on Daily, figures and quick actions retained. SvgWidget gets inline XML so headless rendering needs no network/asset resolution. Superseded by the all-theme motif extension above. 334 tests including all-theme headless trees/contrast and club-only emblem coverage pass; main/QC TypeScript checked. Actual launcher visual QC pending; Expo Go cannot render native Android widgets. Persistent drawer fix below also unreleased; public APK remains 3.0.2.

## Current unreleased — persistent Settings drawer (12 October 2026)

User measured approximately 2 seconds opening delay on 3.0.2. Previous architecture still mounted a native Modal and waited for onShow, then remounted Settings after every animation. Replaced native Modal with always-mounted absolute sibling overlay inside the main tabs container. Native opacity/translate animation starts directly in the press callback. Settings warms offscreen once after startup and remains mounted across closes; memoized props/API preserve the content/tab trees on ordinary opens. A very early cold tap shows lightweight shell immediately and fills Settings after animation. Import intent commits after animation so it cannot burden initial slide. BackHandler/backdrop/Close work; closed drawer has pointerEvents none and hidden accessibility descendants; underlying tabs are accessibility-hidden while open. Panel width follows window dimensions. Close still emits one refresh revision. No device timing has been measured for this patch; do not claim a verified millisecond opening time.

333 tests pass including persistent content, direct animation scheduling, context identity, warm/cold opens, import intent, Back, duplicate close and late callbacks. Main/QC TypeScript and Android QC bundle checked. Public APK remains 3.0.2; new APK not yet requested/built.

# LeanLog — latest published release v3.0.2

Published 12 October 2026 (Asia/Singapore). User authorized build and GitHub publication; complete. All historical unreleased sections below are included in 3.0.2 and superseded by this record.

- Source b5cf0ab7ab0406b9a87df96a36627df5d7a7b83a, branch github-release-v221, pushed to origin.
- EAS umiaq / umiaqs-team, build 3b6b83f4-7609-4759-b2cf-b9f4d8ca29e7 FINISHED; preview-arm64, 3.0.2 / versionCode 34.
- APK https://github.com/umarislah86-collab/leanlog/releases/download/v3.0.2/leanlog-V3.0.2.apk ; local ../../outputs/leanlog-V3.0.2.apk (44,408,096 bytes).
- SHA256 dbdb23395228c52b92ffa4b2c6f045186d0d614610cd7d27647d435f148a866e.
- Verified APK V2 signature/content digest, ZIP CRC, ARM64 ABI, com.calorietracker.app and version 3.0.2/34. Original signer 62a8aa1dd325bbe4b76855f4f3cc239950c4133b76ff904244cad6c78695161c retained. Verification ../../outputs/leanlog-3.0.2-apk-verification.json.
- Includes direct Settings side drawer and opening/render improvements, surface-aware text/input-placeholder contrast, today's Mi Fitness steps preference/Health Connect fallback and Home source label, all saved categories/subcategories for Income/Expense, Chronicle v3.0.2.
- 333 automated tests + production/QC TypeScript and Android QC bundle passed. Native phone visual/performance and Health Connect acceptance remain pending. Release file availability checked after publication.

## Current unreleased — shared income/expense category picker (12 October 2026)

User requested all saved categories/subcategories available for both income and expense. loggerCategories now returns the complete saved tree for both types, including unused/unclassified categories; transfer keeps its existing category-free behaviour. Existing manual logger, edit/schedule, bulk category choices and copy validation all consume this helper. Type metadata is preserved for import/report data; transaction amount/balance direction remains based on entry type. Regression tests updated for complete tree/no mutation and authoritative restore. No APK build/publication requested for this patch; public APK still 3.0.1.

## Current unreleased — surface-aware text contrast (12 October 2026)

User confirmed unreadable fonts in Arsenal/Liverpool/Arabia. Existing palette-only colour aliases cannot know whether an inherited white/gold label sits on a light card or a filled button. Added lightweight ThemeSurfaces adapters (same native View/TouchableOpacity/Pressable/ScrollView/SafeAreaView and dock Animated.View) to provide the actual solid/alpha-composited background to ThemeText/TextInput. No geometry/event/ref changes. Readable colours retain their exact value; failing foregrounds adjust lightness toward black/white to 4.5:1, preserving hue. Input placeholders use the same actual input fill. Nested text retains inheritance, candidate preview keeps explicit sample colours, Original remains literal. Widgets keep their existing independently tested mappings. All app screen/shared surface imports updated, structural RedCoins pager cells remain native.

New component-runtime tests cover every non-original palette on eleven surface colours with ten foreground colours each, alpha/nested surfaces, input editing/ref/selection/placeholder and Pressable pressed callbacks. Existing drawer/dock/pager/ledger checks preserved. Physical Android visual acceptance still pending; disabled/animated opacity and image backgrounds are not guaranteed by solid-colour contrast checks. Public APK remains 3.0.1; no release requested for this patch. Drawer/steps fixes below also unreleased.

## Current unreleased — today's steps source fallback (12 October 2026)

Steps now discovers positive Mi Fitness step records inside today's local-midnight-to-now interval, reads subsequent pages and does not select generic wearable package names. No current Mi records -> unfiltered Health Connect Steps aggregate. Missing/zero/failed Mi aggregate -> same fallback. No manual summation of sources. Each snapshot checks afresh so later watch sync is selected on next refresh. Sleep/heart retain prior independent source choice; sourceLabel describes steps and Home displays it. All 332 tests pass, including yesterday-only source, pagination, zero/stale/unrelated records, aggregate/discovery errors, later sync and sleep independence. Production/QC TypeScript checked. Native device Health Connect acceptance pending; public APK remains 3.0.1. Direct Settings drawer fix also remains unreleased below.

## Current unreleased — direct Settings drawer and opening latency (12 October 2026)

User reported slow hamburger opening and requested Settings content only, no duplicate app tab routes. AppMenuContext now opens the same 92%-width/max480 side panel directly for hamburger and openSettings/import links. Removed intermediary menu/routes and native modal fade; 160ms native-driver slide starts on Modal onShow. First Settings mount defers until slide completion; close cancels animation/late mount. Memoized menu API remains identical during open/content-ready, preventing menu-context consumers across all tabs from invalidating. Closing still increments revision once for data refresh; Android Back and backdrop close drawer. No runtime stopwatch/native phone performance measured yet.

Settings uses compact drawer header with Close, bottom safe-area and scrollable existing sections; club watermark retained in header. Large +/main navigation unchanged. All 327 tests pass including stable context identity, direct content, import intent, early-close race and no duplicate refresh. Production/QC TypeScript and Android QC bundle checked. Public APK remains 3.0.1; this patch not yet built/published.

# LeanLog — latest published release v3.0.1

Published 12 October 2026 (Asia/Singapore). User authorized build and GitHub push; release complete. Historical unreleased sections below are included in 3.0.1 and superseded by this record.

- Source commit: a78344de572a50000de26fab1d52dcb6a53a9173 (following f93a65f), branch github-release-v221, pushed to origin.
- EAS umiaq / umiaqs-team, build 1dd26644-1d31-4a9d-947a-5225e441b677 FINISHED, preview-arm64, version 3.0.1 / versionCode 33.
- APK: https://github.com/umarislah86-collab/leanlog/releases/download/v3.0.1/leanlog-V3.0.1.apk (44,399,856 bytes); local ../../outputs/leanlog-V3.0.1.apk.
- SHA-256: 5a80c8fc402dfbb4333eb264bf270543091a6f630cb9bb9126480669ff7849d6.
- Original package com.calorietracker.app / signer 62a8aa1dd325bbe4b76855f4f3cc239950c4133b76ff904244cad6c78695161c retained; APK V2 signature/content digest, ZIP CRC, ARM64 ABI and manifest version verified (../../outputs/leanlog-3.0.1-apk-verification.json).
- Includes hamburger Settings, fixed appearance preview/list-only scrolling, readable Cardio controls, Cyberpunk/Arabia/Arsenal/Liverpool (11 themes), widget colour support, bundled club watermark assets and Chronicle v3.0.1. Large + and RedCoins navigation preserved.
- 326 automated tests + production/QC TypeScript pass. Android QC bundle verified with production cloud excluded. Phone visual acceptance remains pending. Generated mockups are concepts: stadium wallpaper and decorative Home embellishments are not runtime app features.

## Current unreleased — Liverpool theme (12 October 2026)

Added eleventh theme Liverpool: Anfield red, white, charcoal ink and warm gold, with existing Space Grotesk/Manrope fonts. Bundled official Liverpool site Liver bird SVG + PNG; decorative, non-interactive watermark in fixed appearance preview and burger menu. Source noted in assets/liverpool-source.md. Widgets and Cardio use existing theme mappings; all 326 tests pass including eleven-palette text contrast/widget coverage. Main/QC TypeScript and Android bundle checked. QC header 11 THEMES QC; public release remains 3.0.0. Native phone visual acceptance pending. User also requested concept app/widget image; generated preview is illustrative, not a runtime screenshot.

## Current unreleased — pinned appearance preview + Arsenal (12 October 2026)

Appearance preview/header stays outside the theme-list ScrollView, with Apply pinned below. Preview compact mode follows short windows/large text. Font licences open a separate scrollable view within the same modal and Android Back returns to the theme picker. All ten theme rows remain reachable; preview changes do not save until Apply.

Arsenal palette: white/navy surfaces, North London red hero/accent, warm gold actions, Space Grotesk + Manrope. Official Arsenal website cannon bundled locally (assets/arsenal-source.md); subtle decorative watermark on preview hero and menu background, Arsenal theme only. No network/font dependency added. Widget raised red surface darkened for financial-text contrast. Full 326 tests pass including all ten palette/widget/Cardio contrast; main/QC TypeScript pass. Android QC bundle confirms ten-theme header, Arsenal palette and pinned list; production Firebase excluded (../../outputs/leanlog-arsenal-qc.android.bundle). QC header 10 THEMES QC. Native visual acceptance pending; public APK still 3.0.0.

## Current unreleased — Cyberpunk and Arabia themes (12 October 2026)

Added cyberpunk and arabia IDs, palettes and bundled-font mappings. Appearance now lists nine themes. Cyberpunk: charcoal/navy, electric magenta, neon cyan, Space Grotesk. Arabia: sandstone, deep emerald, brass, Lora headlines/numbers and Manrope body. Existing language stays unchanged. Bright action fills use theme mint; Cyberpunk legacy coral buttons use a darker magenta fill for readable light labels. Theme preference, preview/apply, headless widgets and Cardio semantic colours support both IDs. Arabia alternate surface was lightened to pass negative/positive financial-value contrast in widgets.

Main/QC TypeScript and full 326-test suite verified after palette changes; contrast tests now cover all nine themes and all five widget trees. Same Expo Go QC tunnel, header 9 THEMES QC. User phone visual acceptance pending; public APK remains 3.0.0 pending next requested build.

## Current unreleased — theme contrast and hamburger Settings (12 October 2026)

User reported pale text on pale Cardio surfaces in 3.0.0 and requested moving Settings from the bottom tab to a burger at top left. Added explicit cardioAppearance surface/text pairs for all seven palettes, readable foregrounds for filled actions and the two missing legacy cream aliases (#EFE5D4, #F0E8DB). Context/AppMenuContext provides an animated/reduced-motion-aware scrollable side menu and full Settings modal with Back to the original tab. All five main screens have menu access; bottom tabs now Home/Log/Progress/Coach/RedCoins, preserving RedCoins identity and the large +. Home setup links, RedCoins Bluecoins setup and Reports edge swipe open the modal; Coach boundary remains unchanged. Closing Settings increments a context revision so existing data refresh callbacks run without navigating/remounting tabs; live strength session is preserved.

Production/QC TypeScript pass. 326 tests include all-seven-palette Cardio contrast, legacy aliases, menu routing, Settings/import intent, Android Back, data refresh revision and dock gestures/+ checks. QC actual Home/Settings screens are included, Firebase/auth/cloud/account actions mocked; MENU + THEME QC header and same Expo Go tunnel. Android QC bundle checked with production Firebase excluded. Native phone visual/interaction acceptance pending. No version bump/new APK/GitHub publication requested for this patch; public release remains 3.0.0 below.

# LeanLog — latest published release v3.0.0

Updated 12 October 2026 (Asia/Singapore). User requested version 3.0.0 and HANDOVER update. Release completed; unreleased/no-build/in-progress wording below is historical and superseded.

- Source commit: a8ad2dbdd6b298f4670669026940b8992f306744, branch github-release-v221, pushed to origin.
- EAS account umiaq / umiaqs-team, project umarcoc93. Build a9723cdf-7ba6-4634-94ce-cca5f3df89cc FINISHED; preview-arm64, 3.0.0 / versionCode 32.
- APK: https://github.com/umarislah86-collab/leanlog/releases/download/v3.0.0/leanlog-V3.0.0.apk (44,367,052 bytes). Local ../../outputs/leanlog-V3.0.0.apk.
- SHA-256: bcdbdb1def8cede484ca1d22b7e6a439d87f600aa9169c9c3ea260d6cab96d94. GitHub asset digest matches; public/latest release and download HTTP 200 verified.
- Existing com.calorietracker.app and original signer 62a8aa1dd325bbe4b76855f4f3cc239950c4133b76ff904244cad6c78695161c retained. APK v2 signature/content digest, ARM64 ABI, version manifest and ZIP CRC verified. Verification ../../outputs/leanlog-3.0.0-apk-verification.json.
- Includes Cardio Companion (GPS/timer, goals, intervals, pause/resume, quick log and no-AI Activity Save), rich screenshot Activity extraction/review/details with original local images, completed Coach sets and companion details in Activity, RedCoins branded red/gold R navigation mark and Chronicle chapter 3.0.0.
- Validation: 322 automated tests, main/QC TypeScript, Expo native config and Android QC bundle passed. Native Xiaomi background GPS/notification and real Gemini screenshot OCR acceptance remain pending phone QC; build success does not verify those behaviours.
- docs/cardio-companion.md and docs/activity-records.md document runtime/schema/limitations. QC ../../outputs/leanlog-expo-go remains cloud/AI disabled, exp://p2n3imy-umiaq-8084.exp.direct (while Metro is running). Cardio mock ../../outputs/leanlog-cardio-companion-mock.png is a design preview, not a phone screenshot.

## Current unreleased work — rich Activity records (12 October 2026)
Screenshot logger now sends the extended visible-only extraction prompt to the existing activity_image callable, validates optional metrics, offers an editable review, and copies the original screenshot into app documents before durable local Save. No Functions redeploy needed: deployed callable forwards the supplied prompt. Live Gemini OCR on a user screenshot and phone UI remain unverified. Main/QC TypeScript and 322 tests pass. No APK build/push requested for these changes.
Activity details are optional for legacy compatibility: distance, pace/speed, HR/zones, steps/cadence, elevation, active/total calories, timestamps, effort/notes, splits/intervals, cycling/swimming, exercises/sets and real samples. Logger and Progress entries open the full detail viewer, screenshot uses contain/full-screen. Cardio Save and Coach strength Save populate the same schema. Manual known active/total calories bypass AI. Screenshots are local phone files; cloud stores the URI/metadata, not uploaded image bytes. Details: docs/activity-records.md.

# LeanLog — Codex handover

Updated: 12 October 2026 (Asia/Singapore).

## Current unreleased — Cardio Companion + mock

- User authorized the first cardio companion implementation and requested a mock image after coding. Added components/CardioCompanion.tsx integrated into Coach, cardioCore/Store/Runtime services, optional Activity cardio metadata, Expo Location/Speech SDK 57 dependencies/config and top-level GPS task registration. No version bump/build/push for this feature was requested.
- Live Brisk walk/Jog/Run, GPS or timer-only, time/distance/free goals, walk/effort interval builder and presets, active-time clock, voice while foreground/chime and vibration while background, optional keep awake, pause/resume/finish, local saved history/splits, completed-session quick log and idempotent Save to Activity without AI. Fresh logger weight per start/manual session; session-start weight retained. Native GPS foreground service and notification actions/cold-start return to Coach configured. Simultaneous live strength/cardio sessions are prevented.
- SQLite exclusive state updates and stable Activity ID guard GPS/control races and duplicate Save. Nine cardio tests cover clock, pause, interval math, GPS filtering/splits, invalid settings, latest weight, Save/disk failure/retry, cue rescheduling and stale actions. Full suite 314 tests passed; main/QC TypeScript, prebuild GPS permissions and Android preview bundle verified. Native Xiaomi GPS/background/notification acceptance still pending APK. See docs/cardio-companion.md for architecture, sources and QC checklist.
- QC folder ../../outputs/leanlog-expo-go opens Coach/Cardio with cloud mocked, CARDIO QC header, tunnel exp://p2n3imy-umiaq-8084.exp.direct on port 8084; Metro exec session 76008. Expo Go supports timer/UI/foreground GPS preview; native screen-off service needs APK. Mock ../../outputs/leanlog-cardio-companion-mock.png generated via imagegen built-in tool, exact prompt ../../outputs/leanlog-cardio-mock-prompt.md. Preview only, not an actual screenshot.

## Latest published release — v2.9.26

- User accepted native swipes, dock exchange and responsiveness in Expo Go, then authorized build/push/publication. Completed from release source 22e42da7ec91b1b35ddb17f04d723c92a627aac7 on github-release-v221. Below in-progress/no-build/QC-pending statements are historical and superseded for those accepted changes.
- EAS umiaq / umiaqs-team build a603acbe-3dab-42d4-a8f1-0f2236daee8a FINISHED. ARM64-only, com.calorietracker.app, 2.9.26 / versionCode 31. Original signer 62a8aa1dd325bbe4b76855f4f3cc239950c4133b76ff904244cad6c78695161c verified, with APK v2 signature/content digest and ZIP CRC.
- Published https://github.com/umarislah86-collab/leanlog/releases/download/v2.9.26/leanlog-V2.9.26.apk (44,128,193 bytes). SHA-256 1fc030007bbd671fac93d1bd51a5b5b0214b7687e31819df0438d706d2029760 matches GitHub asset digest. Release public, latest, download HTTP 200 verified. Local artifact ../../outputs/leanlog-V2.9.26.apk.
- Main/QC TypeScript, 305 regression tests, Expo prebuild config and diff checks pass. Expo Go phone acceptance is complete; final installed APK acceptance remains with user. Release includes native internal swipes and boundary exits, shared animated dock, preserved large +, direct LeanLog Home exit and responsive native tap/highlight path.

## Release in progress — v2.9.26

- User accepted latest Expo Go responsiveness QC ("haaa baru padu") and explicitly requested APK build and GitHub push/publication. This supersedes pending phone acceptance/no-build statements below. Native swipe, shared dock motion, preserved +, direct LeanLog exit and tab response all accepted in Expo Go; installed APK still needs final acceptance after build.
- Version bumped to 2.9.26 with factual Chronicle chapter. Build uses umiaq / umiaqs-team project 086aadb6-658c-47ee-a472-e9d76ac3c7be, preview-arm64, existing signing key and package com.calorietracker.app. Complete artifact verification and GitHub release publication before reporting completion.

## Current QC — immediate RedCoins tab response

- User likes the shared dock motion but reports delayed RedCoins tap navigation/highlight and swipe highlight. Previous implementation waited for the full screen render, then effects to command the pager and republish dock state.
- Replaced effect-based context mirroring with stable navigationDock store; only the small dock subscribes through useSyncExternalStore. Screen publishes selection immediately and commits heavier content via startTransition. All section setters (tap, Back, deep links, audit navigation) command the native pager through its imperative handle before content render. Stable sectionRef tracks history across rapid taps.
- Pager no longer moves in response to delayed React commits. Native command acknowledgements ignore older rapid-tap events. Swipe onPageScroll previews the nearest valid section; cancellation restores highlight without modifying section history, and selected events commit content. Existing native boundaries, shared + and direct LeanLog exit preserved.
- Main/QC TypeScript, 305 tests and diff check pass. Regression tests cover native command before render, stale rapid-tap callbacks/commits, swipe cancellation/edge previews, synchronous dock publication/deduplication and plus behavior. Public tunnel serves updated bundle. Phone responsiveness acceptance is pending user reload; no APK built or publication.

## Current QC — shared animated bottom navigation

- User confirmed native RedCoins swipes WORK in Expo Go on phone. That acceptance supersedes the pending swipe QC statement below. No new APK has been requested since this acceptance.
- User requested LeanLog tabs slide down and RedCoins tabs replace them in the same bottom position. Added MainNavigationDock and NavigationDockProvider, shared by production and QC. Screen registers section/navigation callback; native pager, tabs and Back remain controlled by the same section state. Removed the old floating RedCoins nav and its extra list bottom space.
- Native-driver 460 ms slide/fade exchange in one fixed slot; supports reduced motion and hides inactive controls from touch/accessibility. The big + remains OUTSIDE animated layers, always visible, with existing quick logger and expense long-press. User explicitly required that it stay.
- User also requested a direct way back without edge swiping. Added persistent LeanLog exit button in RedCoins header -> main Home, with reverse dock animation. Existing edge swipes remain.
- QC now uses the actual production MainNavigationDock, showing NAV MOTION QC. Same running tunnel/QR below. Main/QC TypeScript pass, existing 300 tests plus 2 dock callback/FAB tests pass, updated public Android bundle verified. Phone animation/exit/+ acceptance is pending; ask user to reload their current Expo Go preview. No build/version bump/publication.

## Current unreleased work — native RedCoins pager, Expo Go QC

- User reports both v2.9.24 and v2.9.25 swipe attempts still fail. Prior published gesture fixes are NOT device-verified successes. User cannot connect USB and explicitly requested Expo Go QC before another build.
- Installed react-native-pager-view Android NestedScrollableHost calls NativeGestureUtil.notifyNativeGestureStarted on movement beyond touch slop, including with outer pager scrolling disabled. This can cancel the JS PanResponder that the earlier fixes depended on. Replaced screen PanResponder with native components/RedCoinsPager.tsx; parent main pager remains disabled on RedCoins.
- Native pages: Coach exit sentinel, Home, Activity, Accounts, Plan, Reports, Settings exit sentinel. Exit resets inner pager before navigation; controlled tab/Back/deep-link state drives setPageWithoutAnimation. Ledger remains virtualized. Removed obsolete delta-based swipe helper/tests; added real component callback/ref-command tests. Reports still calculates only while its section is selected.
- QC folder: ../../outputs/leanlog-expo-go. Uses actual native main-tab architecture and current RedCoins source, 80 local SQLite demo transactions, actual Coach screen, minimal Home/Settings. Cloud/AI/widget replacements are QC-only. Start with npm run start:tunnel (8084); fresh terminal QR required after restarting. Current tunnel exp://p2n3imy-umiaq-8084.exp.direct, QR ../../outputs/leanlog-redcoins-swipe-qc-qr.png. Metro running in exec session 77786 at handoff.
- Validation: main and QC TypeScript pass; all 300 tests pass; public tunnel Android bundle download succeeds, includes new pager/demo markers, excludes production Firebase project. Device touch delivery is NOT tested (no ADB/emulator; user Expo Go acceptance pending). QC README lists both boundary exits, return position, ledger horizontal/vertical gestures, tap/long press, tab/Back and Plan/Accounts subpages. No version bump, APK build or GitHub publication for this revision.

## Latest published release — v2.9.25 (12 October 2026, Asia/Singapore)

- User authorized build/push/publication of swipe capture correction below; its unreleased statement is superseded. Source d31b547657f89efda342c8943e63a3d0475c855f pushed to github-release-v221.
- EAS umiaq build 668594d1-fad6-44e6-a955-17956b4f525e finished; ARM64-only, com.calorietracker.app, version 2.9.25 / code 30 verified. Original signer 62a8aa1dd325bbe4b76855f4f3cc239950c4133b76ff904244cad6c78695161c, APK v2 signature/content digest and ZIP CRC verified.
- Published https://github.com/umarislah86-collab/leanlog/releases/download/v2.9.25/leanlog-V2.9.25.apk (44,121,293 bytes). SHA-256 24a289074d2955c61b71cc5644f1ae157f620b5ad75cd34a4265bc77ac6bdebf matches GitHub asset digest; release not draft and HTTP 200 verified. 298 tests and TypeScript pass; native phone swipe acceptance still pending.

## Unreleased — RedCoins swipe responder correction

- User reports v2.9.24 swipes do not work on device. Changed move handler to capture phase, allowing the screen to claim horizontal motion before nested native ScrollView/FlatList responders. Captured gestures now refuse termination and block native responder takeover until release. Initial taps/vertical scrolling remain unclaimed.
- TypeScript, direction/boundary gesture tests and diff checks pass. These checks do not confirm native event delivery; device swipe/vertical-scroll QA still required. No corrected APK built yet.

## Latest published release — v2.9.24 (12 October 2026, Asia/Singapore)

- User authorized build/push/publication. Includes Coach keep-awake, deadline rest timer, per-exercise Auto/reps/timer mode, strength-row correction and RedCoins swipe navigation. Below unreleased statements for these changes are superseded. Dock Mode remains deferred.
- Source b1109d71d7bac23008efa364d1d86797b8adbffa pushed to github-release-v221. EAS umiaq / umiaqs-team build 64073490-9408-40b9-977b-13177f0e40ed finished: preview-arm64, com.calorietracker.app, 2.9.24 / code 29.
- Public APK https://github.com/umarislah86-collab/leanlog/releases/download/v2.9.24/leanlog-V2.9.24.apk (44,121,229 bytes). SHA-256 487d25d488690a79d86be98900a0c8641fc510483da1442e533fd8bb0a15f7fe matches GitHub asset digest; release not draft and HTTP 200 verified.
- ARM64-only and original signer 62a8aa1dd325bbe4b76855f4f3cc239950c4133b76ff904244cad6c78695161c verified, along with APK v2 signature/content digest and ZIP CRC. 298 tests and TypeScript pass. Final phone gesture/lifecycle acceptance pending.

## Unreleased — RedCoins horizontal section swipes

- Swipe left advances Home -> Activity -> Accounts -> Plan -> Reports; right reverses. Right beyond Home navigates to main Coach, left beyond Reports navigates to main Settings. Parent main-tab swipe remains disabled for RedCoins so internal sections handle boundaries explicitly.
- Pan responder only claims deliberate horizontal movement, preserving initial taps and vertical list scrolling. Short/diagonal gestures do not navigate. Internal navigation uses existing section history/reset behavior; gestures are blocked during pending entry/batch writes or receipt work. Native phone gesture QA pending APK.
- Added direction/boundary and short/vertical/diagonal tests. No APK build/version bump requested yet.

## Unreleased — Coach screen awake, rest deadline and exercise mode

- Keep screen awake automatically while Coach session is visible/focused and app foreground; release on blur/background/pause/finish. Added SDK-compatible expo-keep-awake.
- Rest display now derives from absolute deadline, updates on app resume/focus, and shares that deadline with the notification. Generation tokens cancel stale asynchronous scheduling on restart/skip/unmount; +30 uses actual remaining time. Strength row names no longer match cardio rowing accidentally.
- Each session exercise offers Auto / Kg × reps / Timer (min). Override retained in workout draft and saved modified plan; changing mode stops its active duration timers and retains entered values for editing. Old exercises default Auto.
- 296 tests and TypeScript pass; phone lifecycle/keep-awake testing pending. No APK build requested yet. Dock Mode was discussed as a possible manual fullscreen clock feature, not implemented.

## Latest published release — v2.9.23

- User authorized build and GitHub publication of all accumulated changes below. Their Unreleased/no-build statements are historical and superseded. Includes immediate RedCoins actions, dark bright-card contrast, Onyx Gold, Appearance scrolling, full mirror viewing and accurate 0% widget bar.
- Source 09ae4bff930ffbd3ecc065b5255849de380eb6c5 pushed to github-release-v221. EAS umiaq / umiaqs-team build 59603a9e-f1db-42f4-9367-2a20117494b0 finished; preview-arm64, com.calorietracker.app, version 2.9.23 / code 28 verified.
- Published https://github.com/umarislah86-collab/leanlog/releases/download/v2.9.23/leanlog-V2.9.23.apk ; 44,112,229 bytes. SHA-256 53623e3f27fa53acf97b7e6cfb821eaa7ba662ceb217847b04d2e78a82ceab9c matches GitHub asset digest; public download HTTP 200, release not a draft.
- Original signer SHA-256 62a8aa1dd325bbe4b76855f4f3cc239950c4133b76ff904244cad6c78695161c retained. ARM64-only, APK v2 signature/content digest and ZIP CRC verified. 293 tests and TypeScript pass. Final installed-phone acceptance remains pending.

## Unreleased — accurate widget calorie bar

- Removed daily widget's minimum 4% fill. Zero calories/rounded 0% renders no coloured segment; positive percentages use actual clamped 0–100 progress and 100% omits the empty segment. TypeScript and 11 daily-widget/theme tests pass. No APK build yet.

## Unreleased — full mirror photo viewer

- Gallery thumbnail taps and Body Timeline photo taps open a fullscreen black viewer using resizeMode contain: full original aspect ratio, no crop/stretch. Date and position shown; Previous/Next browse all stored mirror photos; Close/Android Back return to the prior screen. Gallery has a separate Edit control, retaining metadata editing. Edit-modal image now contains the full photo and is tappable into the same viewer. Missing-image error feedback included.
- TypeScript and diff checks pass. Native modal/image viewing QA pending; no APK build yet. Existing upload resolution is unchanged; viewer cannot recover pixels already removed before storage.

## Unreleased — Appearance modal scrolling

- Replaced nested full-screen/panel Pressables with a passive panel and independent absolute backdrop dismiss target. Safe-area wrapper uses box-none, leaving backdrop reachable without wrapping scroll gestures in press handlers. Modal panel and ScrollView have bounded flex heights; all choices, preview and credits share one vertical scroll area, while Apply stays at the bottom. Android nested scrolling enabled and scroll indicator visible.
- TypeScript, 16 appearance tests and diff checks pass; native finger-scroll QA pending APK. Updated preview copy to accurately reflect themed launcher widgets.

## Unreleased — Onyx Gold appearance

- Added seventh theme Onyx Gold (onyx) to shared palette/Settings choices and saved-theme validation. Charcoal canvas, layered graphite cards, warm gold accent/action highlights and ivory foreground; red/green/blue finance meanings retained. Space Grotesk headings/numbers and Manrope body reuse bundled fonts. Shared headless widget theme inherits the palette and typography.
- TypeScript and 22 appearance/widget tests pass, including palette foreground and all five widget contrast checks across every theme. Dark Home bright-card foreground correction also applies. No new APK build yet.

## Unreleased — Home bright-card text contrast

- User screenshots show Studio/Midnight light text on completed blue/green/yellow habit tiles and mustard Budget Coach. Completed habit name/check/streak now uses explicit dark ink on retained bright colours. Dark themes override Budget Coach heading, total, metadata, change badge, chart values/day labels and category names/amounts after theme mapping; wallet/spinner use matching dark ink. Uncompleted dark habit tiles retain their normal foreground.
- TypeScript and diff checks pass; dark ink contrast against the four built-in habit colours is 7.55–10.66:1 (mustard Budget Coach 9.75:1). Phone visual QA pending; no APK build yet.

## Unreleased — immediate RedCoins Save preview

- Extended to single delete (logger and ledger), bulk edit/delete/paste and Copy. After confirmation, ledger/balances change and bulk/logger modals close before any awaited database/frame work. Shared preview commit reloads durable data on failure, restores selection/modal/draft, and retains SQLite revision protection. Entry mutation lock prevents overlapping saves/deletes/batches. Index delete/sync only follows authoritative write success; summary/widget refresh is secondary. Copy previews clipboard controls and restores them if storage fails.
- Validation now 293 tests plus TypeScript and diff checks pass, including slow-write and disk-failure scenarios for single delete, bulk delete, amount edit and paste. No new APK/build/publication yet.
- User requested Save immediately close the logger and show the transaction in the ledger, with persistence behind the UI. Logger now builds from the live screen snapshot, publishes entry/balance state and navigates to Activity synchronously before yielding frames and writing SQLite. Existing revision check prevents stale snapshots overwriting concurrent changes; save lock remains until durable work completes.
- Failed writes reload durable state (fallback to previous snapshot if reload fails), reopen the retained draft and show the save error. External state notifications cannot replace an in-flight preview, including reloads already underway. Summary/widget/index/reminder refresh remains after durable success. Receipt folder copying no longer reopens the logger on success; failed copies still preserve originals and report retry instructions.
- 289 tests and TypeScript pass, including controlled slow-write preview and failed-write rollback tests; existing SQLite concurrency and atomic-balance tests pass. Native phone latency still needs verification. No new APK/version bump/publication for this change yet.

## Latest published release — v2.9.22 (10 October 2026)

- User approved compact protein slider/card ordering in Expo Go, then explicitly authorized APK build and GitHub push/publication. Supersedes earlier QC-only/no-build notes below.
- v2.9.22 replaces the additional protein calendar with a compact continuous horizontal protein graph in Progress; original calendar retained. Seven visible day bars, complete history to first food log, missing-day gaps, selected-day current-target status/meal totals/journal link. New Progress card ordering persists after Save, with boundary/normalization/error handling.
- Built with umiaq / @umiaqs-team/umarcoc93, existing original signing key and ARM64-only preview-arm64 profile. Remote autoIncrement verified 26 -> 27. Source QC harness remains separate under outputs and is not part of production APK.
- Source commit: 4dd3f374c48df5a4df9230c914d87ebe3131e840. EAS build 6e4a3893-63af-4d07-8e2b-f51fe1f6a0b3 finished successfully. Package com.calorietracker.app, version 2.9.22, versionCode 27, ARM64-only verified.
- Published APK: https://github.com/umarislah86-collab/leanlog/releases/download/v2.9.22/leanlog-V2.9.22.apk (44,103,969 bytes). SHA-256 221830a0a76c6b7283917ec0273f3d7291fd5388a014acedc6de396836b5af21 matches GitHub asset digest; public release is not a draft.
- APK v2 signature, signed content digest and ZIP CRC verified. Original signer SHA-256 62a8aa1dd325bbe4b76855f4f3cc239950c4133b76ff904244cad6c78695161c preserved.
- 287 tests, TypeScript, production prebuild checks and native build/artifact validation pass. User accepted Expo Go design; device APK behavior still needs installation acceptance.

## Latest QC refinement — compact protein + Progress card order

- User accepted slider but requested ~3/5 original card height and customizable top/bottom card placement. ProteinDaySlider merges date labels into one row, reduces graph to 58 dp inside 92 dp canvas, tightens spacing and font sizes, and folds Today/Food links into one footer. Normal text size is approximately 60% previous card height; text scaling remains supported rather than clipping a fixed-height container. Full timeline, native motion, selected-day values, target line and meal breakdown remain.
- Progress header now has Susun kad / Arrange. Modal offers up/down controls for all six sections: Protein, Weight/chart, Body Timeline, Progress Brief, Export and Calendar. Save persists normalized order in leanlog_progress_cards_v1 before applying; failure retains previous active order, Cancel discards draft, Reset default is a draft until Save. Existing full-state cloud backup includes this preference key.
- Cards render via stable keyed fragments, preserving slider selected date while moving. Stored old/missing/duplicate/unknown IDs normalize safely; new cards append. Modal supports BM/English, themed contrast and disabled boundary controls.
- QC folder updated with exact main source; reload same Expo Go tunnel preview. 287 tests and main/QC TypeScript pass; live Metro HTTP 200 confirms compact slider, ordering UI and persistence key, with production Firebase config absent. User phone QC pending. No APK build/version bump/commit/push for this revision.

## Current QC — protein slider; calendar integration cancelled

- User cancelled protein calendar integration after Expo Go QC. Removed the extra ProteinCalendar and restored the original monthly calendar layout/dots/navigation, without protein heat colors/labels. Supersedes the prior calendar correction.
- New ProteinDaySlider is a separate card at the top of Progress. Horizontal graph shows up to seven day bars at a time, centers/snaps the selected date, and continues without a seven-day history cap through EVERY calendar day to the first valid food log. Newest-first order means finger swipe left -> older, right -> newer; bounds stop at today/first log. Arrows move one day; Today returns to latest; bar tap selects day.
- Selected day updates large grams, current-target percentage, remaining/met/empty status, four meal totals and View food daily journal link during scrolling. Dashed current-target line, selected column, native-driver opacity/width motion and short detail reveal; reduced-motion support. Empty days differ from logged 0g. All dates use current goal per user's explicit preference. No future food values included. Pure proteinTimeline service aggregates padded local/ISO dates, skips malformed/future dates, ignores invalid protein and supports arbitrary-length virtualized history.
- QC folder outputs/leanlog-expo-go uses the actual edited Progress/Log screens, 60 days of DEMO local data and Metro-only cloud/AI/widget stubs. SDK 57. Local LAN download failed on user's phone; tunnel fixed it, user confirmed preview opens. Tunnel server port 8084, exp://p2n3imy-umiaq-8084.exp.direct; outputs/leanlog-expo-go-tunnel-qr.png. Reload existing Expo Go preview for this change. Restart later with npm run start:tunnel and scan new terminal QR. node_modules junction points to repo; Expo ngrok installed and linked locally.
- Validation: 283 tests, main/QC TypeScript, diff whitespace and live Android Metro bundle HTTP 200 pass. New slider present; production Firebase project config absent from QC bundle. Phone visual/swipe acceptance pending user's QC. No APK build, version bump, commit/push or release authorized for this revision.

## Latest published release — v2.9.21 (10 October 2026)

- User authorized APK build and GitHub push/publication. Includes all accumulated protein/calendar/current-weight, bulk food photo review, receipt-folder, startup and RedCoins onboarding changes below. Earlier no-build/unreleased statements are historical and superseded by this release authorization.
- EAS account umiaq, existing @umiaqs-team/umarcoc93 project; remote Android versionCode was 1 and is set to 25 before autoIncrement to 26. Retain original package/signing credentials and ARM64-only preview-arm64 profile.
- TypeScript, 278 tests, Android Metro and native EAS build pass. EAS build 7e1b055f-9886-4f02-b609-072a8ce1f41c FINISHED under umiaq/umiaqs-team, source commit 1fbf2bfa4fc357146cd045ddc3f3dc3a032343db pushed on github-release-v221.
- APK: https://github.com/umarislah86-collab/leanlog/releases/download/v2.9.21/leanlog-V2.9.21.apk — 44,090,961 bytes (42.05 MiB), versionCode 26, SHA-256 cf315aa347784e23c76b14a6387864b109fbaef4ea3a693127e701b547fa71c1. Verified package com.calorietracker.app, ARM64-only ABI, version/code, ZIP CRC, APK v2 signature and content digest. Original signer unchanged: 62a8aa1dd325bbe4b76855f4f3cc239950c4133b76ff904244cad6c78695161c. Published GitHub asset digest matches local verified APK.
- Phone acceptance of new layouts/providers/live AI response remains pending. One Android build used on the new team's quota.

## Included in v2.9.21 — dynamic protein + calendar (release build)

- User approved protein settings in User Profile and a monthly protein heatmap in Progress. Profile body/activity section collapses; Protein Target summary expands into Auto 1.2 g/kg, strength 1.6 g/kg, custom factor, or fixed grams. Optional reference weight overrides logger weight for factor modes. Manual values are validated against calorie budget; profile persistence completes before closing.
- Shared proteinTargets helper uses current logger-derived profile weight. Today standard rings, SSS protein, Home focus prompt and protein streak use the new target. Remaining calories split 60/40 carbs/fat. These are starting heuristics for healthy adults; settings include reference/manual guidance.
- Calendar displays daily grams, percentage colors (<50, 50–79, 80–99, >=100%), current-day outline, future disabled cells, month navigation, logged-day average and known-target hit count. Tap a day for meal breakdown and remaining grams; tap target for Profile setup.
- Current-day target snapshots persist in protein_target_history_v1, mirrored to the user's proteinTargets Firestore collection and included by existing full-state cloud backup. Later weight/settings edits update today's snapshot without rewriting earlier days. Dates without a recorded target remain explicitly unknown; existing history is not guessed. Daily Journal uses stored protein target too. Target snapshots occur while the app is used, not via a daily background job; missed days can remain unknown. Cloud mirroring uses existing best-effort Firebase helpers.
- Validation: TypeScript and 278 Node tests pass, including new mode/weight/reference/validation/history/concurrency/threshold cases. Android JS bundle checked before delivery; device UI still needs phone verification. No APK build or version bump requested for this work. Future builds use umiaq/umiaqs-team.

## Build account preference — umiaq (10 October 2026)

- User explicitly requested all future APK builds use the newly logged-in EAS account `umiaq`. Its existing LeanLog project is under owned team `umiaqs-team`: @umiaqs-team/umarcoc93, project ID 086aadb6-658c-47ee-a472-e9d76ac3c7be. Personal umiaq account has no projects; do not create another project.
- app.json owner/projectId now point to this existing team project. Previous umarosli93 project ID was 624ee9c5-768a-4781-a2c5-1f1608c1500a. Keep package com.calorietracker.app and use existing default remote signing credentials.
- Read-only credentials query confirmed default SHA-256 62a8aa1dd325bbe4b76855f4f3cc239950c4133b76ff904244cad6c78695161c, exactly matching published v2.9.20. SHA-1 732715ca497e25521f4139839ab4b4f8c6f182a1 also matches. No key/password downloaded or regenerated.
- Before the next build, check this project's remote versionCode and ensure it exceeds installed v2.9.20 code 25. Account/project relinking itself is not an APK build; no build started for this preference change.

## Included in v2.9.21 — profile weight follows logger (release build)

- User asked that the Body Weight field in User Profile automatically follow the weight logger. New currentWeight helper selects latest valid measurement by local calendar date, same-day numeric record ID as tie-breaker, ignores future/invalid records, and preserves recorded decimal precision.
- Today/Log hydration derives effective profile weight from history, syncs existing profile storage/cloud settings, displays the exact current logged value and makes it read-only with an Update through Log Weight hint. Without weight records, manual entry remains available. Weight logger defaults to current weight rather than 70 kg.
- Saving a weight in Today refreshes profile/current-weight state immediately after history save; saving/deleting in Progress syncs profile after history persistence. Backdated measurements do not override newer ones; deleting the latest falls back to the remaining dated measurement. Empty history keeps the existing profile weight, and no incomplete profile is created. TDEE/activity estimates use effective profile weight; daily calorie goal is not silently changed.
- Profile mirroring failures are logged and do not turn a successfully saved measurement into a retry/duplicate. Four tests cover date/backdate/ties/precision, invalid/future inputs, deletion fallback and profile persistence/mirroring.
- Validation: TypeScript and 274 total tests pass. No APK build/version bump/commit/push performed.

## Included in v2.9.21 — bulk food photos and actual Gemini prompt (release build)

- User approved bulk food uploads and asked what happens on the backend and the actual prompt sent to Gemini. Added 1–3 food-gallery images in one meal/request; camera and activity screenshot remain single-image. Limit fits the existing callable's four input parts (three JPEGs + one shared prompt), with an 8,000,000-character payload check. No function change/deployment required for this request format.
- Food photos use JPEG compression 0.6 and maximum longest edge 800 px without upscaling. A shared Malay prompt requests one numbered plate per image, item calorie/macronutrient estimates and possible duplicate references; user notes are context, not format instructions. Payload does not include nutrition profile/history. Model in backend source remains gemini-3.6-flash via interactions.create; only text is returned, no token usage telemetry.
- FoodImageReview now appears for single and bulk food photos before save. Flagged duplicate-looking plates require confirmation; any plate can be included or excluded manually. User can edit meal/item names, kcal and consumed portion; local summation scales macros and ensures item kcal totals match the one saved meal. No second AI request for review edits/sum. Invalid/incomplete AI output is rejected before logging; failure returns to preparation for explicit retry. Cancel creates no entry; confirmation/save locks prevent repeated taps from creating repeated requests/entries.
- Saved FoodEntry has optional imageUris, keeps imageUri as a backwards-compatible thumbnail, and shows included photos in details. Original picker URIs follow the existing app media-storage behavior; photo files are not uploaded by fsUpsert or transferred to another phone by JSON restore.
- Exact old/new prompt and step-by-step code flow: docs/FOOD_IMAGE_AI_FLOW.md; user-facing outputs/leanlog-food-ai-flow.md. Generated new prompt directly from foodImagePrompt(3) for accuracy. Backend production was not invoked; no Google/Gemini credentials or image data exposed.
- Validation: 270 total tests pass (eight new food/picker tests), TypeScript, diff whitespace and Android Metro export pass (1304 modules). Actual Gemini response and phone picker/keyboard acceptance pending APK. No APK/version bump/commit/push for these changes.

## Included in v2.9.21 — immediate app startup (release build)

- User requested removing the intro shown on every launch. Removed branded/prayer intro, minimum three-second timer and 600 ms exit fade from App.tsx, plus their animation state/styles/assets import.
- Startup now proceeds immediately when existing auth/local-profile/cloud-recovery and trial checks finish. While those required checks run, only a themed activity indicator is shown. New-user profile onboarding and the RedCoins first-use wizard remain separate.
- Version remains 2.9.20; no APK build or push performed for this change.

## Included in v2.9.21 — RedCoins first-use wizard (release build)

- User approved a RedCoins-only wizard; other app features stay outside onboarding. Google Cloud setup is explicitly deferred while the user is out.
- `RedCoinsSetup` offers start fresh, staged RedCoins JSON restore with confirmation/recovery checkpoint, and Bluecoins import via the expanded Settings Data & recovery group. Cancelled import leaves setup available. The wizard is visible only while the RedCoins tab is focused.
- Fresh setup: first Cash/Bank/Credit card account and opening balance, selectable spending/income categories, optional monthly budget/payday, then first transaction. More accounts/categories remain editable in Accounts. Default financial preferences are shown accurately when optional fields are blank; credit-card amount owed becomes negative balance without a fabricated transaction.
- `redcoinsOnboarding` checks empty accounts/categories/ledger/schedules and absence of import/deletion/export/budget history. Existing users with data/history bypass the wizard. Completed/skipped marker is stored atomically alongside setup in SQL and validated in JSON backup. Skip persists once; ordinary account/category management remains available.
- Drafts remain in component memory until Finish. Latest-state eligibility and SQLite revision checks prevent concurrent edits being overwritten. Widget/deep-link transaction logging waits until onboarding completes or is skipped; pending transaction parameters are retained.
- Validation: 262 total tests pass (six new wizard tests including real SQLite save/reopen, skip persistence, starter picker visibility, backup marker, credit-card debt, validation and concurrent-write protection); TypeScript, diff whitespace check and Android Metro export pass (1302 modules). Phone layout/keyboard/navigation acceptance remains pending a native APK. No version bump, new build, commit or push made for these unreleased changes.
## Included in v2.9.21 — receipt originals in a chosen Android folder (release build)

- User cancelled Google Drive OAuth/API setup and requested the same folder-picker approach already used by RedCoins backups. Removed receipt OAuth native module, registration, Google Play auth dependency, Drive transport/account/token handling and setup guide. No Google Console setup is required.
- Receipt panel supports camera, photos and PDF/file, Choose/Change/Clear folder, private local originals, and Save to folder/Retry. Selected folder persists via Android Storage Access Framework. Folder providers vary by phone; Drive is usable only if it exposes a writable directory through the system picker. No direct Drive API upload or cloud-sync promise.
- Saving a transaction with new receipts automatically copies them if a folder is selected. Finance commits first; copy errors clearly say Transaction saved and retain local originals with Retry. Without a folder, receipt originals remain local and can be copied later.
- Filename contains transaction date, item, RM amount, entry ID and receipt ID. Original binary is copied without image conversion, verified by full byte read-back, maximum 20 MB. Base64 is transient file I/O only, never stored in SQL or AsyncStorage. Folder destination is reserved before copy; retries verify/reuse completed writes and repair incomplete ones without duplicate files.
- Device-private reservation registry and current user-granted folder membership protect against writing arbitrary URIs from restored metadata. Changing a folder does not redirect an interrupted reserved copy. Metadata saves operate on latest SQL revision, preserve concurrent financial edits and never resurrect deleted entries.
- RedCoins JSON backups contain receipt metadata/references, not originals or folder grants. Restoring onto another phone still needs the receipt files separately and a new folder choice. Existing attachment/edit/import preservation remains.
- Validation: 262 tests pass (16 folder/receipt tests, one import-preservation regression, six wizard tests), TypeScript and Android Metro export pass. Actual Android folder provider/camera/keyboard acceptance still pending APK. Version remains 2.9.20; no new build/commit/push requested or performed.

## Latest published release — v2.9.20 ARM64 (10 October)

- Affected spouse phone reports `database or disk is full (code 13 SQLITE_FULL)` on v2.9.19; user's own phone opens normally. Actual free device storage is not yet supplied. Legacy migration duplicated complete ledger checkpoints into Android AsyncStorage, whose pinned native default is 6 MB. Reproduced checkpoint failure near that cap; successful upgraded phones may already be reading authoritative SQLite.
- All three large recovery checkpoints now live in additive `rc_recovery` SQLite storage, verified before financial migration/save. Existing AsyncStorage checkpoints are copied without changing their original bytes and are never deleted/overwritten. The original legacy state also remains untouched. Real disk-full during checkpoint creation still rejects safely with no financial rows initialized.
- Native config plugin sets AsyncStorage capacity to 32 MB for retained legacy data and small preferences. Expo introspection confirms the generated Gradle property. All 239 tests, TypeScript and Android prebuild config passed; includes near-6-MB regression, full service migration without large AsyncStorage writes, immutable prior checkpoints and real-disk-full failure/retry.
- Hotfix v2.9.20 / versionCode 25 published as corrective follow-through for the previously requested build/push and failing phone upgrade. Source commit `9c14990505a4feee44dca7189e841bd7587ad334`; EAS `a9fd92c0-edd5-45c8-9027-db3ac7d044cf` FINISHED with preview-arm64 and existing remote keystore. Android Metro exported 1297 modules. Phone acceptance remains pending.
- APK: https://github.com/umarislah86-collab/leanlog/releases/download/v2.9.20/leanlog-V2.9.20.apk — 44,006,493 bytes / 41.97 MiB. SHA-256 `079d1d34d83e5abee7c9975e068ceff3371ffeb9f3bec407a59b5185a60a5620`. Verified package `com.calorietracker.app`, version/code, ARM64-only libraries, ZIP CRC, APK v2 signature and signed content digest. Signer unchanged `62a8aa1dd325bbe4b76855f4f3cc239950c4133b76ff904244cad6c78695161c`.
- Tag matches exact EAS source commit. GitHub latest release is v2.9.20, uploaded asset size/digest match the verified APK and public download returns HTTP 200. All originals/prior checkpoints retained; do not clear phone data. Need affected-phone result and free-storage detail if still failing.

## Latest published release — v2.9.19 ARM64 (10 October)

- User authorized ARM64 APK build, push and GitHub publication. Based on v2.9.18 and the latest release branch handover commit.
- Legacy SQLite migration accepts an absent reminders collection (pre-reminder releases); existing malformed collections still fail closed. Original JSON and its byte-for-byte checkpoint remain intact; balances and transactions are preserved. RedCoins startup now displays load errors and offers retry.
- Daily widget removes the title/updated row, combines calorie/progress and health stats, reduces padding/gaps and snapshot heights, expands an odd final snapshot to full width, and keeps all action links and amounts. Launcher appearance/resizing and the affected phone's upgrade still require acceptance.
- Published v2.9.19 / versionCode 24 from release source commit `14f6315613b7c3b9c513d644ba1059832427ed35`, pushed to `github-release-v221`. EAS `8c2bddcd-fbe4-42ec-9dd9-488f9cc07689` FINISHED using `preview-arm64` and the existing remote keystore. 235 tests, TypeScript, Expo Android prebuild config and Android Metro export (1297 modules) passed.
- APK: https://github.com/umarislah86-collab/leanlog/releases/download/v2.9.19/leanlog-V2.9.19.apk — 44,005,765 bytes / 41.97 MiB. SHA-256 `914a47e2340062479f0a051fb54480c4997e1a150f57511dfd775382aed27ffa`. Package `com.calorietracker.app`, version/code, ARM64-only native libraries, ZIP CRC, APK v2 signature and signed content digest verified. Signer unchanged: `62a8aa1dd325bbe4b76855f4f3cc239950c4133b76ff904244cad6c78695161c`.
- GitHub tag points at the exact EAS source commit. Latest release is v2.9.19, uploaded asset size/digest match local verification and the public APK URL returns HTTP 200. The affected phone's migration and compact Daily widget launcher appearance/resizing still require phone acceptance; do not infer device success from automated checks.

## Latest published release — v2.9.18 ARM64 (9 October)

- User confirmed keep LeanLog branding. Published v2.9.18 / versionCode 23, ARM64-only, source commit `f9c7151a61e2656f8b5adeaf6c799b5e5ff6bc15` pushed on `github-release-v221`. EAS `98814560-0ec5-4408-ae46-d6ba1b9a72c2` FINISHED. Includes Home contrast/readability, saved six-card order and theme-aware widgets/native fonts below. Older unreleased/no-build notes are historical and superseded. 233 tests, TypeScript, prebuild config, Android Metro and native build passed. Phone theme/widget/reorder acceptance remains pending.
- APK: https://github.com/umarislah86-collab/leanlog/releases/download/v2.9.18/leanlog-V2.9.18.apk — 44,004,901 bytes / 41.97 MiB. SHA-256 `a216ee2bd2e8c8c8fc553e737805f5e7a92aab5b0095e2dc29bedc7126153a3e`. Package/version/code, ARM64 ABI, ZIP CRC, APK v2 signature and content digest verified; signer unchanged `62a8aa1dd325bbe4b76855f4f3cc239950c4133b76ff904244cad6c78695161c`. All nine Expo font hashes and all nine `assets/fonts/LeanLog*.ttf` native widget copies verified against source. GitHub latest-release asset size/digest match; Semak Update resolves v2.9.18.

## Included in v2.9.21 — theme-aware native Android widgets (release build)

- User requested all widgets follow all app themes. Daily, Account Snapshot, Cash Reality, Quick Log and Bills/Automation now accept themeId and apply an explicit widget-only surface/foreground/font mapping (`widgets/widget-theme.tsx`). Original preserves exact widget tree/style identity. Financial actions retain red/green/blue meaning; account/guard tints use readable labels, including alert cards. Themed text contrast tested against actual inherited widget backgrounds, not just palette samples. Dimensions, 2×2 zero-width-weight snapshot grid, data values/preferences, links and actions preserved.
- Headless scheduled/add/resize widget rendering reads persisted `leanlog_appearance_v1` directly without hooks/context or requiring the main app open; missing/invalid/storage-error defaults to Original. Theme read happens after finance data preparation. In-app refresh paths and account-widget configuration pass the same saved theme; Daily data includes it. Theme Apply schedules refresh of all widget types only after durable preference save; failed saves do not refresh or change theme. Refresh is secondary/non-blocking, preserving responsive Apply and finance operations.
- Native widget renderer loads Typeface from Android `assets/fonts`, not Expo's runtime font registry. New `plugins/withWidgetThemeFonts.js` copies exactly nine static faces using existing npm font assets, with names matching typography aliases. Included in app.json. No new dependency; APK gets an additional native copy of those assets (~0.91 MiB raw before compression). Requires next native APK, NOT an OTA-only update. Widget configuration UI also wrapped in ThemeProvider with themed text/styles and dark ink on mint actions.
- Seven new widget/apply regressions: saved-theme/fallback, Original identity, real widget-tree builder for all five types/all themes, text/background contrast, every rendering entry point, native asset copy/name verification and refresh only after successful persistence. Existing Daily data/grid tests updated. Combined 233 tests, TypeScript, Expo prebuild config and Android Metro checks run. Launcher/device typography, sizing and live refresh require phone acceptance. No APK/version bump/commit/push requested/performed this turn.

## Included in v2.9.21 — RedCoins Home contrast and card order (release build)

- User reports Daily Summary, Calendar, Budget Summary, Favorite Accounts and Cash Flow awkward/unreadable in all themes except Original. Root cause: `dashCard` retained `rgba(255,255,255,.78)` while legacy text was remapped to light dark-theme foregrounds. Added explicit Home surface/foreground treatment (`services/redcoinsHomeAppearance.ts`) instead of broadly changing RGBA overlays elsewhere. All five non-original themes use opaque semantic surfaces, readable finance foregrounds (4.5:1 contrast tests), larger small chart/calendar/donut/legend labels and wrapping summary lines. Cash flow/chart fills follow Home financial colours. Original palette retained; large donut totals now fit the centre. Shared BudgetDonut consumes same scoped styles. Transaction, balance, report period and widget logic unchanged.
- RedCoins Home → Arrange Home opens a preview-order list with Move up/down, Reset order and Save. Six cards: Daily Summary, Calendar, Budget Summary, Favorite Accounts, Cash Flow, Cash Reality. Intro stays fixed. Local device preference `redcoins_home_layout_v1`, validated/deduplicated with missing/new cards appended, persists before publishing the order. Read/parse failure defaults safely; write failure keeps previous Home order and offers retry. Back/outside/Close cancel draft; duplicate saves locked. Stable card-ID fragments preserve child identity across reordering; no screen remount or finance-store mutation. Editor disabled until preference hydration finishes.
- Added five Home regressions for order normalization/moves/bounds/immutability, all-theme foreground contrast, scoped geometry/Original preservation and stable renderer/save ordering. Combined 226 tests passed. TypeScript/Android Metro checked for this change; native small-screen/large-text and persisted reorder still require phone acceptance. No APK/version bump/commit/push requested for this turn.
- Dayfold discussed favorably as a possible app name; user has NOT explicitly requested renaming. App/package/branding remain LeanLog.

## Latest published release — v2.9.17 ARM64 (9 October)

- Published v2.9.17 / versionCode 22, ARM64-only, source commit `b9a4a5a42bd1eddc2954d2be55c2ba6ca0896057` pushed on `github-release-v221`. EAS `45ef615d-0d44-4131-a4b6-dbffc1d0e78d` FINISHED. Includes all six themes and offline typography below; older unreleased/no-build notes are historical and superseded. 221 tests, TypeScript, Expo prebuild configuration, Android Metro and native build passed. Native theme layouts/focus/large text need phone acceptance.
- APK: https://github.com/umarislah86-collab/leanlog/releases/download/v2.9.17/leanlog-V2.9.17.apk — 43,536,063 bytes / 41.52 MiB. SHA-256 `2ea1f5524dc98e48b9b8027ea3120e7a635f5da5e9d80a03c96891b1dd151825`. Package/version/code, ARM64 ABI, ZIP CRC integrity, APK v2 signature and signed content digest verified; unchanged certificate `62a8aa1dd325bbe4b76855f4f3cc239950c4133b76ff904244cad6c78695161c`. All nine theme font hashes match source assets. GitHub latest-release API returns v2.9.17 with matching asset size/digest; Semak Update resolves this APK.

## Included in v2.9.21 — six themes with bundled typography (release build)

- User requested three additional themes, with fonts changing the complete experience, not just colours. Added Grove (sage, Lora + Manrope), Dusk / Studio (plum-black, Space Grotesk), and Folio (ivory/oxblood, Lora + Space Grotesk). Total six choices under Settings → Personal preferences → Appearance. Original / Cream retains existing system/serif typography. Midnight uses Space Grotesk headings/labels/figures with Manrope body; Soft Neutral uses Manrope throughout.
- `services/appTheme.ts` includes explicit heading/body/label/number font roles and static-weight resolution. `services/themeFonts.ts` references exactly nine static TTF assets directly from the three new pinned-by-lockfile `@expo-google-fonts` dependencies; 951,972 bytes total (~0.91 MiB) before APK compression. No runtime font download, no unused font weights/images bundled. Startup loads preferences and fonts before app mount; failure leaves the app usable with system fonts and a visible Appearance warning. Reopening retries loading.
- Stable `ThemeText`/`ThemeTextInput` wrappers resolve font family AFTER existing style arrays, while preserving size/line height, color, input values/events/selection/refs. Native nested Text inheritance retained when children have no explicit typography; monetary/numeric strings and numeric inputs use number roles. Monospace AI prompt remains monospace; icons are not re-fonted. React Navigation gets corresponding static font faces. No theme keys/remounts or changes to SQL, balances, transaction saves, reminders, PDFs or widgets.
- Candidate preview has its own typography scope, so selecting a theme previews its actual fonts without applying it. Explicit Apply remains the only persistence action. Included user-readable copyright/OFL font licences in Appearance → Font credits & licences (`services/themeFontLicenses.ts`). Dusk accent actions use a readable plum fill rather than Midnight's coral fill.
- Verification: 221 regression tests passed (15 appearance tests, including startup-font barrier/failure, all bundled faces, candidate preview, weights and input forwarding); TypeScript and Android Metro export passed (`output/themes-six-check`, 1293 modules, exactly nine new font assets). Native text shaping/large-text layouts/focus still need device acceptance. No version bump, APK build, commit or push requested/performed this turn.

## Included in v2.9.21 — Appearance themes (release build)

- User approved Original / Cream (default), Midnight and Soft Neutral, with preview before apply. Access: Settings → Personal preferences → Appearance. Picker previews sample data only, explicitly applies/persists the choice; Close/back/outside dismiss cancel without changing appearance. Duplicate apply blocked, native-storage failures keep previous theme. Theme key `leanlog_appearance_v1`; invalid/missing/read-error falls back to Cream. Hydration precedes app mount to avoid flashing the wrong theme.
- `services/appTheme.ts` central semantic palette and explicit legacy colour aliases. Role-aware canvas/surface/hero/text/border/tint mapping, not RGB inversion. Dark finance foregrounds and button fills use different readable shades while preserving expense-red/income-green/transfer-blue meaning. Account/avatar identity colours and chart series remain distinct. `theme.ts` retains the original immutable baseline for existing styles/print/widget compatibility; new UI should use `useTheme().palette` directly.
- `context/ThemeContext.tsx`: provider above splash/auth/onboarding/navigation, cached per-palette StyleSheets, no global palette mutation or theme-dependent screen keys. All nine screens plus shared modals/charts wired to context; memoized ledger rows consume context. Conditional RedCoins section-render helpers/map callbacks inherit screen styles/themed function, NEVER invoke hooks themselves. Main/native navigation status bar follows selected light/dark appearance; React Navigation receives corresponding theme.
- `ThemePrimitives.tsx`: stable forward-ref Text/Input components; unstyled labels/inputs get semantic defaults, nested Text keeps native colour inheritance, input value/selection/events/refs passed unchanged. TextInput keyboardAppearance and selection/placeholder defaults follow palette. Existing explicit styled props override defaults. No transaction/account/budget/reminder/SQL save logic changed. Native Android date dialogs/keyboard/font scaling still require phone inspection.
- Explicit saturated-mint action text/icons retain dark ink; selected recurring controls get a separate on-accent text style. Screens/modals update without intentional remounts; draft/focus preservation still requires device acceptance. Appearance preview modal scrolls with fixed apply footer for small screens/large text.
- Scope: in-app LeanLog/RedCoins only. PDFs/CSV, launcher widgets, notification payloads and saved account/avatar colours retain their own design/data. No new backend service. Font assets/dependencies were subsequently added as detailed above. App remains 2.9.16, latest published APK does NOT include these changes; no APK/build/commit/push requested this turn.
- Added 11 theme regressions: default/validation, exact Original style preservation, immutable role mapping/geometry, identity colours, foreground contrast, startup hydration/fallback, apply/write failure/concurrency, cached styles, ref/value/selection forwarding, preview cancellation/stable app tree and AST protection against nested conditional theme hooks. Combined 217 tests, TypeScript and Android Metro (`output/themes-check`, 1282 modules) passed. Actual native theme screenshots/keyboard/modal/rotation/widget/PDF regression checks pending next ARM64 APK.

## Latest published release — v2.9.16 (9 October)

- Published ARM64 APK v2.9.16 / versionCode 21, source commit `2669084b56a758cdc6ea7e21857e94de00fd7a7c`; EAS `5d24b633-8ae0-4158-bc7e-41065e9bd5d0` FINISHED. Includes all SQLite Save, Settings/Plan hierarchy, unified budget editor and read-only data audit changes below. Their older unreleased/no-build notes are historical and superseded by this release. 206 tests, TypeScript, prebuild config, Android Metro and EAS native build passed. Phone migration/Save speed/backup/restore verification pending.
- APK: https://github.com/umarislah86-collab/leanlog/releases/download/v2.9.16/leanlog-V2.9.16.apk — 43,044,723 bytes / 41.05 MiB. SHA-256 `47589dfde264a181d4e3bb42c8230c12df8366a1e36a8cb1cb04d1496cf2521d`. Manifest package/version/code, ARM64-only libraries, ZIP CRC integrity, APK v2 signature and signed content digest verified. Signer unchanged: `62a8aa1dd325bbe4b76855f4f3cc239950c4133b76ff904244cad6c78695161c`. GitHub uploaded digest matches; public download HTTP 200 and latest-release API resolves v2.9.16.
- Before phone update export a fresh RedCoins JSON backup, install over the existing app without clearing data. SQLite migration copies saved balances exactly and keeps recovery JSON; do not downgrade after new SQL-only entries without exporting a fresh backup.

## Current architecture — authoritative SQLite Save (unreleased; supersedes older JSON/index notes)

- User approved migration after inspecting original Bluecoins v13.1.65 APK: targeted Room/SQLite save completes successfully before readyToClose/navigation; reactive observers refresh the ledger and PostTransactionWorker performs secondary work. Implemented those principles independently, not copied decompiled app code. No guarantee of identical phone latency.
- `services/redcoinsSqlStore.ts`: `redcoins-store.db`, WAL/FULL, `rc_records` per entry/account/category/reminder and `rc_meta` for smaller state metadata/revision/schema marker. `redcoins_entries` is a LIVE SQL view of authoritative entry rows, not a second materialized index. Legacy `redcoins-ledger.db` is no longer read/written. Query APIs retained for scrolling/filtering. No FYDB on ordinary startup.
- First financial load performs exact one-time JSON snapshot migration. Byte-for-byte `redcoins_pre_sqlite_v1` recovery checkpoint verified BEFORE SQL; record counts, payloads/order and metadata verified in the migration transaction before commit. Saved account balances are copied exactly, never rebuilt from transaction history. Original `redcoins_state_v1` remains untouched recovery data after migration; it must NEVER again be treated as current finance state. Do not delete app data or downgrade without exporting a fresh backup.
- Saves write changed rows/deletions + account balances + schedules + metadata in one exclusive SQLite transaction. Stable ranks prevent rewriting old entries on prepend. Normal logger passes changed entry ID to skip serializing unchanged entry payloads; bulk/import/restore/status repair use full comparison. In-memory snapshots are cloned without whole-ledger JSON serialization. Revision token survives object spreads and import/reminder cloning; stale versioned edits reject instead of overwriting newer state. Record IDs unique, monetary values finite. Errors roll back SQL and preserve logger draft.
- Logger dismisses keyboard/yields native frames, loads latest state, validates/commits first, then closes without Save animation and refreshes visible ledger; summary/widgets run after paint. Durable success is never announced before SQL commit. This supersedes the earlier close-before-write optimization below. No optimistic pretend-save.
- Widgets, runtime/reminders, JSON backups/restore, cloud transport and read-only data audit now use authoritative SQL APIs. `readSavedRedCoinsRaw()` exports JSON for explicit backup/preview only; no due processing or legacy migration on read-only audits. Before SQL initialization audit may read legacy JSON unchanged. Cloud backup keeps the existing `redcoins_state_v1` wire-field but fills it from SQL; cloud restore validates it and commits via SQL compare-and-replace. Local recovery checkpoints are not overwritten by imported cloud checkpoints.
- Restore checks canonical snapshot equality rather than object property order. Whitelisted finance preferences journalled inside SQL restore commit, mirrored to AsyncStorage under exclusive lock; failed mirroring keeps retry journal, not a false failed ledger save. Next ordinary load retries. File/cloud restore checkpoints remain in place. SQL read failure must NOT fall back to stale JSON or FYDB.
- Validation: real SQLite integration tests for exact migration/restart, immutable recovery, read-only audit, migration failure rollback, transfer insert + both balances rollback, 1,000-entry incremental prepend (only two row writes), live status/deletion, stale concurrent edits/cache refresh, restore/pref retry, duplicate IDs, missing-revision fail-closed safety and actual ledger queries. 206 tests passing; TypeScript and Android Metro export (`output/sql-store-check`, 1278 modules) passed. Node SQLite harness validates SQL behavior, not Expo Android/device performance. Phone migration, force-stop/reopen, reminder/headless concurrency, Save timing and backup/restore still require next APK test. No APK build/version bump/commit/push requested or performed this turn.

## Included in v2.9.21 — immediate RedCoins logger Save response (release build)

- User reports ~1 second before logger closes; requested immediate response like Bluecoins. Validated drafts now close logger without the Save dismissal slide, dismiss keyboard, and yield two native frames BEFORE loading/reconciling/saving the ledger. Invalid inputs keep the form open. Draft survives; failed reads/writes reopen the form and show the error. Duplicate-income Cancel returns to the draft; Review opens the matching entry. Save/new/edit/schedule/detector entry points are protected against opening a competing draft while commit is pending.
- Transaction/schedule commits still use fresh authoritative storage, run normal due/balance reconciliation, and await durable local save before publishing state/indexing/navigation. Schedule-only Save still does not create an immediate normal transaction. Deleted account/entry during editing is rejected rather than recreating it silently. Index/summary/widget/notification failures after durable save are secondary failures, not claims that transaction saving failed.
- Removed redundant whole-ledger stringify/parse on ordinary load and a repeated stringify on save. Pending write snapshots remain isolated, writes ordered, migration checkpoints preserved and external backup restores visible (no long-lived stale cache).
- State events optionally carry a source token. The saving RedCoins screen skips its own redundant reload because it publishes the committed snapshot directly; other consumers still receive events. External changes/reminder events/restores reload normally. Summary/widget refresh yields a frame and stale deferred refreshes are skipped. Reports and logger suggestions/category lists no longer calculate while hidden.
- Tests: seven new Save latency/commit-order/storage-failure/source-event/frame-handoff regression tests, plus existing money/due/import/restore tests. Frame handoff has a 100ms fallback so backgrounding does not strand a pending save waiting for visible frames. Phone timing, rapid logging and failure-draft behavior still need device testing. No APK/version bump/commit/push requested this turn.
- Final checks: 196 combined tests pass; `npx tsc --noEmit`, `git diff --check` and Android Metro export pass (1277 modules, `index-dddc5edcfcc74259adeee930d9f2c64e.hbc`). Existing unreleased hierarchy/audit changes preserved.

## Included in v2.9.21 — app hierarchy / unified budget setup (release build)

- User approved all clarified hierarchy changes: Settings grouping, Accounts → Manage categories doorway, Plan overview with Budgets / Spending guards / Reminders & auto-log, and one budget editor per target for salary-cycle / N months / custom dates. No new build request. Preserve the Check my data work below. Home/Activity/Reports/health content unchanged; Home read-only action links now route directly to the relevant Plan subpage.
- Settings uses top-level stable `SettingsGroup` accordions: Personal preferences (language/nutrition/macro explanation), Reminders & home screen (Nag Mode/daily reminders/widgets), Data & recovery (cloud checkpoint/Bluecoins import/RedCoins JSON backup/Check my data), Account & app (login/update/history/feedback). All original handlers retained once, first group open by default. No changes to cloud/backup contents or account actions.
- Accounts shows Manage categories directly after heading and before balances. Existing category/subcategory CRUD/icon controls are on a dedicated in-tab page. Back returns Accounts before tab history. Plan has a compact three-row overview; details reuse existing controls, detectors/inbox under Automation, cash account/buffer/commitment controls under Budgets, guards under Guards. Android/header Back returns overview before tab history. ScrollView key changes only by section/subpage, resets new subpages to top; financial state/typing updates do not remount controls. Ledger virtualization unchanged.
- Removed the separate RedCoinsTermBudgets UI and old cycle-only BudgetModal; new stable `RedCoinsBudgetEditor` serves the existing budget list. `redcoinsBudgetSetup.ts` reads legacy cycle/period choices without migration. Conflicts display explicit choices; Save/Remove confirms replacement of ALL existing settings for the exact target only. Fresh-state target comparison prevents overwriting a concurrently changed budget. No ledger/account changes. Changing to period removes that target's scalar cycle allocation; changing to cycle removes its period definitions. New category-wide vs child overlap is refused, not silently merged/deleted. Legacy category-wide definitions remain accessible inside their original category card and can be removed to resolve overlaps.
- Active non-conflicting periods contribute a clearly labelled monthly planning equivalent to allocation/category totals: amount / months or amount × 30.436875 / inclusive custom-day count. Not an actual expense/cash deduction, not the true period limit. Upcoming/ended one-offs excluded; carry-forward does not inflate baseline allocation. Conflicting exact targets retain scalar allocation, their period equivalent excluded rather than counted twice. Child rows show real period dates/status/spent/remaining/progress; conflicts show RESOLVE instead of misleading progress. Saving checks combined planning allocation against cycle ceiling. Whole-category and child limits must be resolved manually if legacy overlap exists.
- Data-audit schedule targets route to Automation; budget targets to Budgets. Home Cash Reality/commitment/payday links route to Budgets, guard links to Guards. Nine hierarchy/setup regressions added, 189 combined tests, TypeScript/diff checks and final Android Metro export (`output/hierarchy-check`, 1276 modules) passed. Orphan period definitions remain review/removable in Budgets, and orphan/category-level-overlap periods are excluded from planning allocation until repaired. Phone navigation, typing, legacy conflict choice and period allocation testing pending. No APK/version bump/commit/push this turn.

## Included in v2.9.21 — Settings Check my data (release build)

- User approved read-only data health audit in Settings (not a new APK/build request). Settings → RedCoins data health → Check my data. `RedCoinsDataCheck.tsx` waits for existing writes and reads the durable `redcoins_state_v1` directly; deliberately never calls `loadRedCoins` so the scan cannot migrate, apply due balance effects, log schedules or read FYDB. Errors leave data untouched. Explicit rerun; state-change events mark the displayed snapshot stale.
- Pure `services/redcoinsDataAudit.ts` checks missing transaction accounts, broken/same-account transfers, invalid amounts/dates/types/balances, repeated IDs/account names, missing historical categories (review hint), due/applied timing flags, enabled schedules with missing account references, possible same-day transaction duplicates and recurring/attributed-month income duplicates, missing/overlapping period budget targets and cycle-vs-period overlap. Excludes future/void/intentional-copy records from duplicate hints, never scans trash as live ledger. All duplicate/overlap findings are hints, not automatic deletions/merges.
- Balance verification is intentionally limited to saved SEMAK bank comparisons: rewind current saved balance by applied post-cutoff movements, compare with the user's saved bank figure for its as-of day. Signed credit/loan balances retained. A mismatch may mean an outdated bank comparison, not proof of corruption. No zero-based ledger reconstruction or assumed opening balance. Shows unverified account count and explicitly says no issues does not guarantee bank reconciliation.
- Results cap display at first 300 while retaining complete issue counts. Review navigates to RedCoins via a consumed `auditTarget` route request: entry opens existing logger for review (does not save), account opens SEMAK, budget/schedule opens Plan. Opening the normal RedCoins screen may perform its ordinary catch-up; the audit itself does not. Missing/deleted target gives rerun prompt. No repair button or automatic financial mutation.
- Eight audit regressions added. 180 combined tests, TypeScript, diff checks and final Android Metro export (`output/data-audit-check`, 1275 modules) passed. Real-phone UI/navigation validation pending. No APK/version bump/commit/push; do not build or commit/push unless requested.

## Latest published release — v2.9.15 (7 October)

- User explicitly approved period budgets and ARM64 build + GitHub commit/push/APK publication. Includes all unreleased changes below: status mapping, favorite accounts, widget alignment, What changed hierarchy/drilldown, manual bank review, JSON folder/automatic backup/restore and duplicate income warnings. This section supersedes earlier pending/unapproved statements below.
- Plan → Budgets beyond one cycle: category or subcategory, positive total limit, calendar-month intervals 1–120 (presets 1/2/3/6/12) or inclusive custom date range, start date, repeat/once, optional cumulative net-unused carry-forward, informational monthly reserve. Custom repeat uses identical calendar-day length. Calendar boundaries anchor to original day, clamp at month end without drift. Future, non-expense, void and unrelated ledger entries excluded. No transaction creation, cash deduction, or salary-cycle pool allocation; actual paid expenses continue to count in their real salary cycle. Reserve is a suggested amount only, not actual savings tracking.
- Period limits deliberately live separately from scalar salary-cycle subcategory budgets: never sum unlike ranges or charge a two-month limit every cycle. Category/subcategory renames migrate period targets; removed targets stay visible with repair warning. Overlapping limits are possible and UI warns they are independent, not additive. Period definitions included in validated JSON backups and retained by explicit Bluecoins imports.
- Five pure range regressions added; 172 tests, TypeScript, Expo prebuild config, diff checks and Android Metro export (`output/v2915-check`, 1273 modules) passed. EAS `0a6c2aba-56a2-4664-9b03-cbcd95a17f56` FINISHED, exact source commit `be1d76b6f297cb3fde3321af6d5201b6c41f896f` pushed on `github-release-v221`. APK package/version verified: `com.calorietracker.app`, v2.9.15 / versionCode 20, ARM64-only, intact ZIP, valid APK v2 signature. Same signing certificate `62a8aa1dd325bbe4b76855f4f3cc239950c4133b76ff904244cad6c78695161c`.
- Published APK: https://github.com/umarislah86-collab/leanlog/releases/download/v2.9.15/leanlog-V2.9.15.apk — 42,999,235 bytes (41.01 MiB). SHA-256 `b1f7b119169ddb830312886e008df451193da2488a6842b5fed63658c52da0b0`. GitHub latest-release API returns v2.9.15 and exact filename; uploaded size/digest match local APK, public download HTTP 200. Request to build/commit/push is complete; do not start another build without user request.
- Phone verification pending: upgrade without uninstall; backup before update; period boundaries/repeat/carry/reserve, income warning Cancel/Review/Save anyway, manual bank review/ticks, SAF folder grants/manual/auto/restore/recovery, favorite selection, widget geometry, analysis child drilldown and imported labels. Keep real-device verification separate from build/test success.

## Included in v2.9.21 — duplicate income warning / multi-month budget discussion (release build)

- User approved duplicate warning for late EPF logging. New pure `redcoinsIncomeDuplicate.ts` checks active income entries only, excludes edited ID, matches normalized title + account + attribution month. Monthly EPF/KWSP/salary/payroll/pension (or explicit attribution month) warns even with differing amount/date. Ordinary income such as multiple rebates only warns for exact same-day/title/account/amount, avoiding noisy monthly false positives. Warning is not proof and never deletes/merges/blocks a genuine extra payment.
- Logger optional **UNTUK BULAN · YYYY-MM** for income, blank defaults to actual transaction month for checks. `incomePeriod` is attribution metadata only; it does NOT redistribute report/salary-cycle totals or bank balances. Actual transaction date remains cash-flow authority. Stored/edited/restored metadata survives through authoritative entry lookup when opening SQLite display rows. Suggestions intentionally do not inherit prior income period. Schedule templates do not copy a fixed attribution month into every future occurrence. Backup validator supports the optional month. New logs capture loggedAt separately.
- Save warning lists up to four existing dates/amounts/months, Cancel / Review latest / Save anyway. Save path loads latest state and reloads after confirmation to avoid stale dialog state; submit ref guards duplicate simultaneous taps. No warning when merely creating/editing a schedule; auto-log/import/batch paths are not silently deduplicated. User can backdate actual receipt date separately if that date was logged incorrectly.
- User asked how to handle non-monthly budgets (motor oil every two months). Current scalar subcategory budgets are salary-cycle only. Proposed future interval budget: amount over N calendar months with explicit starting month; optional separate monthly reserve (RM80/2 months → RM40/month), never treating RM80 as monthly allocation. Multi-month budget/reserve UI/calculation is NOT implemented/approved yet; explain and confirm next.
- Added five income-duplicate regressions: variable amounts/date within month, late attribution vs actual date, edited/self/account/type/month exclusions, ordinary rebate false-positive avoidance, custom attribution/month validation. All 167 tests, TypeScript, diff checks and Android Metro export (`output/income-duplicate-check`, 1271 modules) pass. UI confirmation flow/device tests pending next APK. No APK build/commit/push performed.

## Included in v2.9.21 — RedCoins JSON restore + folder/automatic backup (release build)

- User approved JSON restore and folder/auto-update backup. Interpreted “auto update” explicitly as automatic JSON backup updates, NOT APK updates. Access Settings → RedCoins backup & restore. Choose persistent Android SAF folder; Back up now; Auto-backup toggle; After edits (10-second debounce) / Daily (at most once per local day). Runtime checks on launch, AppState change and every 15 minutes while running; no promise of background execution after Android suspends/kills the process. New timestamped snapshots with random suffix, no overwrite/automatic deletion; UI shows last success, filename and last error. Folder failure does not affect ledger, previous files remain intact. Backups can accumulate; keep off-device copy/manage history manually.
- `redcoinsBackupFiles.ts` reads only local authoritative RedCoins JSON + whitelisted finance preferences. Excludes FYDB cache/auth/device folder grants/notification IDs. Snapshot read-back verification required before reporting success; serialized backup queue and unchanged-change deduplication. Auto work pauses during restore; failure recorded and retried on next runtime trigger. Persistent folder choice stays device-local and is not imported from backups.
- `RedCoinsBackupSettings.tsx` document picker → validation → preview counts/account balances/export date → explicit replace confirmation. No merge/duplicate append. Warning for orphan account refs, old exports without guard/cash preferences, widget account selections and restored enabled/overdue schedules. Old v1 backup format remains supported; new v1 backups add whitelisted preferences. Old backup restore clears unrelated current guards/cash choices instead of mixing two ledgers; UI tells user to reconfigure. Food/health data unaffected.
- `redcoinsBackupFormat.ts` validates schema/version/date/balance/entry/category/schedule/nested settings/IDs; rejects foreign/malformed/unsafe fields and >50MB; strips notification IDs. `redcoinsBackupRestore.ts` stages without modifying data, saves and verifies pre-restore checkpoint in AsyncStorage + app documents (and best-effort selected-folder copy), then serialized compare-and-replace with ledger + finance-preference freshness guards. Recovery UI can preview/restore that checkpoint. Successful replacement refreshes index, summary, widgets and reminder alarms; failures after commit are warnings, not a false “restore failed”. Schedule catch-up uses existing load logic, warned in preview. No FYDB startup access.
- Existing Accounts BACKUP REDCOINS now uses saved folder when configured, otherwise Save-to-folder/Share export flow. Snapshot includes accounts/icons/categories, schedules, deletion markers, favorites, bank reviews, budgets + supported finance settings. Native document picker added via Expo-compatible `expo-document-picker ~57.0.3`; a new APK is required, not an OTA-only change. No version bump/EAS build/commit/push requested.
- Validation also checked the user's actual 5/6 October JSON backups: both pass. 162 tests, TypeScript, Android Metro export (`output/backup-restore-check`, 1270 modules), git diff checks and Expo prebuild config pass. File backup capture waits for pending serialized RedCoins writes. Auto-backup resumes after restore and attempts a fresh snapshot when enabled. Phone SAF picker/permissions/restore/widgets/alarm behavior must still be tested in next APK.

## Included in v2.9.21 — manual bank reconciliation (unreleased, source only)

- User approved manual side-by-side banking-app workflow (wife normally compares CIMB Clicks to Bluecoins on two devices, no PDF download). Access: RedCoins → Accounts → green double-check **SEMAK** button beside each account. Existing account row still opens ledger; pencil still edits account.
- New `RedCoinsBankReviewModal` supports From/As-of local date range, signed bank balance, read-only RedCoins as-of balance and bank-minus-RedCoins difference, title/amount search, unchecked-only view and per-entry review ticks including transfers into/out of the selected account. Save persists one resumable draft per stable account ID in `bankReviews` (also covered by backup JSON). Back prompts before discarding unsaved progress.
- `redcoinsReconciliation.ts` rewinds authoritative saved current balance by applied later movements, not a rebuild from zero. Future and unapplied effects excluded; historical initial/imported offsets preserved. Uses integer cents, validates dates/bank amounts; as-of today means up to now. Compare posted/current bank balance, not available credit or pending authorisations; debts require negative bank balance. Dates/initial balance errors remain visible rather than silently adjusted.
- Ticks are independent review metadata: NEVER adjust account money, ledger entries or review statuses. Difference does not disappear when rows are ticked. Stored transaction signatures invalidate ticks if amount/date/type/account/title changes; deleted rows do not count. Source duplicate-account identity merging redirects saved reviews to canonical IDs (latest saved draft wins); account rename can invalidate old signature ticks conservatively. Saving merges into latest state and reflects immediately; no FYDB startup access, no new native permissions/dependencies.
- Seven added tests cover actual/historical balances, transfer sides/self-transfer, cents, immutable projection, JSON progress/edit invalidation, signed debt/malformed input, local-day boundaries/invalid future windows, and durable save/load preserving statuses/balances. All 154 tests, TypeScript and git diff checks pass; Android Metro export passed (`output/bank-review-check`, 1261 modules). Phone UI check pending next APK. No APK build/commit/push performed.

## Included in v2.9.21 — What changed hierarchy and ledger drilldown (release build)

- Category rows now have 14px bold names and expand chevrons. Subcategories use an indented left rail, explicit SUBCATEGORIES label, 11px medium names, smaller rate text and navigation chevrons. Removed the redundant category-wide transaction dump beneath subcategories; tap a subcategory instead.
- `analyseRedCoins` exposes the exact current `comparisonWindow` (same elapsed salary span or custom report period, capped to actual entries). Tapping a child opens Activity with expense + exact parent category + subcategory filters and that window, clearing stale search/accounts/selection/date-day constraints. Empty subcategories are supported; same-named children of other categories, baseline history and future transactions are excluded.
- User interested in reconciliation: initially said PDF, then clarified wife normally compares CIMB Clicks and Bluecoins side by side on two phones, without downloading statements. Proposed a manual account reconciliation session (account/as-of date, bank balance, tick matched transactions, visible difference, no automatic balance adjustment). This reconciliation workflow and any monthly review expansion are NOT implemented yet; discuss next. Current report already contains breakdown, What changed, daily comparisons and analysis; suggested monthly review should be a concise insight summary inside Reports, not a duplicate tab.
- 147 tests, TypeScript, git diff checks and Android Metro export (`output/analysis-drilldown-check`) passed, including comparison-span drilldown tests for salary/custom reports, namesake exclusion, income/future exclusion and empty subcategories. Native device visual/navigation check awaits next APK; no APK build/commit/push performed.

## Included in v2.9.21 — Daily widget snapshot alignment (unreleased, source only)

- User screenshot showed the column boundary drifting between rows in the four account snapshots. Android LinearLayout weights previously used wrap_content base sizes, so unequal labels/balances affected each row's split. Daily widget account AND guard cells now share width:0/flex:1 with fixed 32dp height and centered content; consistent 3dp gutter; odd rows retain a zero-base equal-weight empty slot. Colors, content, selection and tap actions unchanged.
- Added widget-tree regression covering 1/2/3/4 snapshots in both modes with unequal label lengths, identical widths/weights/heights/gutters and odd empty slots. All 145 tests, TypeScript and git diff checks passed. Phone/launcher visual verification awaits next APK. No APK build/commit/push performed.

## Included in v2.9.21 — selectable Home favorite accounts (unreleased, source only)

- User asked why Home favorites could not be selected. Old RedCoins hardcoded the first six Bank/Cash/Credit card accounts. Local Bluecoins APK audit (`home/tabmain/cards/favoriteaccounts/FavoriteAccountsCardViewModel.java`, `FavoriteAccountsCardKt.java`) shows a persisted account-ID filter, SelectedAccounts balance flow, and a six-account initial fallback. Applied that core mechanism to RedCoins, without copying Bluecoins UI or premium restrictions.
- Home Favorite Accounts now has Edit → searchable multi-select list → Save Favorites. Any account type and more than six are supported; Clear All + Save deliberately leaves the card empty. Back/outside closes without saving. Keyboard-aware centered picker avoids hiding search results below the keyboard. Selection is independent of Cash Reality/spendable cash, widget configuration and transaction filters.
- `favoriteAccountIds` persists in the authoritative RedCoins state and backup JSON. Undefined preserves the old initial six-account fallback; explicit [] never reverts to defaults. `services/redcoinsFavorites.ts` resolves current balances/names by stable ID, ignores deleted IDs and deduplicates. Source account identity reconciliation redirects favorites when merging old duplicate accounts. Save merges with latest loaded state, reflects immediately via existing state/event pipeline; no FYDB startup read.
- Added four regressions for legacy defaults/non-mutation, all account types/no six-item limit/empty selection, ID-based rename/live balances/JSON persistence/deleted IDs, and duplicate-account redirects. 144 tests, TypeScript, git diff checks and Android Metro export (`output/favorites-check`, 1259 modules) passed. Device verification awaits next APK; no version bump/APK build/commit/push performed.

## Included in v2.9.21 — imported review status repair (unreleased, source only)

- User verified v2.9.14 on phone: scrolling is smooth without jumping and RedCoins opens immediately. Then reported pervasive PENDING labels on imported history. User requested code only; do NOT build/commit/push until asked.
- APK audit confirms Bluecoins Status/StatusDto: None=0, Cleared=1, Reconciled=2, Void=3. Old parser mapped every non-1 value to Pending. New `services/redcoinsStatus.ts` maps these distinctly; null/unknown maps None, never guesses Cleared. Parser retains numeric `sourceStatus` and `statusMappingVersion:1`, defaults null to None. RedCoins Pending remains a local review state. These annotations do not gate balance/spending calculations; Void source annotation is not implemented as a deletion or financial reversal.
- Once per state, `loadRedCoins()` repairs untouched imported rows, preserving local rows and anything with editedAt. Known raw values restore exact status. Old lossy Pending without raw metadata becomes None with `legacyStatusUnknown:true`, NOT claimed Cleared/Reconciled; exact historic status is irrecoverable without a source. Explicit later FYDB import can recover source metadata even when the displayed status is unchanged. No FYDB/Drive reads or money replay at startup. `redcoins_pre_status_mapping_v1` saves the exact old state before durable save; state/row mapping markers prevent repeat migrations. Balances, amounts/dates, adjustments and tombstones unchanged.
- Ledger index fingerprint includes status so status-only repair reindexes without manufacturing editedAt. None has no ledger badge, real Pending remains shown, Reconciled retains its badge, Void shows a source-status badge with matching 64px row geometry. Batch review picker adds None. CSV emits blank for None, avoiding Bluecoins' fallback-to-Cleared for an unsupported text value.
- Added seven regressions: enum mapping/parser wiring, lossy migration, preserving user/local statuses, known raw restoration, status-only index invalidation, durable checkpoint/idempotence/no FYDB/no balance changes, explicit-import metadata recovery. 140 tests, TypeScript, git diff checks and final Android Metro export (`output/status-mapping-check`) passed. New status behavior still needs phone verification in the next APK. App version remains 2.9.14; no build/commit/push performed.

## Latest published release — v2.9.14 (7 October)

- Published ARM64 v2.9.14 / versionCode 19, source commit `992b14e8ec67fd8837e7d08e694a250e09fdccee`; EAS `ab578a9a-414e-438e-be1e-dbea0757504a` FINISHED. All cumulative work below is included: authoritative local RedCoins state/import preview, ledger scroll stability, compact salary filter, direct period navigation, report metric drilldown, exact salary timestamps and early LOG NOW. Older no-build/pending statements below are historical, superseded by this publication.
- 133 tests, TypeScript, Expo prebuild config, diff checks, final Metro export (`output/release-2.9.14`) and EAS native build passed. Manifest package `com.calorietracker.app`, version/code, ARM64-only libraries, ZIP integrity and APK v2 signing verified. Signer unchanged: `62a8aa1dd325bbe4b76855f4f3cc239950c4133b76ff904244cad6c78695161c`.
- APK: https://github.com/umarislah86-collab/leanlog/releases/download/v2.9.14/leanlog-V2.9.14.apk — 42,856,899 bytes / 40.87 MiB. SHA-256 `ba076faaf02ff65b47e9f05ae4c2a9fd3780922e239cbd854da482ef64cad7ca`. GitHub asset size/digest matches local file, public download HTTP 200, latest-release API returns v2.9.14 with the exact APK filename; Semak Update/automatic checks therefore resolve the new APK.
- Native phone validation remains pending: backup before upgrade, repeated cold opens preserve balances; deep ledger scroll/refresh; import preview cancel/confirm/repeat; salary/loan timestamps around payday; early LOG NOW plus original due without duplicate; notifications and current recurring projections. Do not equate native compilation/signing with device behavior.

## Included in v2.9.14 — exact salary timestamps and early Log now

- User explicitly wants the actual salary entry timestamp, NOT midnight on its calendar date: salary at 18:00 starts the new cycle at 18:00 inclusive; a loan logged before it remains in the old cycle. No dates/amounts are rewritten or repayments redistributed artificially. `salaryAnchorTimes`, `salaryFilterCycle`, `activeSalaryCycle` in `services/redcoinsSalaryFilter.ts` share half-open windows; multiple salary credits on the same day use the first timestamp. Future salary entries cannot roll the cycle before their timestamp. Without a recorded Salary/Gaji/Upah source, configured payday is the explicit legacy fallback.
- Authoritative summary, Plan actuals, salary-based guards, Activity salary filters, Reports and AI historical baselines use these timestamps. Main summary chooses the saved report salary source when it is a Salary source, otherwise the most frequent Salary source. Report source identity now includes category/subcategory/title, migrates old title-only preferences on lookup and excludes future anchors. Explicit alternate-income reports remain possible. Expected payday estimates forecasts only; an existing salary cycle does not roll just because the calendar reaches that day. Plan explains the actual start timestamp and labels payday as expected.
- Every reminder/auto-log card now has LOG NOW, even before due; unavailable/paused/completed/broken schedules disable it. Confirmation identifies the earliest unlogged scheduled occurrence. Handler fresh-loads state, checks the expected occurrence, saves one actual transaction dated now, updates both transfer balances once, and reschedules notifications. A tap lock and stale-occurrence rejection guard duplicate confirmation.
- `scheduledFor` retains original due time; `consumedOccurrenceKeys` consumes that original slot without changing startDate, monthly anchor or finite repeat count. Generation, notifications and projections skip consumed slots. Deleting an early transaction does not regenerate the consumed occurrence. Last log label distinguishes manual vs automatic. Existing reminders without these optional fields retain their behavior.
- Nine added regressions cover exact 18:00 boundaries, no calendar/future rollover, shared summary/guard totals, both reminder modes, single occurrence completion, transfers, stale/invalid validation and weekend-shifted slots. Combined suite: 133 tests passed; TypeScript and final Android Metro export passed (`output/salary-time-log-now-check`). APK build, commit/push and phone verification are still pending; not requested this turn.

## Included in v2.9.14 — report metric ledger drilldown

- Income and Expense Stat cards plus Transfers fact are now tappable, marked with a small drilldown arrow, and open Activity with the corresponding transaction type and exact report window. Net retained stays read-only. Old search/account/category/subcategory filters and manual selections are cleared so the displayed metric is not accidentally narrowed by a previous ledger context. RedCoins tab history returns to Reports with its period preserved.
- `reportLedgerWindow` tracks start timestamp, exclusive end and the report's actual-through timestamp; `filterLedgerEntries` enforces these bounds in addition to ordinary filters. Necessary because salary credits can occur midday and custom report windows can contain separately shown scheduled transactions. Report card metrics exclude scheduled rows, so drilldown must also exclude them. Header indicates Report window / actual entries.
- Search and category/type refinements retain exact report bounds. Intentional date-mode/date changes, direct period navigation and dashboard filters clear the report window; Clear All restores ordinary full ledger. Two tests cover exact timestamps/future exclusion/metric totals and the actual screen drilldown handler clearing stale filters. Combined suite 124 passes; TypeScript and Android Metro export passed. APK/device validation still pending; no build/push requested.

## Included in v2.9.14 — direct ledger period navigation

- User approved an Activity bar below search with previous/next arrows and a center label. Center opens Salary cycle / Calendar month / All dates (three Android-native alert choices; back/outside cancels). Search/type/account/category/subcategory filters stay intact; period changes clear manual selections and intentionally reset ledger scroll via changed date filter key.
- Calendar month is now an explicit date-filter mode, with inclusive full-month boundaries and year/leap-year-safe navigation. Single/custom range modes show their label but disable quick arrows until a navigable mode is selected. Month can navigate to future months to inspect dated entries. The filter modal recognizes Month and lets users choose any date within it.
- Cycle arrows use the selected source and actual salary dates, clamp/disable at newest/oldest real cycles, and preserve source identity through modal Apply. Remembered source hydrates on mount without overwriting a newer user selection; cycle/month calculations live in `services/redcoinsSalaryFilter.ts`.
- Four additional regressions cover calendar/year/leap boundaries, current-month defaults, cycle offsets and the actual screen navigation handler retaining unrelated filters. Combined suite 122 passes; TypeScript and Android Metro export passed. Device bar/arrow/filter testing pending. No APK/build/push requested yet.

## Included in v2.9.14 — compact transaction salary filter

- User approved replacing the full income-anchor listing inside Activity filters with one collapsed Salary source dropdown. Implemented in `LedgerFilterModal` in `screens/RedCoinsScreen.tsx`; Reports' separate period selector is unchanged.
- Searchable, bounded-height results; default shows Salary/Gaji/Upah subcategories only. Explicit Show other income expands to other active income sources. Keyboard-aware filter sheet and tap-through search results; back/outside-close and immediate Clear All behavior retained. Main cycle controls show selected source, month, exact date range and previous/next buttons.
- `services/redcoinsSalaryFilter.ts` derives identity from normalized category/subcategory/title, not a transaction ID/date/amount. Same title in different income subcategories remains distinct. Persisted last selected source: `redcoins_filter_salary_source_v1`; deleted/missing preference falls back to a Salary source, never arbitrary income. No Salary found prompts explicit choice of another income source. Future/non-income/invalid-dated rows excluded from anchors; same-day salary credits share a single boundary.
- Six regression tests added: compact default vs 300 other incomes, source identity persistence, fallback/explicit other-income preference, future exclusion, real-payday periods, same-day duplicates and navigation bounds. Combined suite 118 passes; TypeScript and Android Metro export passed; no new APK/build/push requested. Phone keyboard/dropdown/navigation validation pending.

## Included in v2.9.14 — ledger scroll stability

- User reports v2.9.13 Activity scroll jumping backwards from July/August to September/October. Do not attribute it conclusively to FYDB without a phone reproduction. User approved a scrolling implementation change; no APK/build/push requested in this turn.
- Replaced the growing 120-entry SectionList prefix with `components/RedCoinsLedgerList.tsx`: a complete, bounded-render-window FlatList, stable `entry:<id>` / `day:<date>` keys, sticky date headers and explicit per-cell geometry via `services/redcoinsLedgerLayout.ts`. Removed presentation pagination/effect-mirrored ledger arrays and Android child clipping. Does not mount every transaction view; visible-window virtualization remains enabled. Day totals now cover the complete matching day rather than a partial loaded batch.
- Exact row geometry accounts for ordinary, transfer, pending/reconciled rows and device font scale; JSX row/header containers occupy that geometry. Refresh with unchanged row positions issues no scrolling command. Structural changes restore the visible row key and partial-row offset; deletion uses the nearest surviving old row. Only intentional search/filter changes reset to the top. Full filter totals, selection/batch operations, icons and balances retained.
- Five new tests use 5,000 transactions spanning several years and exercise exact offsets, keys, sticky indices, refresh/deep-position preservation, insertion/deletion anchors, cent totals, font scale and actual component wiring with a mocked hook/FlatList runtime. Combined suite: 112 passing tests; TypeScript and Android Metro export passed. On-phone validation pending. Tests are not a native Android gesture test, and this is not a byte-for-byte copy of Bluecoins' proprietary native implementation.
- Device acceptance after next ARM64 build: slow drag and fast fling October -> July -> 2025 and back, no snap backwards/blank clipped rows; refresh while deep; scheduled/new entry while deep; title/filter/clear reset intentionally; selection icons, transfers, sticky dates and large font setting. Native phone validation is still pending.

## Included in v2.9.14 — RedCoins-authoritative architecture

- User approved the complete import architecture change. Implemented locally; NOT in v2.9.13 and no new APK/build/push requested yet. User reports manually corrected Pot aeon now stays at RM1,856; do not infer another correction or remove historic adjustments.
- Normal startup, Home, RedCoins, guards and finance widgets now read `redcoins_state_v1` through `loadRedCoins()` / `getRedCoinsSummary()`. No cached FYDB reconciliation on open. `services/redcoinsSummary.ts` derives local summaries, cycle spending, selected cash, card debt, forecasts and unpaid loan reserves. Actual loan repayments count once as spending; card settlement/internal transfers do not.
- One-time storageVersion 2 migration preserves current balances and adjustments, saves the exact old state at `redcoins_pre_authoritative_v1`, initializes missing future-entry balance flags and disables/unregisters legacy Bluecoins background sync. Future imported/local ledger entries apply once when due; reminder catch-up remains enabled. Legacy settings keys are retained for compatibility, not as an authoritative ledger.
- Explicit Settings import only: `services/bluecoins.ts` exports `readBluecoinsImport()` (three FYDB queries); `redcoinsImport.ts` stages preview / confirms; `redcoinsImportPlan.ts` computes a pure delta. Existing saved account balances are not replaced with source balances. New accounts start from source balances adjusted for due/future rows. Local edits, deletions, source IDs, account icons, deliberate copies and reconciled local transfers are protected. Known deletions require a previously accepted import snapshot; first migration import does not guess missing rows were deleted. Older backups are rejected.
- Preview shows counts and balance changes, requires confirmation, and rejects stale previews after concurrent saves. Before commit, saves `redcoins_before_import_v2` and `redcoins_before_import_preferences_v2`. State save is the commit point; optional index/summary/widget failures return warnings rather than implying the committed import failed. Recovery snapshots are internal storage, not an exposed restore UI. `importSnapshot` retains source date and row IDs, not a duplicate full ledger. The low-level `importRedCoins` compatibility helper is exercised by tests; UI must use staged import.
- 107 regression tests pass, including 21 new architecture tests: repeated opens/imports, migration checkpoint, no replay of unflagged past imports, live plan/cash/guards, cents, loans, future due once, protected edits, RM300 transfer destination, stale/cancelled previews, source deletions, invalid/older sources and post-commit index failure. TypeScript and Android Metro export passed. Native APK / phone testing pending.
- Read-only actual JSON audit: 12 accounts, 3,839 entries, 50 ordinary loads/projections preserved every account balance and adjustment with zero FYDB reads. Parser audit of `daily_backup_2026-10-01.fydb`: 3 read-only SQLite queries, 12 accounts, 3,823 ledger entries, 13 categories; original file hash unchanged. That older FYDB was NOT imported into user data. These audits are not a phone performance measurement.
- Next device checks after the next ARM64 build: repeated cold launches preserve Pot aeon; offline opening; account/cycle/buffer/guard edits reflect across Home/Plan/widgets; explicit import preview cancel/confirm/repeat; future transactions/reminders apply once; renamed/deleted account references and all report/export flows. Historical auto-sync/cached-replay descriptions below are superseded by this section.

## Previous release — v2.9.13 (6 October)

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
- Last released source commit: `992b14e8ec67fd8837e7d08e694a250e09fdccee`.
- Last release: `v2.9.14`, Android versionCode `19`.
- APK: https://github.com/umarislah86-collab/leanlog/releases/download/v2.9.14/leanlog-V2.9.14.apk
- ARM64-only, 42,856,899 bytes / 40.87 MiB.
- SHA-256: `ba076faaf02ff65b47e9f05ae4c2a9fd3780922e239cbd854da482ef64cad7ca`.
- EAS build: `ab578a9a-414e-438e-be1e-dbea0757504a`.

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
- RedCoins state is authoritative `redcoins-store.db` through `redcoinsSqlStore.ts`; `redcoins_entries` is a live view. `redcoins_state_v1` is legacy recovery/cloud wire format only, never a live second source. See current architecture at top.
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

When user says **build**, they mean build AND commit/push AND GitHub release with APK. Do not stop after EAS submission unless user explicitly says they will follow up when ready. The v2.9.14 request is complete; do not start another build without a new request.

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

Read `git status --short` and the v2.9.14 section first, then resume the newest user feedback. Do not equate TypeScript, in-memory replay or native build/signature success with phone verification. Preserve user data and adjustments.
