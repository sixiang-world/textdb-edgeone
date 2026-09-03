/**
 * 本地 Key 历史记录（localStorage 封装）
 *
 * 记录当前浏览器写入过的 key，支持快速选择和搜索。
 * 仅存储元数据（key、时间、大小），不存储 value 或密码。
 * localStorage 不可用时静默降级为 no-op。
 */

const STORAGE_KEY = "textdb_key_history";
const MAX_KEYS = 200;

export interface KeyRecord {
  key: string;
  createdAt: number;
  lastWrittenAt: number;
  size?: number;
}

function readAll(): KeyRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(records: KeyRecord[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // localStorage 不可用或配额满，静默降级
  }
}

/** 列出所有 key，按最后写入时间降序 */
export function listKeys(): KeyRecord[] {
  return readAll().sort((a, b) => b.lastWrittenAt - a.lastWrittenAt);
}

/** 记录一次写入（已存在则更新时间，不存在则新增；超 200 条淘汰最旧） */
export function recordKey(key: string, size?: number) {
  const records = readAll();
  const now = Date.now();
  const existing = records.find((r) => r.key === key);
  if (existing) {
    existing.lastWrittenAt = now;
    if (size !== undefined) existing.size = size;
  } else {
    records.push({ key, createdAt: now, lastWrittenAt: now, size });
  }
  records.sort((a, b) => b.lastWrittenAt - a.lastWrittenAt);
  if (records.length > MAX_KEYS) {
    records.length = MAX_KEYS;
  }
  writeAll(records);
}

/** 从本地历史中移除（不删除服务端数据） */
export function removeKey(key: string) {
  const records = readAll().filter((r) => r.key !== key);
  writeAll(records);
}

/** 清空本地历史（不影响服务端数据） */
export function clearHistory() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 静默
  }
}

/** 大小写不敏感的子串搜索 */
export function searchKeys(query: string): KeyRecord[] {
  const q = query.toLowerCase().trim();
  if (!q) return listKeys();
  return listKeys().filter((r) => r.key.toLowerCase().includes(q));
}

/** 检测 localStorage 是否可用 */
export function isHistoryAvailable(): boolean {
  try {
    const testKey = "__textdb_test__";
    localStorage.setItem(testKey, "1");
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/** 格式化相对时间（如"3 分钟前"） */
export function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "刚刚";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} 天前`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo} 个月前`;
  return `${Math.floor(mo / 12)} 年前`;
}

/** 格式化字节大小 */
export function formatSize(bytes?: number): string {
  if (bytes === undefined || bytes === null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
