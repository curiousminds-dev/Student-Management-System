export interface QueuedScan {
  credential: string;
  occasionId: string;
  deviceId: string;
  clientEventId: string;
  recordedAt: string;
}
const KEY = "ncs.offline-scans";

export function queuedScans(): QueuedScan[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as QueuedScan[];
  } catch {
    return [];
  }
}
export function queueScan(scan: QueuedScan) {
  const rows = queuedScans();
  rows.push(scan);
  localStorage.setItem(KEY, JSON.stringify(rows));
  return rows.length;
}
export function clearQueuedScans() {
  localStorage.removeItem(KEY);
}
