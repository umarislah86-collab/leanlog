Release status: included in published v3.0.0 on 12 October 2026. Earlier no-build wording is historical. Native phone acceptance checks remain pending.

# Rich Activity records

ActivityEntry retains its existing name, duration (active minutes), caloriesBurned, date and time. Optional details and imageUri preserve backward compatibility; existing calculations continue using caloriesBurned and do not add active/total calories twice.

## Screenshot flow
Logger + → Activity → Gallery/Camera → note/backdate → existing activity_image callable → validated review → Save. The prompt requests visible measurements only, normalized km/min/sec-per-km units, empty lists/null for missing values and no inferred graph samples. Full dates are validated; explicit backdate takes priority, then extracted date/time, then current date/time. The review explains these defaults. Missing duration or calorie value remains blank and requires user input (explicit zero calories is accepted). Numbers must be finite/nonnegative with limits; malformed output shows an error and preserves the image note screen for retry.

Screenshot AI input uses a single JPEG and one prompt, within the existing callable's four-part/8MB/12k text bounds. Activity screenshot resize limit is 1800px at .85 compression for OCR; food limits remain unchanged. The original selected image is copied into documentDirectory/activity-screenshots before the local Activity write. Storage/copy failure keeps review open. Stable review ID makes retry replace the same record rather than duplicating it. Firebase sync follows the local write. Screenshot bytes stay on the phone; cloud backup of metadata does not copy the actual file to another phone.

## Details and UI
Optional data: kind/source, start/end timestamps, total duration, active/total calorie values and calorie basis, distance, average/best pace, average/max speed and HR, HR zones, steps/cadence, ascent/descent, effort and notes, kilometre/lap splits, intervals, cycling cadence/power, pool length/laps, strength exercises/sets/rest/volume and timestamped samples. Only explicitly supplied samples produce a HR chart; average HR alone does not.

Screenshot review allows scalar and extracted row/set corrections or row removal. More measurements can be expanded; empty fields are omitted. Manual logger has optional extra details; supplied active/total calories are saved without AI, otherwise its existing calorie estimation is marked estimated. Tap Activity in Logger or its name in Progress day view for full details; long-press/delete continue to work. Screenshot viewer uses contain to preserve proportions and the entire image.

Cardio Companion stores measured distance (only with GPS or entered manual distance), average pace/speed when distance is available, timestamps, total elapsed duration, km splits and configured intervals. Its MET calorie estimate is marked estimated. Coach stores completed strength/timed sets, rest settings, timestamps and completed strength volume; timer minutes are converted to seconds. No HR, steps or other unavailable measures are invented.

## Verification
322 automated tests pass, including screenshot decimals/calorie distinctions, null/missing values, invalid payloads/dates, callable bounds, strength/real samples, original file persistence, copy/storage failures, retry dedup and Cardio runtime tests. Main and Expo Go QC TypeScript pass. Real Gemini screenshot extraction and Android UI/file viewing still need a phone check. QC remains cloud/AI disabled; it cannot verify real OCR. No new APK built or GitHub push for this feature.
