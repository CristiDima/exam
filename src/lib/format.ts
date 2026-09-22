export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return h > 0 ? `${h}:${m}:${sec}` : `${m}:${sec}`;
}

/** "YYYY-MM-DDTHH:MM:SS" -> "YYYY-MM-DD HH:MM" */
export function formatDate(date: string): string {
  return date ? date.replace('T', ' ').substring(0, 16) : '';
}

/** Local time as "YYYY-MM-DDTHH:MM:SS" (the format used by the saved history). */
export function localTimestamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function percent(part: number, total: number): number {
  return total > 0 ? (part / total) * 100 : 0;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
}
