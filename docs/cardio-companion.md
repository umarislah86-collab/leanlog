# Cardio Companion — 12 October 2026

Coach opens a companion for Brisk walk, Jog and Run. Start-session setup supports free/time/distance targets, GPS or timer only, voice/vibration cues, optional screen awake, custom walk/effort interval rounds, and eight local presets. Quick log reviews a completed session without AI. Finish shows active time, distance/pace when known, estimated calories, kilometre splits and a Save to Activity action. Recent saved sessions remain in local history.

## Runtime and data

The active session and saved history use a separate `leanlog-cardio.db` SQLite store. Location callbacks and controls update inside exclusive transactions. The clock derives from accumulated active milliseconds plus the current start timestamp; paused time is excluded. Interval phase and calories use that same clock. Screen-off GPS uses Expo Location's native foreground service and a top-level TaskManager definition. Timer-only sessions need no location permission; wall-clock time restores after returning to the app.

GPS accepts precise points, rejects stale/weak fixes and impossible jumps, does not connect paused points, and resets the anchor across long gaps. Route storage is capped at 3,000 points; no route map is exposed in this version. Pace is based on accepted motion and becomes unavailable after stale fixes. Goal/interval notification dates share the session clock; Pause/Finish cancel outstanding session cues, Resume rebuilds them from active time remaining. Notification controls open the app for Pause/Resume/Finish, including cold-start navigation back into Coach.

Activity uses the immutable cardio session ID. Repeated/concurrent Save and retry after a partial write do not append duplicate entries. Cloud upsert follows local Activity persistence. Current logged weight is read at each new live/manual session; its start weight is retained for a consistent session estimate. Calories use total MET energy: MET × 3.5 × kg / 200 × active minutes. Defaults: brisk walk 4.8 (17200), jog 7.5 (12020), run 9.0 (12045); interval calories weight each phase. These are estimates, not sensor measurements. Sources: [2024 Walking Compendium](https://pacompendium.com/walking/), [2024 Running Compendium](https://pacompendium.com/running/).

## Validation and phone QC

314 regression tests passed, including nine cardio tests with the real SQLite engine: background-clock catch-up, pause exclusion, interval boundaries/calories, GPS rejection/splits, invalid inputs, current weight, duplicate Save, disk-failure retry, notification cancellation/rescheduling and stale-session actions. TypeScript and Expo prebuild configuration passed. Android bundle preview is verified. This does not prove GPS accuracy or screen-off delivery on Xiaomi.

Local preview: `../../outputs/leanlog-expo-go`, port 8084, tunnel `exp://p2n3imy-umiaq-8084.exp.direct`; Coach opens Cardio automatically. Production Firebase/AI/widgets remain replaced only in preview. Expo Go can test setup, timer, interval voice, quick log, Save deduplication and foreground GPS. Screen-off GPS needs a native APK; [Expo SDK 57 location documentation](https://docs.expo.dev/versions/v57.0.0/sdk/location/#permissions) documents the Expo Go Android service limitation. No APK build/push was requested for this feature yet.

Phone acceptance: start timer only, pause for a minute, background/return, check excluded pause; configure short intervals and test cues/cancellation; Finish/Save and check one Activity row; quick log with changed logger weight; outdoors check permission rejection, GPS fixes, moving/standing/pausing, kilometre splits; native APK check locked screen, notification actions/cold start, service stop on Finish and Xiaomi background behavior. Check Cream, Studio, Midnight and Onyx readability.

## Mock artifact

`../../outputs/leanlog-cardio-companion-mock.png` is a generated UI concept based on the implemented setup/live/summary layout, not a device screenshot. Built-in image_gen tool; exact prompt saved in `../../outputs/leanlog-cardio-mock-prompt.md`. Map, pace alerts, auto-pause, personal best and smartwatch support remain outside this first implementation.
