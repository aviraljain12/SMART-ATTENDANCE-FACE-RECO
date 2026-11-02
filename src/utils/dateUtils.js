// Date utilities adhering to organization timezone (Asia/Kolkata default)
export const DEFAULT_TIMEZONE = import.meta.env.VITE_DEFAULT_TIMEZONE || 'Asia/Kolkata';

export function getTodayOrgDateString(timezone = DEFAULT_TIMEZONE) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    const d = new Date();
    return d.toISOString().split('T')[0];
  }
}

export function formatOrgTime(isoString, timezone = DEFAULT_TIMEZONE) {
  if (!isoString) return '--:--';
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return new Date(isoString).toLocaleTimeString();
  }
}

export function formatOrgDate(dateStr, timezone = DEFAULT_TIMEZONE) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00Z`);
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    }).format(d);
  } catch {
    return dateStr;
  }
}

export function getCurrentLiveTime(timezone = DEFAULT_TIMEZONE) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date());
  } catch {
    return new Date().toLocaleTimeString();
  }
}
