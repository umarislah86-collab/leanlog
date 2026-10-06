import type { RedCoinsEntry, RedCoinsReminder, RedCoinsState } from './redcoins';
import { missingReminderAccounts, reminderOccurrenceDates } from './redcoinsReminders';

const cents = (value: number) => Math.round(value * 100);
const occurrenceKey = (reminder: RedCoinsReminder, date: Date) => `${reminder.id}:${date.toISOString()}`;

/** Read-only chronological projection. Reminder-only amounts are assumptions, not booked transactions. */
export function projectRedCoinsReminders(state: RedCoinsState, now = new Date()) {
  const existingKeys = new Map(state.entries.filter(row => row.reminderOccurrenceKey).map(row => [row.reminderOccurrenceKey!, row]));
  const deletedIds = new Set((state.deletedEntries || []).map(row => row.id));
  const rows = state.reminders.map(reminder => {
    const dates = reminderOccurrenceDates(reminder, now).filter(date => date.getTime() >= now.getTime()
      && !deletedIds.has(`reminder-${reminder.id}-${date.getTime()}`)
      && !(existingKeys.get(occurrenceKey(reminder, date)) && new Date(existingKeys.get(occurrenceKey(reminder, date))!.date) < now));
    const nextDue = dates[0] || null;
    const missing = missingReminderAccounts(reminder, state.accounts);
    const invalidAmount = !Number.isFinite(reminder.template.amount) || reminder.template.amount < 0;
    return { reminder, dates, nextDue, missing, invalidAmount, projection: null as null | { source: number; destination: number | null } };
  }).sort((a, b) => (a.nextDue?.getTime() ?? Infinity) - (b.nextDue?.getTime() ?? Infinity) || a.reminder.template.item.localeCompare(b.reminder.template.item) || a.reminder.id.localeCompare(b.reminder.id));
  const lastDue = Math.max(now.getTime(), ...rows.map(row => row.nextDue?.getTime() || now.getTime()));
  const balances = new Map(state.accounts.map(account => [account.name, cents(account.balance)]));
  const events: Array<{ time: number; entry: Pick<RedCoinsEntry, 'type' | 'amount' | 'account' | 'toAccount'> }> = [];
  // A future ledger row may already represent a schedule; then its own amount/accounts win.
  state.entries.filter(entry => new Date(entry.date).getTime() >= now.getTime() && new Date(entry.date).getTime() <= lastDue && entry.balanceEffectApplied !== true)
    .forEach(entry => events.push({ time: new Date(entry.date).getTime(), entry }));
  rows.filter(row => row.nextDue && !row.missing.length && !row.invalidAmount).forEach(row => {
    row.dates.filter(date => date.getTime() <= lastDue).forEach(date => {
      if (!existingKeys.has(occurrenceKey(row.reminder, date))) events.push({ time: date.getTime(), entry: row.reminder.template });
    });
  });
  events.sort((a, b) => a.time - b.time);
  let index = 0;
  for (const row of rows) {
    if (!row.nextDue || row.missing.length || row.invalidAmount) continue;
    // Apply ALL events at the same due time before taking a snapshot: no arbitrary tie-order bias.
    while (index < events.length && events[index].time <= row.nextDue.getTime()) {
      const entry = events[index++].entry;
      if (!Number.isFinite(entry.amount) || !Number.isFinite(balances.get(entry.account))) continue;
      if (entry.type === 'transfer' && (!entry.toAccount || !Number.isFinite(balances.get(entry.toAccount)))) continue;
      const amount = cents(entry.amount);
      if (entry.type === 'income') balances.set(entry.account, balances.get(entry.account)! + amount);
      else balances.set(entry.account, balances.get(entry.account)! - amount);
      if (entry.type === 'transfer') balances.set(entry.toAccount!, balances.get(entry.toAccount!)! + amount);
    }
    const source = balances.get(row.reminder.template.account);
    const destination = row.reminder.template.type === 'transfer' ? balances.get(row.reminder.template.toAccount!) : null;
    if (Number.isFinite(source) && (destination === null || Number.isFinite(destination))) row.projection = { source: source! / 100, destination: destination === null ? null : destination! / 100 };
  }
  return rows;
}
