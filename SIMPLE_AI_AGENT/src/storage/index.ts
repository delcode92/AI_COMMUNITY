import { WorkflowRun, ChatMessage, AgentContext } from '../core/types';

const DB_NAME = 'agent-platform';
const DB_VERSION = 1;
const STORE_RUNS = 'workflow_runs';
const STORE_TOOLS = 'tool_registry';

// ─────────────────────────────────────────────────────────────────────────────
// IndexedDB — durable storage for workflow runs and tool definitions
// ─────────────────────────────────────────────────────────────────────────────

class IDBStorage {
  private db: IDBDatabase | null = null;

  async open(): Promise<void> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_RUNS)) {
          const store = db.createObjectStore(STORE_RUNS, { keyPath: 'runId' });
          store.createIndex('workflowId', 'workflowId', { unique: false });
          store.createIndex('status', 'status', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_TOOLS)) {
          db.createObjectStore(STORE_TOOLS, { keyPath: 'name' });
        }
      };
      req.onsuccess = () => { this.db = req.result; resolve(); };
      req.onerror = () => reject(req.error);
    });
  }

  private tx(store: string, mode: IDBTransactionMode = 'readonly') {
    if (!this.db) throw new Error('IndexedDB not initialized — call open() first');
    return this.db.transaction(store, mode).objectStore(store);
  }

  async saveRun(run: WorkflowRun): Promise<void> {
    return new Promise((resolve, reject) => {
      const req = this.tx(STORE_RUNS, 'readwrite').put(run);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getRun(runId: string): Promise<WorkflowRun | null> {
    return new Promise((resolve, reject) => {
      const req = this.tx(STORE_RUNS).get(runId);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  async listRuns(workflowId?: string): Promise<WorkflowRun[]> {
    return new Promise((resolve, reject) => {
      const store = this.tx(STORE_RUNS);
      const req = workflowId
        ? store.index('workflowId').getAll(workflowId)
        : store.getAll();
      req.onsuccess = () => resolve(req.result ?? []);
      req.onerror = () => reject(req.error);
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// localStorage — fast access for sessions and conversation history
// ─────────────────────────────────────────────────────────────────────────────

const LS_PREFIX = 'agent:';

class LocalStorage {
  private key(k: string) { return `${LS_PREFIX}${k}`; }

  saveSession(ctx: AgentContext): void {
    localStorage.setItem(this.key(`session:${ctx.sessionId}`), JSON.stringify(ctx));
  }

  loadSession(sessionId: string): AgentContext | null {
    const raw = localStorage.getItem(this.key(`session:${sessionId}`));
    return raw ? JSON.parse(raw) : null;
  }

  appendMessage(sessionId: string, msg: ChatMessage): void {
    const key = this.key(`history:${sessionId}`);
    const existing: ChatMessage[] = JSON.parse(localStorage.getItem(key) ?? '[]');
    existing.push(msg);
    // Keep last 200 messages per session
    const trimmed = existing.slice(-200);
    localStorage.setItem(key, JSON.stringify(trimmed));
  }

  getHistory(sessionId: string): ChatMessage[] {
    const raw = localStorage.getItem(this.key(`history:${sessionId}`));
    return raw ? JSON.parse(raw) : [];
  }

  clearHistory(sessionId: string): void {
    localStorage.removeItem(this.key(`history:${sessionId}`));
  }

  saveCredential(name: string, value: string): void {
    // In production: use a proper secrets manager or encrypt before storage
    localStorage.setItem(this.key(`cred:${name}`), value);
  }

  loadCredentials(): Record<string, string> {
    const prefix = this.key('cred:');
    const creds: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) ?? '';
      if (k.startsWith(prefix)) {
        creds[k.slice(prefix.length)] = localStorage.getItem(k) ?? '';
      }
    }
    return creds;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Unified storage facade
// ─────────────────────────────────────────────────────────────────────────────

export class BrowserStorage {
  readonly idb = new IDBStorage();
  readonly ls = new LocalStorage();

  async init(): Promise<void> {
    await this.idb.open();
    console.info('[BrowserStorage] Ready');
  }
}
