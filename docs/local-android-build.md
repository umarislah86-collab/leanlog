# Local signed Android APK (Windows)

Run from this repository:

    npm run build:local

The local counter starts above app.json android.versionCode (currently 46).
Setup attempts reserved 40 and 41; failures can leave gaps. Successful local
proof builds: codes 42, 43 and 44. Next automatic code on this PC is 47.
Subsequent attempts reserve increasing codes in .local-build/version-state.json.
Failures can consume a code; this is intentional. If a later cloud build exceeds
the local counter, pass a higher code explicitly:

    npm run build:local -- -VersionCode 50

This does not publish or change the marketing version in app.json. Edit that
version before a feature release. APK files and verification JSON are written
to .local-build/apks (ignored by Git). Optional -OutputDirectory selects another
output directory. The APK is standalone; Metro/Expo Go is not required.

## Installed toolchain on this PC

Private root: %LOCALAPPDATA%\LeanLogBuild

- Eclipse Temurin JDK 17, Windows x64 (Adoptium API package checksum verified).
- Google command-line tools 15859902, SHA256
  90ae805d20434428bffcb699c290860f19bb5f66a67e6b330067e3de801fb04a.
- Android SDK platform 36, build tools 36.0.0 and 35.0.0, platform-tools.
- NDK 27.1.12297006 and CMake 3.22.1.
- Gradle wrapper downloads/caches the project's requested Gradle version.

No Android Studio/emulator installation is needed. The script sets Java/SDK
environment variables only for its process, restores them afterwards and uses
a persistent %USERPROFILE%\leanlog-local junction to shorten CMake paths.
The junction must target this repo and remain on the same drive: Kotlin codegen
rejects mixed C:/L: roots. It does not copy or move repository files.

Setup references:
https://developer.android.com/studio#command-line-tools-only
https://docs.expo.dev/guides/local-app-production/

Internet is required for initial SDK/npm/Gradle/Maven downloads and new uncached
dependencies. This is independent of EAS cloud build quotas, not a guarantee of
fully offline operation. Builds reuse Gradle/native caches when inputs permit.

## Original signing identity

Downloaded once from EAS credentials under umiaq / umiaqs-team, without creating
or changing any key. Original signer SHA256:

    62a8aa1dd325bbe4b76855f4f3cc239950c4133b76ff904244cad6c78695161c

Keystore: %LOCALAPPDATA%\LeanLogBuild\signing\leanlog-release.jks
Metadata: %LOCALAPPDATA%\LeanLogBuild\signing\signing.json

Passwords in signing.json are Windows DPAPI-encrypted for the current Windows
user; the folder ACL permits that user and SYSTEM. Plain credentials.json was
removed from the repository after migration. Do not commit/share these files.
Copying encrypted metadata to another PC/user does not make it decryptable.
Keep a separately protected backup of the original EAS keystore/passwords;
EAS credentials download remains available if authorized on the account.

The script decrypts passwords only into transient process environment variables,
patches the generated release signing config, and refuses APK verification if the
signer differs. It never prints passwords or passes them in command-line arguments.

## Build behaviour

1. Expo prebuild Android, preserving the generated project/cache with --no-clean
   where supported, with no cloud build and no npm installation. Existing
   package scripts/dependencies are restored after prebuild.
2. Override generated versionCode and debug signing for this local build.
3. Gradle assembleRelease, ARM64 only, two Gradle workers, two native compile jobs per project, two Metro
   workers and a 4GB JVM heap.
4. Copy APK and verify package, version, code, ABI, APK V2 signature/content digest,
   ZIP CRC, non-debuggable application and embedded JS bundle using
   scripts/verify-local-apk.py.
5. Restore environment and release the build lock.

The verifier needs Python with cryptography; the script uses this PC's bundled
Codex Python, otherwise Python from PATH. Install cryptography in your own Python
environment if neither is available.

Generated android/, credentials and .local-build/ are ignored. App config and
config plugins remain the native source of truth. Run prebuild again through the
script after config/plugin changes. This workflow targets Windows PowerShell.

## Returning to EAS

EAS was synchronized to 44 during this setup without starting a cloud build.
eas.json currently uses remote version counters. EAS does not automatically know
about offline increments. Before publishing a future EAS APK, synchronize its
Android version counter to at least the highest locally DISTRIBUTED code using
eas build:version:set, then let autoIncrement choose the next number. Also raise
the local counter above any newer EAS build when returning to local builds.

The build script does not call EAS, log in, upload, or consume cloud build slots.
Publication to GitHub remains a separate authorized release step.

## Verified setup result (13 October 2026)

Final script produced 3.0.7 / code 44 in 2m24s (31 executed, 630 up-to-date tasks),
after full native proof builds code 42 (13m01s) and 43 (10m04s). Code 44 APK:
.local-build/apks/leanlog-V3.0.7-local-44.apk (48,970,866 bytes), SHA256
2f94c39211087481c4f908044efbf1537648962026d9bcf985389422609ee242.
Signature/content digest, ZIP CRC, package/version/code, ARM64-only ABI,
non-debuggable application and embedded JS bundle passed. Concurrent build
rejection and package-script preservation were checked. No physical phone
installation/runtime QC was performed as part of this toolchain setup.

This workflow uses installed node_modules and does not silently install/update
packages. Setup proofs used Expo 57.0.27 / React Native 0.86.2; package-lock.json
still pins Expo 57.0.12 / RN 0.86.2 from the cloud source. Use npm ci when restoring
the locked release dependencies, then validate the resulting native APK before
distribution. A fresh npm-ci native build was not part of this setup proof.


Published release build 14 October 2026: 3.0.8/code45, full npm command 6m1.19s
(361.1916276s), Gradle 5m27s; 32 executed / 629 up-to-date tasks. Timing includes
prebuild through APK verification, excludes tests and publication. Durable timing
history is docs/build-timings.json. Local baseline/state now45; next local code46.
EAS remote was last synchronized to44 at setup; sync to at least45 BEFORE returning
to cloud builds. Local release workflow does not call EAS.

Published3.0.9/code46 on14 October2026 after npm ci restored Expo57.0.12 / RN0.86.2.
Full command13m21.94s; Gradle12m50s, all661 tasks executed. Seven old lockfile
version labels were aligned with existing tarball URLs/integrities and installed
manifests; package content unchanged. Installed dependency versions now match
lockfile. Original-signature standalone release verified. Next local code47;
synchronize EAS remote to at least46 before any future cloud build.
