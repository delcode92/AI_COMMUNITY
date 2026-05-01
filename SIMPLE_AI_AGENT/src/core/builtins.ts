import { AgentTool, AgentContext, ToolCallResult } from './types';

// ── Text utilities ────────────────────────────────────────────────────────────

export const textTool: AgentTool = {
  name: 'text_utils',
  description: 'Transform, analyze, or format text: count words, extract, slugify, truncate, etc.',
  category: 'utility',
  params: {
    operation: {
      type: 'string',
      description: 'Operation to perform',
      required: true,
      enum: ['word_count', 'char_count', 'slugify', 'truncate', 'extract_emails', 'extract_urls', 'to_upper', 'to_lower'],
    },
    text: { type: 'string', description: 'Input text', required: true },
    maxLength: { type: 'number', description: 'Max length for truncate operation' },
  },

  async call(input): Promise<ToolCallResult> {
    const { operation, text, maxLength } = input as { operation: string; text: string; maxLength?: number };
    switch (operation) {
      case 'word_count':   return { success: true, data: { count: text.trim().split(/\s+/).filter(Boolean).length } };
      case 'char_count':   return { success: true, data: { count: text.length } };
      case 'slugify':      return { success: true, data: { result: text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') } };
      case 'truncate':     return { success: true, data: { result: maxLength ? text.slice(0, maxLength) + (text.length > maxLength ? '…' : '') : text } };
      case 'extract_emails': return { success: true, data: { emails: text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) ?? [] } };
      case 'extract_urls': return { success: true, data: { urls: text.match(/https?:\/\/[^\s]+/g) ?? [] } };
      case 'to_upper':     return { success: true, data: { result: text.toUpperCase() } };
      case 'to_lower':     return { success: true, data: { result: text.toLowerCase() } };
      default:             return { success: false, error: `Unknown operation: ${operation}` };
    }
  },
};

// ── JSON utilities ────────────────────────────────────────────────────────────

export const jsonTool: AgentTool = {
  name: 'json_utils',
  description: 'Parse, format, validate, or query JSON data',
  category: 'utility',
  params: {
    operation: {
      type: 'string',
      description: 'Operation: parse | format | validate | get_path | keys',
      required: true,
      enum: ['parse', 'format', 'validate', 'get_path', 'keys'],
    },
    input: { type: 'string', description: 'JSON string to process', required: true },
    path: { type: 'string', description: 'Dot-notation path for get_path (e.g. "user.address.city")' },
  },

  async call(input): Promise<ToolCallResult> {
    const { operation, input: raw, path } = input as { operation: string; input: string; path?: string };
    try {
      switch (operation) {
        case 'parse':    return { success: true, data: JSON.parse(raw) };
        case 'format':   return { success: true, data: JSON.stringify(JSON.parse(raw), null, 2) };
        case 'validate': { try { JSON.parse(raw); return { success: true, data: { valid: true } }; } catch { return { success: true, data: { valid: false } }; } }
        case 'keys':     return { success: true, data: Object.keys(JSON.parse(raw)) };
        case 'get_path': {
          const obj = JSON.parse(raw);
          const value = path?.split('.').reduce((acc: unknown, key) => (acc as Record<string, unknown>)?.[key], obj);
          return { success: true, data: value ?? null };
        }
        default:         return { success: false, error: `Unknown operation: ${operation}` };
      }
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },
};

// ── Math / calculation ────────────────────────────────────────────────────────

export const mathTool: AgentTool = {
  name: 'calculator',
  description: 'Evaluate safe math expressions and perform common calculations',
  category: 'utility',
  params: {
    expression: { type: 'string', description: 'Math expression to evaluate, e.g. "(12 * 4) / 3 + Math.sqrt(16)"', required: true },
  },

  async call(input): Promise<ToolCallResult> {
    const { expression } = input as { expression: string };
    // Whitelist safe math tokens only
    if (/[^0-9+\-*/.()%\s,MathsqrtpowlofloorceilroundabsminmaxPI]/.test(expression)) {
      return { success: false, error: 'Expression contains unsafe characters' };
    }
    try {
      // eslint-disable-next-line no-new-func
      const result = new Function(`"use strict"; return (${expression})`)();
      return { success: true, data: { result } };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },
};

// ── Date / time ────────────────────────────────────────────────────────────────

export const dateTool: AgentTool = {
  name: 'date_utils',
  description: 'Get current date/time, format dates, calculate differences, add/subtract durations',
  category: 'utility',
  params: {
    operation: {
      type: 'string',
      description: 'Operation: now | format | diff | add',
      required: true,
      enum: ['now', 'format', 'diff', 'add'],
    },
    date: { type: 'string', description: 'ISO date string (e.g. 2024-01-15)' },
    date2: { type: 'string', description: 'Second date for diff operation' },
    amount: { type: 'number', description: 'Amount to add/subtract (negative to subtract)' },
    unit: { type: 'string', description: 'Unit: days | months | years', enum: ['days', 'months', 'years'] },
    locale: { type: 'string', description: 'Locale for formatting, e.g. en-US, id-ID' },
  },

  async call(input): Promise<ToolCallResult> {
    const { operation, date, date2, amount, unit, locale = 'en-US' } = input as {
      operation: string; date?: string; date2?: string; amount?: number; unit?: string; locale?: string;
    };
    const d = date ? new Date(date) : new Date();
    switch (operation) {
      case 'now':    return { success: true, data: { iso: new Date().toISOString(), local: new Date().toLocaleString(locale) } };
      case 'format': return { success: true, data: { formatted: d.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' }) } };
      case 'diff': {
        const d2 = new Date(date2 ?? Date.now());
        const diffMs = Math.abs(d2.getTime() - d.getTime());
        return { success: true, data: { days: Math.floor(diffMs / 86400000), hours: Math.floor(diffMs / 3600000) } };
      }
      case 'add': {
        const result = new Date(d);
        if (unit === 'days')   result.setDate(result.getDate() + (amount ?? 0));
        if (unit === 'months') result.setMonth(result.getMonth() + (amount ?? 0));
        if (unit === 'years')  result.setFullYear(result.getFullYear() + (amount ?? 0));
        return { success: true, data: { iso: result.toISOString(), formatted: result.toLocaleDateString(locale) } };
      }
      default:       return { success: false, error: `Unknown operation: ${operation}` };
    }
  },
};

// ── Storage helper (wraps localStorage for agent use) ───────────────────────

export const storageTool: AgentTool = {
  name: 'kv_store',
  description: 'Get, set, delete, or list key-value pairs in persistent browser storage',
  category: 'storage',
  params: {
    action: { type: 'string', description: 'Action: get | set | delete | list', required: true, enum: ['get', 'set', 'delete', 'list'] },
    key: { type: 'string', description: 'Storage key (required for get/set/delete)' },
    value: { type: 'string', description: 'Value to store (for set action)' },
    prefix: { type: 'string', description: 'Key prefix filter for list action' },
  },

  async call(input): Promise<ToolCallResult> {
    const { action, key, value, prefix } = input as { action: string; key?: string; value?: string; prefix?: string };
    const NS = 'agent:kv:';
    switch (action) {
      case 'get': {
        if (!key) return { success: false, error: 'key required' };
        const v = localStorage.getItem(NS + key);
        return { success: true, data: v !== null ? JSON.parse(v) : null };
      }
      case 'set': {
        if (!key) return { success: false, error: 'key required' };
        localStorage.setItem(NS + key, JSON.stringify(value));
        return { success: true, data: `Stored "${key}"` };
      }
      case 'delete': {
        if (!key) return { success: false, error: 'key required' };
        localStorage.removeItem(NS + key);
        return { success: true, data: `Deleted "${key}"` };
      }
      case 'list': {
        const keys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i) ?? '';
          if (k.startsWith(NS + (prefix ?? ''))) keys.push(k.slice(NS.length));
        }
        return { success: true, data: keys };
      }
      default: return { success: false, error: `Unknown action: ${action}` };
    }
  },
};

export const builtinTools: AgentTool[] = [textTool, jsonTool, mathTool, dateTool, storageTool];
