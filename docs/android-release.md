# Android release: EAS only

User returned to EAS after physical-phone failures with local builds and
confirmed EAS3.0.10 fixed slow boot, Android Back and stuck cloud upload.
Local SDK/JDK/Gradle caches, generated native project, local APK proofs and
local build scripts were removed at the user's request on14 October2026.
Do not recreate that workflow without an explicit request.

- Active account/owner umarcoc93, project d02048ce-beca-42a6-9ffb-c43e0a6d9ab2.
  Use %LOCALAPPDATA%\LeanLogEAS\eas-account.ps1 umarcoc93 <eas arguments>.
- 17 October fallback: team Android free quota exhausted before worker start.
  Original owner umarosli93/project624ee9c5-768a-4781-a2c5-1f1608c1500a retains
  the identical original signer (credentials fNQIUcQP2K). This fallback attempt
  was also rejected for quota after counter49; no APK was produced there.
  Still EAS-only; no local compiler setup restored.
- Original account also exhausted its monthly free quota. User added umarcoc93
  and umiaq tokens, encrypted outside Git at %LOCALAPPDATA%/LeanLogEAS. Current
  3.0.11 build project: umarcoc93/d02048ce-beca-42a6-9ffb-c43e0a6d9ab2, original
  signer linked and verified, remote baseline49 -> build50. Use the local
  eas-account.ps1 wrapper with account umarcoc93; never commit tokens.
- Build profile preview-arm64 in eas.json creates the release APK.
- Current published3.0.13/code52; active EAS remote counter52, next auto-increment53.
- Every APK build request includes GitHub source/release, landing and HANDOVER.
- Verify downloaded APK with scripts/verify-android-apk.py (Python cryptography),
  passing APK path, marketing version and Android code. Check original signer,
  package, ARM64 ABI, non-debuggable flag, embedded JS and signature/content.
- Preserve build history in docs/build-timings.json. Record EAS queue/worker and
  submission-to-completion separately, excluding tests/verification/publication.

Original signer SHA256:
62a8aa1dd325bbe4b76855f4f3cc239950c4133b76ff904244cad6c78695161c

EAS retains the original signing credentials in the original and active projects.
The historical local recovery copy under %LOCALAPPDATA%\LeanLogSigning is not
present on this machine; do not assume it exists. Signing identity was linked
between EAS accounts in memory and verified on both sides. Never print or commit
credentials, or generate a replacement signing identity for an update.

Historical local-build notes/timings in HANDOVER.md are records of removed
experiments, not instructions to build locally again.
