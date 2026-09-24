import AsyncStorage from '@react-native-async-storage/async-storage';

let Notifications: any = null;
try { Notifications = require('expo-notifications'); } catch {}

const ENABLED_KEY = 'nag_mode_enabled_v1';
const SCHEDULE_KEY = 'nag_mode_schedule_v1';
const DAYS_KEY = 'nag_mode_days_v1';
const TIMES_KEY = 'nag_mode_times_v1';
const LAST_SNOOZE_ACTION_KEY = 'nag_mode_last_snooze_action_v1';
const CATEGORY = 'LEANLOG_SUPER_KAREN';
const CHANNEL = 'super-karen-v2';

type ScheduledNag = { id: string; fireAt: string; dateKey: string };

const NAGS = [
  [
    ['Morning. New day, new chance to pretend meal prep is your personality.', 'No essay required. One photo when food appears.'],
    ['Rise and log, champion. Your breakfast cannot enter witness protection forever.', 'Snap first. Accuracy can have coffee later.'],
    ['Good morning. I have opened the kitchen investigation for today.', 'Cooperate early and nobody gets four notifications.'],
    ['Your future self requested evidence of breakfast. I am merely serving the warrant.', 'Camera. Food. Click. Very advanced technology.'],
    ['Today we practise radical honesty—with calories and suspicious beverages.', 'A photo counts. I am demanding, not unreasonable.'],
    ['Wake up. Hydrate. Photograph anything pretending not to be breakfast.', 'Even coffee with “just a little” syrup has a story.'],
    ['Fresh morning, clean slate, same highly observant coach.', 'Capture the first meal and I will temporarily respect your privacy.'],
    ['This is your gentle notification. Please treasure it; my patience has stages.', 'Log breakfast before Super-Karen clocks in.'],
  ],
  [
    ['Interesting. Nearly lunch and the food log is quieter than a group chat after someone asks for money.', 'Did we not eat, or are we practising selective memory?'],
    ['Hello again. I checked the records. The records checked me back. Empty.', 'Take one photo. I can stop being emotionally available.'],
    ['Your stomach has submitted activity. LeanLog has received no supporting documents.', 'Please attach photographic evidence.'],
    ['11 AM audit: calories may be invisible to you, but unfortunately not to physics.', 'Snap it and move on with your life.'],
    ['I am not saying you forgot breakfast. I am saying breakfast has no alibi.', 'Fine, log now. Future you will be annoyingly grateful.'],
    ['Tiny administrative matter: WHERE IS THE FOOD PHOTO?', 'No form. No spreadsheet. Just camera.'],
    ['The morning log remains suspiciously pristine. Very aesthetic. Completely useless.', 'Mess it up with some honest data.'],
    ['Coach Karen reporting: your logging consistency has left the building.', 'Bring it back with one tap.'],
  ],
  [
    ['3 PM. I know something happened between you and lunch. The silence is loud.', 'Confess via camera.'],
    ['Afternoon status: fed, probably. Logged, absolutely not.', 'I have lowered the bar to one photograph. Please trip over it.'],
    ['We are now entering the “you hoped I forgot” portion of the programme.', 'I did not forget. Snap lunch.'],
    ['Your lunch is not classified information, bro.', 'Release the photo to the authorities.'],
    ['At this point I accept blurry evidence, bad lighting and emotional damage.', 'Just capture it.'],
    ['Three o’clock inquiry: was lunch normal, heavy, or an incident?', 'Any answer is valid. No answer summons Super-Karen.'],
    ['LeanLog currently believes you photosynthesise. Fascinating, but unlikely.', 'Please document actual fuel.'],
    ['I am once again asking for one tiny food picture.', 'Yes, this is the meme stage of coaching.'],
  ],
  [
    ['Final notice. I do not need the truth, the whole truth and every gram. I need a photo.', 'Tap below before dinner joins the conspiracy.'],
    ['7 PM. We can do this the easy way or the four-notifications-again-tomorrow way.', 'Your move, citizen.'],
    ['The day is closing. Your food log has chosen minimalism without consent.', 'One photo and I will close the case.'],
    ['Dinner time. Calories know what happened. Bluecoins probably knows too. Now tell LeanLog.', 'Fine. Camera. Go.'],
    ['I survived all day waiting for a log. Do not make my sacrifice meaningless.', 'A rough log is infinitely better than imaginary perfection.'],
    ['Last call before I mark today as “user entered witness protection.”', 'Snap dinner or choose Lazy Day. Both are honest.'],
    ['Super-Karen evening report: cooperation remains below expectations.', 'Submit one edible exhibit immediately.'],
    ['Bro. One. Picture. NASA requested less documentation for some missions.', 'Tap “Fine, log now.”'],
  ],
] as const;

const dateKey = (date: Date) => date.toLocaleDateString('ms-MY');

async function readSchedule(): Promise<ScheduledNag[]> {
  const raw = await AsyncStorage.getItem(SCHEDULE_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function cancelStoredSchedule() {
  if (!Notifications) return;
  const schedule = await readSchedule();
  await Promise.all(schedule.map((item) => Notifications.cancelScheduledNotificationAsync(item.id).catch(() => {})));
  await AsyncStorage.removeItem(SCHEDULE_KEY);
}

async function configureCategory() {
  if (!Notifications) return;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Super-Karen Coach',
    description: 'LeanLog meal logging reminders',
    importance: Notifications.AndroidImportance.MAX,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    showBadge: true,
    enableVibrate: true,
    vibrationPattern: [0, 220, 120, 220],
    sound: 'default',
  }).catch(() => {});
  await Notifications.setNotificationCategoryAsync(CATEGORY, [
    { identifier: 'NAG_LOG', buttonTitle: '📸 Fine, log now', options: { opensAppToForeground: true } },
    { identifier: 'NAG_SNOOZE', buttonTitle: '😴 Snooze 2h', options: { opensAppToForeground: false } },
    { identifier: 'NAG_LAZY', buttonTitle: '🏳️ Lazy day', options: { opensAppToForeground: false } },
  ]).catch(() => {});
}

export async function isNagModeEnabled() {
  return (await AsyncStorage.getItem(ENABLED_KEY)) === 'true';
}

export async function getNagDays(): Promise<number[]> {
  const raw = await AsyncStorage.getItem(DAYS_KEY);
  return raw ? JSON.parse(raw) : [0, 1, 2, 3, 4, 5, 6];
}

export async function setNagDays(days: number[]) {
  const unique = [...new Set(days)].filter((day) => day >= 0 && day <= 6).sort();
  await AsyncStorage.setItem(DAYS_KEY, JSON.stringify(unique));
  if (await isNagModeEnabled()) await scheduleNaggingWeek();
}

export async function getNagTimes(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(TIMES_KEY);
  return raw ? JSON.parse(raw) : ['07:00', '11:00', '15:00', '19:00'];
}

export async function setNagTimes(times: string[]) {
  if (times.length !== 4) throw new Error('FOUR_NAG_TIMES_REQUIRED');
  await AsyncStorage.setItem(TIMES_KEY, JSON.stringify(times));
  if (await isNagModeEnabled()) await scheduleNaggingWeek();
}

export async function setNagModeEnabled(enabled: boolean) {
  await AsyncStorage.setItem(ENABLED_KEY, String(enabled));
  if (!enabled) {
    await cancelStoredSchedule();
    return true;
  }
  if (!Notifications) return false;
  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) {
    await AsyncStorage.setItem(ENABLED_KEY, 'false');
    return false;
  }
  await scheduleNaggingWeek();
  return true;
}

export async function scheduleNaggingWeek() {
  if (!Notifications || !(await isNagModeEnabled())) return;
  await cancelStoredSchedule();
  await configureCategory();
  const configuredTimes = await getNagTimes();
  const times = configuredTimes.map((value) => value.split(':').map(Number));
  const activeDays = await getNagDays();
  const now = new Date();
  const scheduled: ScheduledNag[] = [];
  const epochDay = Math.floor(now.getTime() / 86400000);
  for (let offset = 0; offset < 8; offset += 1) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + offset);
    if (!activeDays.includes(candidate.getDay())) continue;
    for (let slot = 0; slot < times.length; slot += 1) {
      const fireAt = new Date(now);
      fireAt.setDate(now.getDate() + offset);
      fireAt.setHours(times[slot][0], times[slot][1], 0, 0);
      if (fireAt <= now) continue;
      const choice = NAGS[slot][(epochDay + offset + slot * 3) % NAGS[slot].length];
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: choice[0], body: choice[1], categoryIdentifier: CATEGORY,
          data: { kind: 'nag', dateKey: dateKey(fireAt), slot },
          sound: true,
          priority: Notifications.AndroidNotificationPriority.MAX,
        },
        trigger: { type: 'date', date: fireAt, channelId: CHANNEL },
      });
      scheduled.push({ id, fireAt: fireAt.toISOString(), dateKey: dateKey(fireAt) });
    }
  }
  await AsyncStorage.setItem(SCHEDULE_KEY, JSON.stringify(scheduled));
}

export async function cancelNaggingToday() {
  if (!Notifications) return;
  const today = dateKey(new Date());
  const schedule = await readSchedule();
  const remove = schedule.filter((item) => item.dateKey === today && new Date(item.fireAt) > new Date());
  await Promise.all(remove.map((item) => Notifications.cancelScheduledNotificationAsync(item.id).catch(() => {})));
  await AsyncStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule.filter((item) => !remove.some((removed) => removed.id === item.id))));
}

export async function snoozeNagging(hours = 2, actionId?: string) {
  if (!Notifications) return;
  if (actionId) {
    if ((await AsyncStorage.getItem(LAST_SNOOZE_ACTION_KEY)) === actionId) return;
    await AsyncStorage.setItem(LAST_SNOOZE_ACTION_KEY, actionId);
  }
  await configureCategory();
  const fireAt = new Date(Date.now() + hours * 3600000);
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Snooze completed. Super-Karen has re-entered the chat.',
      body: 'Two hours were granted. The food evidence remains outstanding.',
      categoryIdentifier: CATEGORY,
      data: { kind: 'nag-snooze' },
      sound: true,
      priority: Notifications.AndroidNotificationPriority.MAX,
    },
    trigger: { type: 'date', date: fireAt, channelId: CHANNEL },
  });
}

export async function markLazyDay() {
  await AsyncStorage.setItem(`lazy_day_${dateKey(new Date())}`, 'true');
  await cancelNaggingToday();
}

export async function ensureNagSchedule() {
  if (!(await isNagModeEnabled())) return;
  const schedule = await readSchedule();
  const future = schedule.filter((item) => new Date(item.fireAt) > new Date());
  if (future.length < 8) await scheduleNaggingWeek();
}
