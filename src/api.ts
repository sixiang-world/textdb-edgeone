import type { UploadItem, UploadResult } from "@/lib/folderUtils";

const BASE = location.origin;

export interface Stats {
  totalKeys: number;
  totalSize: number;
  writesToday: number;
  scannedAll: boolean;
}

export async function getStats(signal?: AbortSignal): Promise<Stats> {
  const res = await fetch(`${BASE}/stats`, { signal });
  const data = await res.json();
  if (data.status !== 1) throw new Error(data.error || "Failed to fetch stats");
  return data.data;
}

export async function writeData(key: string, value: string) {
  const res = await fetch(`${BASE}/update/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `key=${encodeURIComponent(key)}&value=${encodeURIComponent(value)}`,
  });
  return res.json();
}

export async function deleteData(key: string) {
  const res = await fetch(`${BASE}/update/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `key=${encodeURIComponent(key)}&value=`,
  });
  return res.json();
}

export async function readData(key: string): Promise<string> {
  const res = await fetch(`${BASE}/${key}`);
  return res.text();
}

export async function uploadFile(file: UploadItem): Promise<UploadResult> {
  try {
    const res = await fetch(`${BASE}/update/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `key=${encodeURIComponent(file.key)}&value=${encodeURIComponent(file.content)}`,
    });
    const data = await res.json();
    return {
      key: file.key,
      name: file.name,
      success: data.status === 1,
      error: data.status !== 1 ? (data.error || "Unknown error") : undefined,
    };
  } catch (e: unknown) {
    return {
      key: file.key,
      name: file.name,
      success: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
