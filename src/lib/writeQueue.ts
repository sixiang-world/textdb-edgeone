/**
 * 写入队列 / 重试（IndexedDB 封装）
 *
 * 所有写入/删除/上传操作先入队，串行执行，避免 KV 并发写竞态。
 * 失败自动指数退避重试（1s → 2s → 4s，最多 3 次），超过后标记 error。
 * 页面刷新后 pending/processing 项保留，恢复网络后自动继续。
 * IndexedDB 不可用时降级为直接调用 API（原有行为）。
 */

import { openDB, type IDBPDatabase } from "idb";
import { writeData, deleteData, uploadFile } from "@/api";
import type { UploadItem } from "@/lib/folderUtils";

const DB_NAME = "textdb";
const DB_VERSION = 1;
const STORE = "write-queue";
export const MAX_RETRIES = 3;

export type QueueItemType = "write" | "delete" | "upload";
export type QueueItemStatus = "pending" | "processing" | "error";

export interface QueueItem {
  id: string;
  type: QueueItemType;
  status: QueueItemStatus;
  key: string;
  /** write 专用 */
  value?: string;
  password?: string;
  newPassword?: string;
  /** upload 专用 */
  fileName?: string;
  fileRelativePath?: string;
  fileContent?: string;
  fileSize?: number;
  /** 通用 */
  retryCount: number;
  lastError?: string;
  createdAt: number;
  updatedAt: number;
}

export type EnqueueInput =
  | { type: "write"; key: string; value: string; password?: string; newPassword?: string }
  | { type: "delete"; key: string; password?: string }
  | {
      type: "upload";
      key: string;
      fileName: string;
      fileRelativePath: string;
      fileContent: string;
      fileSize: number;
      password?: string;
    };

export interface QueueCallbacks {
  onSuccess: (item: QueueItem) => void;
  onError: (item: QueueItem) => void;
}

type Listener = (items: QueueItem[]) => void;

// --- 单例状态 ---
let db: IDBPDatabase | null = null;
let available = true;
let isProcessing = false;
let callbacks: QueueCallbacks = { onSuccess: () => {}, onError: () => {} };
const listeners = new Set<Listener>();
const pendingCallbacks = new Map<string, { onSuccess?: (item: QueueItem) => void; onError?: (item: QueueItem) => void }>();
let onlineListenerRegistered = false;

// --- 工具函数 ---

function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function isQueueAvailable(): boolean {
  try {
    return typeof indexedDB !== "undefined";
  } catch {
    return false;
  }
}

async function getQueue(): Promise<QueueItem[]> {
  if (!db) return [];
  const all = await db.getAll(STORE);
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

function notifySubscribers() {
  if (!db) return;
  getQueue().then((items) => {
    for (const l of listeners) l(items);
  });
}

// --- 核心处理 ---

async function processItem(item: QueueItem): Promise<void> {
  try {
    if (item.type === "write") {
      const d = await writeData(item.key, item.value!, item.password, item.newPassword);
      if (d.status !== 1) throw new Error(d.error || "写入失败");
    } else if (item.type === "delete") {
      const d = await deleteData(item.key, item.password);
      if (d.status !== 1) throw new Error(d.error || "删除失败");
    } else if (item.type === "upload") {
      const file: UploadItem = {
        name: item.fileName!,
        relativePath: item.fileRelativePath!,
        key: item.key,
        content: item.fileContent!,
        size: item.fileSize!,
      };
      const res = await uploadFile(file, item.password);
      if (!res.success) throw new Error(res.error || "上传失败");
    }
    // 成功：从队列移除
    await db!.delete(STORE, item.id);
    const cb = pendingCallbacks.get(item.id);
    cb?.onSuccess?.(item);
    pendingCallbacks.delete(item.id);
    callbacks.onSuccess(item);
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    item.retryCount++;
    item.lastError = errMsg;
    item.updatedAt = Date.now();
    if (item.retryCount >= MAX_RETRIES) {
      item.status = "error";
      await db!.put(STORE, item);
      const cb = pendingCallbacks.get(item.id);
      cb?.onError?.(item);
      pendingCallbacks.delete(item.id);
      callbacks.onError(item);
    } else {
      item.status = "pending";
      await db!.put(STORE, item);
      // 指数退避：第 1 次 1s，第 2 次 2s，第 3 次 4s
      const delay = Math.pow(2, item.retryCount - 1) * 1000;
      setTimeout(() => processQueue(), delay);
    }
  }
  notifySubscribers();
}

async function processQueue() {
  if (isProcessing || !db) return;
  isProcessing = true;
  try {
    while (true) {
      const pending = await db.getAllFromIndex(STORE, "status", "pending");
      if (pending.length === 0) break;
      pending.sort((a, b) => a.createdAt - b.createdAt);
      const item = pending[0];
      item.status = "processing";
      item.updatedAt = Date.now();
      await db.put(STORE, item);
      notifySubscribers();
      await processItem(item);
    }
  } finally {
    isProcessing = false;
    notifySubscribers();
  }
}

// --- 降级模式（IndexedDB 不可用）---

async function fallbackEnqueue(input: EnqueueInput, opts?: { onSuccess?: (item: QueueItem) => void; onError?: (item: QueueItem) => void }) {
  const baseItem: QueueItem = {
    id: genId(),
    type: input.type,
    status: "pending",
    key: input.key,
    retryCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  try {
    if (input.type === "write") {
      const d = await writeData(input.key, input.value, input.password, input.newPassword);
      if (d.status === 1) { const it = { ...baseItem, value: input.value }; opts?.onSuccess?.(it); callbacks.onSuccess(it); }
      else { const it = { ...baseItem, status: "error" as const, lastError: d.error || "写入失败" }; opts?.onError?.(it); callbacks.onError(it); }
    } else if (input.type === "delete") {
      const d = await deleteData(input.key, input.password);
      if (d.status === 1) { opts?.onSuccess?.(baseItem); callbacks.onSuccess(baseItem); }
      else { const it = { ...baseItem, status: "error" as const, lastError: d.error || "删除失败" }; opts?.onError?.(it); callbacks.onError(it); }
    } else if (input.type === "upload") {
      const file: UploadItem = {
        name: input.fileName,
        relativePath: input.fileRelativePath,
        key: input.key,
        content: input.fileContent,
        size: input.fileSize,
      };
      const res = await uploadFile(file, input.password);
      if (res.success) { const it = { ...baseItem, fileName: input.fileName }; opts?.onSuccess?.(it); callbacks.onSuccess(it); }
      else { const it = { ...baseItem, status: "error" as const, lastError: res.error || "上传失败" }; opts?.onError?.(it); callbacks.onError(it); }
    }
  } catch (e) {
    const it = { ...baseItem, status: "error" as const, lastError: e instanceof Error ? e.message : String(e) };
    opts?.onError?.(it);
    callbacks.onError(it);
  }
}

// --- 公开 API ---

/** 初始化队列（页面加载时调用一次） */
export function initQueue(cb: QueueCallbacks) {
  callbacks = cb;
  if (!isQueueAvailable()) {
    available = false;
    return;
  }
  (async () => {
    try {
      db = await openDB(DB_NAME, DB_VERSION, {
        upgrade(database) {
          if (!database.objectStoreNames.contains(STORE)) {
            const store = database.createObjectStore(STORE, { keyPath: "id" });
            store.createIndex("status", "status");
          }
        },
      });
      // 页面刷新时，把 processing 状态的项改回 pending（之前的处理中断了）
      const processing = await db.getAllFromIndex(STORE, "status", "processing");
      for (const item of processing) {
        item.status = "pending";
        item.updatedAt = Date.now();
        await db.put(STORE, item);
      }
      // 恢复网络时继续处理（只注册一次）
      if (!onlineListenerRegistered) {
        window.addEventListener("online", () => processQueue());
        onlineListenerRegistered = true;
      }
      processQueue();
      notifySubscribers();
    } catch {
      available = false;
      db = null;
    }
  })();
}

/** 入队一个操作 */
export async function enqueue(input: EnqueueInput, opts?: { onSuccess?: (item: QueueItem) => void; onError?: (item: QueueItem) => void }) {
  if (!available || !db) {
    fallbackEnqueue(input, opts);
    return;
  }
  const item: QueueItem = {
    id: genId(),
    type: input.type,
    status: "pending",
    key: input.key,
    retryCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  if (input.type === "write") {
    item.value = input.value;
    item.password = input.password;
    item.newPassword = input.newPassword;
  } else if (input.type === "delete") {
    item.password = input.password;
  } else if (input.type === "upload") {
    item.fileName = input.fileName;
    item.fileRelativePath = input.fileRelativePath;
    item.fileContent = input.fileContent;
    item.fileSize = input.fileSize;
    item.password = input.password;
  }
  if (opts) pendingCallbacks.set(item.id, opts);
  try {
    await db.add(STORE, item);
  } catch {
    // IndexedDB 写入失败（如配额超限），降级为直接调用
    pendingCallbacks.delete(item.id);
    fallbackEnqueue(input, opts);
    return;
  }
  notifySubscribers();
  processQueue();
}

/** 重试单个 error 项 */
export async function retryItem(id: string) {
  if (!db) return;
  const item = await db.get(STORE, id);
  if (!item || item.status !== "error") return;
  item.status = "pending";
  item.retryCount = 0;
  item.lastError = undefined;
  item.updatedAt = Date.now();
  await db.put(STORE, item);
  notifySubscribers();
  processQueue();
}

/** 丢弃单个项 */
export async function discardItem(id: string) {
  if (!db) return;
  await db.delete(STORE, id);
  notifySubscribers();
}

/** 重试所有 error 项 */
export async function retryAll() {
  if (!db) return;
  const errors = await db.getAllFromIndex(STORE, "status", "error");
  for (const item of errors) {
    item.status = "pending";
    item.retryCount = 0;
    item.lastError = undefined;
    item.updatedAt = Date.now();
    await db.put(STORE, item);
  }
  notifySubscribers();
  processQueue();
}

/** 订阅队列变化，返回取消订阅函数 */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  if (db) getQueue().then(listener);
  return () => {
    listeners.delete(listener);
  };
}
