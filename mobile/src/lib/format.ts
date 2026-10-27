export function formatINR(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  const safe = Number.isFinite(amount) ? amount : 0;
  return `₹${safe.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function todayISO() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

export function formatDisplayDate(iso: string | null | undefined) {
  if (!iso) return '';
  const [year, month, day] = iso.slice(0, 10).split('-');
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}

export function parseAmount(raw: string) {
  const cleaned = raw.replace(/,/g, '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const amount = Number(cleaned);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100) / 100;
}

export function errorText(error: unknown) {
  const message = error && typeof error === 'object' && 'message' in error
    ? String((error as { message: unknown }).message)
    : '';
  if (!message) return 'Something went wrong. Please try again.';
  if (message.includes('row-level security') || message === 'not allowed') {
    return 'This action is not enabled for your login.';
  }
  if (message.includes('JWT') || message.includes('not authenticated')) {
    return 'Please sign in again.';
  }
  return message;
}

export function related<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}
