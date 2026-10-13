[CmdletBinding()]
param(
  [int]$VersionCode = 0,
  [string]$OutputDirectory = "",
  [string]$AndroidSdk = "",
  [string]$JdkHome = ""
)
$ErrorActionPreference = 'Stop'
# npm can inherit PowerShell 7 module paths; pin these Windows PowerShell modules.
Import-Module (Join-Path $PSHOME 'Modules/Microsoft.PowerShell.Security/Microsoft.PowerShell.Security.psd1') -ErrorAction Stop
$repoRoot = Split-Path $PSScriptRoot -Parent
$toolRoot = Join-Path $env:LOCALAPPDATA 'LeanLogBuild'
$privateSigning = Join-Path $toolRoot 'signing/signing.json'
if (!(Test-Path $privateSigning)) { throw "Original signing credentials missing: $privateSigning. See docs/local-android-build.md." }
if (!$JdkHome) { $JdkHome = (Get-ChildItem $toolRoot -Directory -Filter 'jdk-17*' | Sort-Object Name -Descending | Select-Object -First 1).FullName }
if (!$AndroidSdk) { $AndroidSdk = Join-Path $toolRoot 'android-sdk' }
if (!(Test-Path (Join-Path $JdkHome 'bin/java.exe'))) { throw 'JDK 17 is missing.' }
if (!(Test-Path (Join-Path $AndroidSdk 'platforms/android-36/android.jar'))) { throw 'Android SDK platform 36 is missing.' }
$buildRoot = Join-Path $repoRoot '.local-build'
New-Item -ItemType Directory -Force $buildRoot | Out-Null
if (!$OutputDirectory) { $OutputDirectory = Join-Path $buildRoot 'apks' }
New-Item -ItemType Directory -Force $OutputDirectory | Out-Null
$OutputDirectory = [System.IO.Path]::GetFullPath($OutputDirectory)
$statePath = Join-Path $buildRoot 'version-state.json'
$signing = Get-Content $privateSigning -Raw | ConvertFrom-Json
function Reveal-Password([string]$encrypted) {
  $secure = ConvertTo-SecureString $encrypted
  return ([System.Net.NetworkCredential]::new('', $secure)).Password
}
$names = @('JAVA_HOME','ANDROID_HOME','ANDROID_SDK_ROOT','PATH','ORG_GRADLE_PROJECT_reactNativeArchitectures','LEANLOG_KEYSTORE','LEANLOG_STORE_PASSWORD','LEANLOG_KEY_ALIAS','LEANLOG_KEY_PASSWORD','NODE_ENV')
$saved = @{}
foreach ($name in $names) { $saved[$name] = [Environment]::GetEnvironmentVariable($name,'Process') }
$shortPath = Join-Path $env:USERPROFILE "leanlog-local"
$locationPushed = $false
$mutex = [System.Threading.Mutex]::new($false, "Local\LeanLogLocalAndroidBuild")
$locked = $false
try {
  $locked = $mutex.WaitOne(0)
  if (!$locked) { throw "Another local LeanLog build is already running." }
  $config = Get-Content (Join-Path $repoRoot 'app.json') -Raw | ConvertFrom-Json
  $baseline = [int]$config.expo.android.versionCode
  $state = if (Test-Path $statePath) { Get-Content $statePath -Raw | ConvertFrom-Json } else { @{versionCode=$baseline} }
  $floor = [Math]::Max($baseline, [int]$state.versionCode)
  if ($VersionCode -eq 0) { $VersionCode = $floor + 1 }
  if ($VersionCode -le $floor) { throw "VersionCode must exceed local high-water mark $floor. Use -VersionCode for a newer cloud release." }

  $env:JAVA_HOME = $JdkHome
  $env:ANDROID_HOME = $AndroidSdk
  $env:ANDROID_SDK_ROOT = $AndroidSdk
  $env:PATH = "$JdkHome/bin;$AndroidSdk/platform-tools;$env:PATH"
  $env:ORG_GRADLE_PROJECT_reactNativeArchitectures = 'arm64-v8a'
  $env:NODE_ENV = 'production'
  # Keep the short alias on the same drive as the repo: Kotlin codegen rejects mixed roots.
  if (!(Test-Path $shortPath)) {
    New-Item -ItemType Junction -Path $shortPath -Target $repoRoot | Out-Null
  } else {
    $link = Get-Item -LiteralPath $shortPath
    if ($link.LinkType -ne 'Junction' -or [System.IO.Path]::GetFullPath($link.Target[0]) -ne [System.IO.Path]::GetFullPath($repoRoot)) {
      throw "Short build path already belongs to another directory: $shortPath"
    }
  }
  Push-Location $shortPath
  $locationPushed = $true
  Write-Host 'Generating native Android project (no EAS cloud build)...'
  $packagePath = Join-Path (Get-Location) 'package.json'
  $packageBefore = [System.IO.File]::ReadAllText($packagePath)
  # SDK 57 CLI defaults to clean prebuild; preserve native caches for repeat builds.
  $prebuildHelp = & npx.cmd expo prebuild --help | Out-String
  $prebuildArgs = @('expo', 'prebuild', '--platform', 'android', '--no-install')
  if ($prebuildHelp.Contains('--no-clean')) { $prebuildArgs += '--no-clean' }
  & npx.cmd @prebuildArgs
  $prebuildExit = $LASTEXITCODE
  # Prebuild rewrites development scripts; this build never changes package inputs.
  [System.IO.File]::WriteAllText($packagePath,$packageBefore,[System.Text.UTF8Encoding]::new($false))
  if ($prebuildExit -ne 0) { throw 'Expo prebuild failed.' }
  $app = Get-Content app.json -Raw | ConvertFrom-Json
  $version = $app.expo.version
  $gradleFile = Join-Path (Get-Location) 'android/app/build.gradle'
  $gradleText = [System.IO.File]::ReadAllText($gradleFile)
  $gradleText = [regex]::Replace($gradleText, 'versionCode \d+', "versionCode $VersionCode", 1)
  # Remove our previous generated config so repeated builds remain idempotent.
  $gradleText = [regex]::Replace($gradleText, '(?ms)^        leanlogRelease \{\r?\n.*?^        \}\r?\n', '')
  $gradleText = $gradleText.Replace('signingConfig signingConfigs.leanlogRelease','signingConfig signingConfigs.debug')
  # Never fall back to a debug key when running this release workflow.
  if (!$gradleText.Contains('signingConfig signingConfigs.debug')) { throw 'Unexpected Android signing template; refusing to build.' }
  $releaseConfig = @"
        leanlogRelease {
            storeFile file(System.getenv('LEANLOG_KEYSTORE'))
            storePassword System.getenv('LEANLOG_STORE_PASSWORD')
            keyAlias System.getenv('LEANLOG_KEY_ALIAS')
            keyPassword System.getenv('LEANLOG_KEY_PASSWORD')
        }
"@
  $gradleText = [regex]::Replace($gradleText, '(?m)^    extraPackagerArgs = \["--max-workers", "2"\]\r?\n', '')
  $gradleText = $gradleText.Replace('react {', "react {`n" + '    extraPackagerArgs = ["--max-workers", "2"]')
  $gradleText = $gradleText.Replace('    signingConfigs {', "    signingConfigs {`n$releaseConfig")
  $gradleText = [regex]::Replace($gradleText, '(?s)(release\s*\{.*?signingConfig )signingConfigs\.debug', '$1signingConfigs.leanlogRelease', 1)
  [System.IO.File]::WriteAllText($gradleFile,$gradleText,[System.Text.UTF8Encoding]::new($false))
  $sdkPath = $AndroidSdk.Replace('\','/')
  [System.IO.File]::WriteAllText((Join-Path (Get-Location) 'android/local.properties'),"sdk.dir=$sdkPath`n",[System.Text.UTF8Encoding]::new($false))
  $env:LEANLOG_KEYSTORE = $signing.keystorePath
  $env:LEANLOG_STORE_PASSWORD = Reveal-Password $signing.storePassword
  $env:LEANLOG_KEY_ALIAS = $signing.keyAlias
  $env:LEANLOG_KEY_PASSWORD = Reveal-Password $signing.keyPassword
  # Reserve the code before compiling: concurrent/retried builds cannot reuse it.
  @{versionCode=$VersionCode;version=$version;reservedAt=(Get-Date).ToUniversalTime().ToString('o')} | ConvertTo-Json | Set-Content $statePath
  Write-Host "Compiling signed ARM64 APK $version / $VersionCode..."
  & .\android\gradlew.bat -p android -I (Join-Path $repoRoot 'scripts/local-android.init.gradle') :app:assembleRelease '-PreactNativeArchitectures=arm64-v8a' '--max-workers=2' '-Dorg.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m' --console=plain --no-daemon
  if ($LASTEXITCODE -ne 0) { throw 'Gradle release build failed.' }
  $apk = Join-Path $OutputDirectory "leanlog-V$version-local-$VersionCode.apk"
  Copy-Item -LiteralPath 'android/app/build/outputs/apk/release/app-release.apk' -Destination $apk -Force
  $python = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
  if (!(Test-Path $python)) { $python = (Get-Command python -ErrorAction Stop).Source }
  $verification = & $python (Join-Path $repoRoot 'scripts/verify-local-apk.py') $apk $version $VersionCode
  if ($LASTEXITCODE -ne 0) { throw 'APK cryptographic/package verification failed.' }
  $checked = $verification | ConvertFrom-Json
  if ($checked.signerSha256 -ne $signing.expectedSigner) { throw 'APK signer differs from original LeanLog key.' }
  $verification | Set-Content "$apk.verification.json"
  Write-Host "Verified APK: $apk"
} finally {
  if ($locationPushed) { Pop-Location }
  foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name,$saved[$name],'Process') }
  if ($locked) { $mutex.ReleaseMutex() }
  $mutex.Dispose()
}
