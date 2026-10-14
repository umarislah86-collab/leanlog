# Android release: EAS only

User returned to EAS after physical-phone failures with local builds and
confirmed EAS3.0.10 fixed slow boot, Android Back and stuck cloud upload.
Local SDK/JDK/Gradle caches, generated native project, local APK proofs and
local build scripts were removed at the user's request on14 October2026.
Do not recreate that workflow without an explicit request.

- Account umiaq, owner umiaqs-team, project086aadb6-658c-47ee-a472-e9d76ac3c7be.
- Build profile preview-arm64 in eas.json creates the release APK.
- Current published3.0.10/code47; EAS remote counter47, next auto-increment48.
- Every APK build request includes GitHub source/release, landing and HANDOVER.
- Verify downloaded APK with scripts/verify-android-apk.py (Python cryptography),
  passing APK path, marketing version and Android code. Check original signer,
  package, ARM64 ABI, non-debuggable flag, embedded JS and signature/content.
- Preserve build history in docs/build-timings.json. Record EAS queue/worker and
  submission-to-completion separately, excluding tests/verification/publication.

Original signer SHA256:
62a8aa1dd325bbe4b76855f4f3cc239950c4133b76ff904244cad6c78695161c

EAS retains the original signing credentials. The small local recovery copy was
preserved at %LOCALAPPDATA%\LeanLogSigning (leanlog-release.jks and signing.json).
Password fields remain Windows DPAPI-encrypted for this user, with the original
restricted ACLs. Never print or commit credentials. This folder is a recovery
copy, not an installed compiler/toolchain; it is about4KB.

Historical local-build notes/timings in HANDOVER.md are records of removed
experiments, not instructions to build locally again.
