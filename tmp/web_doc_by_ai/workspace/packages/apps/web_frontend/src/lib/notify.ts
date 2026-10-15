import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { settings } from "../stores/settings";

const minutes = (hhmm: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/** Inside the quiet hours set in the "A" menu (may span midnight: 20:00 → 08:00). */
export function isQuiet(d = new Date()): boolean {
  const from = minutes(settings.quietFrom);
  const to = minutes(settings.quietTo);
  if (from === null || to === null || from === to) return false;
  const now = d.getHours() * 60 + d.getMinutes();
  return from < to ? now >= from && now < to : now >= from || now < to;
}

let granted: boolean | null = null;

/** Resolves to true when the notification was actually shown (not in quiet hours). */
export async function notify(title: string, body?: string): Promise<boolean> {
  if (isQuiet()) return false;
  try {
    if (granted === null) {
      granted = await isPermissionGranted();
      if (!granted) granted = (await requestPermission()) === "granted";
    }
    if (granted) sendNotification({ title, body });
    return !!granted;
  } catch {
    // Notifications are a convenience: never break the UI for them.
    return false;
  }
}
