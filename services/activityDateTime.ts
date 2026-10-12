// Storage keys and validation must not depend on a phone's 12/24-hour locale.
export const activityDate = (d: Date) => `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
export const activityTime = (d: Date) => `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
const plain = (s: string) => s.replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,'').trim();
export function normalizeActivityDate(value: string) {
  const s=plain(value),m=s.match(/^(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})$/);
  if(!m)throw Error('Date: use D/M/YYYY, for example 11/10/2026.');
  const d=new Date(+m[3],+m[2]-1,+m[1]);
  if(d.getFullYear()!==+m[3]||d.getMonth()!==+m[2]-1||d.getDate()!==+m[1])throw Error('Date is not a valid calendar day.');
  return `${+m[1]}/${+m[2]}/${m[3]}`;
}
export function normalizeActivityTime(value: string) {
  const s=plain(value).toLowerCase().replace(/\./g,'');
  const m=s.match(/^(\d{1,2}):(\d{2})(?:\s*(am|pm|pg|ptg))?$/);
  if(!m)throw Error('Time: use HH:mm, for example 19:30.');
  let hours=+m[1];const minutes=+m[2];
  if(minutes>59||hours>(m[3]?12:23)||(m[3]&&hours<1))throw Error('Time is not valid; use 00:00–23:59.');
  if(m[3])hours=hours%12+(['pm','ptg'].includes(m[3])?12:0);
  return `${String(hours).padStart(2,'0')}:${m[2]}`;
}
