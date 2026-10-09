import type { RedCoinsState } from './redcoins';

export interface AuditTarget { section: 'activity' | 'accounts' | 'plan'; entryId?: string; accountId?: string; planPage?: 'budgets' | 'automation' }
export interface DataIssue { id: string; level: 'error' | 'review'; title: string; detail: string; target: AuditTarget }
export interface DataAudit { issues: DataIssue[]; total: number; errors: number; reviews: number; accountCount: number; entryCount: number; bankChecks: number; unverifiedBalances: number; checkedAt: string }
const normal = (value: string) => value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
const money = (value: number) => `RM ${value.toFixed(2)}`;
/** Pure diagnostic of the saved snapshot. No migration, balance rebuild or repair. */
export function auditRedCoinsData(state: RedCoinsState, now = new Date()): DataAudit {
  if (!state || !Array.isArray(state.accounts) || !Array.isArray(state.entries) || !Array.isArray(state.categories) || !Array.isArray(state.reminders)) throw new Error('Saved RedCoins data has an invalid structure. Restore from a verified backup; nothing was changed.');
  if ([state.accounts,state.entries,state.categories,state.reminders].some(rows => rows.some(row => !row || typeof row !== 'object')) || state.categories.some(c => !Array.isArray(c.subcategories))) throw new Error('Saved records have an invalid structure. Nothing was changed; inspect a backup before editing.');
  const issues: DataIssue[] = []; let total = 0, errors = 0, reviews = 0, bankChecks = 0;
  const add = (level: DataIssue['level'], title: string, detail: string, target: AuditTarget) => { total++; if (level === 'error') errors++; else reviews++; if (issues.length < 300) issues.push({id:`audit-${total}`,level,title,detail,target}); };
  const accounts = new Map(state.accounts.map(a => [a.name,a]));
  const categories = new Map(state.categories.map(c => [c.name,c]));
  const entriesById = new Map(state.entries.map(e => [e.id,e]));
  for (const [label,rows,section] of [['account',state.accounts,'accounts'],['transaction',state.entries,'activity'],['category',state.categories,'accounts'],['schedule',state.reminders,'plan']] as const) {
    const ids = new Set<string>();
    for (const row of rows) { if (!row || typeof row.id !== 'string' || !row.id || ids.has(row.id)) add('error',`Invalid or repeated ${label} ID`,'Two records with the same ID cannot be reliably selected. Review before editing; do not delete blindly.',{section}); if (row) ids.add(row.id); }
  }
  const seenNames = new Set<string>();
  for (const account of state.accounts) {
    if (typeof account.name !== 'string' || !account.name.trim()) { add('error','Account has no name',`Account ID: ${account.id}`,{section:'accounts'}); continue; }
    const key = normal(account.name);
    if (seenNames.has(key)) add('error','Repeated account name',`${account.name}: names alone cannot identify the intended account. No accounts were merged.`,{section:'accounts',accountId:account.id});
    seenNames.add(key);
    if (!Number.isFinite(account.balance)) add('error','Invalid account balance',account.name,{section:'accounts',accountId:account.id});
  }
  const exact = new Map<string,string[]>(), monthly = new Map<string,string[]>();
  for (const entry of state.entries) {
    const target: AuditTarget = {section:'activity',entryId:entry.id};
    const label = `${entry.item || '(untitled)'} · ${entry.account || '(no account)'}`;
    const date = new Date(entry.date), time = date.getTime();
    if (!Number.isFinite(entry.amount) || entry.amount < 0 || !Number.isFinite(time) || !['expense','income','transfer'].includes(entry.type)) { add('error','Invalid transaction values',label,target); continue; }
    if (!accounts.has(entry.account)) add('error','Transaction account missing',label,target);
    if (entry.type === 'transfer') {
      if (!entry.toAccount || !accounts.has(entry.toAccount)) add('error','Transfer destination missing',label,target);
      else if (entry.account === entry.toAccount) add('review','Transfer to the same account',label,target);
    } else if (entry.category && !/^\((new account|no category|transfer)\)$/i.test(entry.category)) {
      const group = categories.get(entry.category);
      if (!group || entry.subcategory && !group.subcategories.includes(entry.subcategory)) add('review','Transaction category missing',`${label} · ${entry.category} / ${entry.subcategory}. Historical deleted categories can be intentional.`,target);
    }
    if (time <= now.getTime() && entry.balanceEffectApplied === false || time > now.getTime() && entry.balanceEffectApplied === true) {
      add('review','Transaction timing / balance flag',`${label} · ${entry.date}. Saved applied flag differs from its due date; a due catch-up may still be pending. No balance was recalculated.`,target);
    }
    if (time > now.getTime() || entry.status === 'void' || entry.duplicateOfId || typeof entry.item !== 'string' || !entry.item.trim()) continue;
    const day = `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`;
    const key = JSON.stringify([entry.type,normal(entry.item),entry.account,entry.toAccount || '',Math.round(entry.amount*100),day,entry.category,entry.subcategory]);
    if (!exact.has(key)) exact.set(key,[]); exact.get(key)!.push(entry.id);
    if (entry.type === 'income' && (entry.incomePeriod || /\b(epf|kwsp|salary|gaji|payroll|pencen|pension)\b/i.test(`${entry.item} ${entry.account} ${entry.category} ${entry.subcategory}`))) {
      const month = entry.incomePeriod || `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
      const mkey = JSON.stringify([normal(entry.item),entry.account,month]); if (!monthly.has(mkey)) monthly.set(mkey,[]); monthly.get(mkey)!.push(entry.id);
    }
  }
  const monthlyIds = new Set<string>();
  for (const ids of monthly.values()) if (ids.length > 1) {
    ids.forEach(id => monthlyIds.add(id)); const e = entriesById.get(ids[0])!;
    add('review','Possible repeated monthly income',`${e.item} · ${e.account}: ${ids.length} credits for the same month. May be legitimate split payments; verify before changing.`,{section:'activity',entryId:e.id});
  }
  for (const ids of exact.values()) if (ids.length > 1 && !ids.every(id => monthlyIds.has(id))) {
    const e = entriesById.get(ids[0])!;
    add('review','Possible same-day duplicate',`${e.item} · ${money(e.amount)} · ${e.account}: ${ids.length} matching type/title/amount/day/category records. Repeated purchases may be valid.`,{section:'activity',entryId:e.id});
  }
  for (const schedule of state.reminders) {
    if (!schedule.enabled) continue;
    const t = schedule.template;
    if (!t || !accounts.has(t.account) || t.type === 'transfer' && (!t.toAccount || !accounts.has(t.toAccount))) add('error','Enabled schedule has missing account',`${t?.item || '(untitled schedule)'}: repair accounts before auto-log.`,{section:'plan',planPage:'automation'});
  }
  for (const account of state.accounts) {
    const review = state.bankReviews?.[account.id]; if (!review || !Number.isFinite(account.balance) || !/^-?\d+(\.\d{1,2})?$/.test(review.bankBalance.trim())) continue;
    const end = new Date(`${review.endDay}T00:00:00`); if (!Number.isFinite(end.getTime()) || end > now) continue;
    end.setDate(end.getDate()+1); const cutoff = Math.min(end.getTime(),now.getTime()+1);
    let rewind = 0;
    for (const e of state.entries) {
      const time = new Date(e.date).getTime();
      if (!Number.isFinite(time) || !Number.isFinite(e.amount) || time < cutoff || time > now.getTime() || e.balanceEffectApplied === false) continue;
      const cents = Math.round(e.amount*100);
      if (e.account === account.name) rewind += e.type === 'income' ? cents : -cents;
      if (e.type === 'transfer' && e.toAccount === account.name) rewind += cents;
    }
    bankChecks++;
    const expected = (Math.round(account.balance*100)-rewind)/100, diff = Math.round(Number(review.bankBalance)*100)-Math.round(expected*100);
    if (diff !== 0) add('review','Saved bank comparison differs',`${account.name} · ${review.endDay}: saved bank ${money(Number(review.bankBalance))}, RedCoins as-of ${money(expected)}, difference ${money(diff/100)}. The saved bank figure may be outdated or incomplete; use SEMAK to verify.`,{section:'accounts',accountId:account.id});
  }
  const plans = (state.termBudgets || []).filter(b => b && b.amount > 0);
  for (const b of plans) {
    const target: AuditTarget = {section:'plan'};
    if (!categories.has(b.category) || b.subcategory && !categories.get(b.category)!.subcategories.includes(b.subcategory)) add('review','Budget target missing',`${b.category} / ${b.subcategory || 'whole category'}`,target);
    const scalar = Object.entries(state.subcategoryBudgets || {}).some(([key,value]) => { const [cat,sub] = key.split('\u0000'); return value > 0 && cat === b.category && (!b.subcategory || sub === b.subcategory); });
    if (scalar) add('review','Cycle and period budget overlap',`${b.category} / ${b.subcategory || 'whole category'} has both salary-cycle and period limits. They currently monitor independently; no expense is doubled.`,target);
  }
  for (let i=0;i<plans.length;i++) for(let j=i+1;j<plans.length;j++) {
    const a=plans[i], b=plans[j];
    if (a.category !== b.category || a.subcategory && b.subcategory && a.subcategory !== b.subcategory) continue;
    // Repeating windows may overlap later: report conservatively, never merge.
    const overlaps = a.repeat && b.repeat || a.repeat && b.endDay >= a.startDay || b.repeat && a.endDay >= b.startDay || a.startDay <= b.endDay && b.startDay <= a.endDay;
    if (overlaps) add('review','Potential overlapping period budgets',`${a.category} · ${a.subcategory || 'whole category'} and ${b.subcategory || 'whole category'}. Check both periods; repetition may overlap future ranges.`,{section:'plan'});
  }
  return {issues,total,errors,reviews,accountCount:state.accounts.length,entryCount:state.entries.length,bankChecks,unverifiedBalances:state.accounts.length-bankChecks,checkedAt:now.toISOString()};
}
