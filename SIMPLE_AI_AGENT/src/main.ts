import { SkillRouter } from './core/skillRouter';
import { WorkflowEngine } from './workflows/engine';
import { BrowserStorage } from './storage';
import { AgentOrchestrator, AVAILABLE_MODELS } from './orchestrator';
import type { AgentEvent } from './orchestrator';
import { builtinTools } from './core/builtins';

// ── DOM elements ──────────────────────────────────────────────────────────────
const messagesEl = document.getElementById('messages')!;
const inputEl = document.getElementById('userInput') as HTMLTextAreaElement;
const sendBtn = document.getElementById('sendBtn')! as HTMLButtonElement;
const clearBtn = document.getElementById('clearBtn')! as HTMLButtonElement;
const sessionInput = document.getElementById('sessionId') as HTMLInputElement;
const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
const modelSelect = document.getElementById('modelSelect') as HTMLSelectElement;
const setKeyBtn = document.getElementById('setKeyBtn')! as HTMLButtonElement;
const traceEl = document.getElementById('trace')! as HTMLDivElement;
const toolListEl = document.getElementById('toolList')!;
const statusEl = document.getElementById('status')!;

// ── State ─────────────────────────────────────────────────────────────────────
let orchestrator: AgentOrchestrator | null = null;
let apiKey = import.meta.env.VITE_OPENROUTER_API_KEY ?? '';
let loading = false;

function setStatus(text: string, cls: '' | 'loading' | 'success' | 'error' = '') {
  statusEl.textContent = text;
  statusEl.className = 'status' + (cls ? ` ${cls}` : '');
}

function addMessage(role: string, content: string) {
  const el = document.createElement('div');
  el.className = `msg ${role}`;
  el.textContent = content;
  messagesEl.appendChild(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ── Process trace ─────────────────────────────────────────────────────────────
let traceStep = 0;

function clearTrace() {
  traceEl.innerHTML = '';
  traceStep = 0;
}

function addTraceStep(icon: string, label: string, detail = '', colorClass = '') {
  traceStep++;
  const el = document.createElement('div');
  el.className = `trace-step trace-an`;
  el.style.animationDelay = `${traceStep * 0.15}s`;
  el.innerHTML = `
    <div class="trace-line">
      <div class="trace-icon ${colorClass}">${icon}</div>
      <div class="trace-content">
        <div class="trace-label">${label}</div>
        ${detail ? `<div class="trace-detail">${detail}</div>` : ''}
      </div>
    </div>
  `;
  traceEl.appendChild(el);
  traceEl.scrollTop = traceEl.scrollHeight;
}

function handleProgress(ev: AgentEvent) {
  switch (ev.type) {
    case 'thinking':
      addTraceStep('🧠', 'Thinking', 'Determining which tools to use…', 'accent');
      break;
    case 'tool_call':
      const inputPreview = ev.payload
        ? JSON.stringify(ev.payload).slice(0, 120) + (JSON.stringify(ev.payload).length > 120 ? '…' : '')
        : '(no input)';
      addTraceStep('🔧', `Calling tool: \`${ev.toolName}\``, inputPreview, 'orange');
      break;
    case 'tool_executing':
      addTraceStep('⚙️', `Executing: \`${ev.toolName}\``, '', 'purple');
      break;
    case 'tool_result': {
      const payload = ev.payload as { result: unknown; durationMs: number };
      const preview = JSON.stringify(payload.result).slice(0, 150);
      addTraceStep('✅', `Result from \`${ev.toolName}\``, `${preview} (${payload.durationMs}ms)`, 'green');
      break;
    }
    case 'thinking_again':
      addTraceStep('🧠', 'Thinking again', 'Processing tool results…', 'accent');
      break;
    case 'done':
      addTraceStep('✨', 'Done', 'Finalizing response', 'green');
      break;
  }
}

// ── Initialize ────────────────────────────────────────────────────────────────
async function init() {
  const storage = new BrowserStorage();
  await storage.init();

  const router = new SkillRouter();
  router.registerMany(builtinTools);

  const envModel = import.meta.env.VITE_MODEL;

  // Populate model dropdown
  for (const model of AVAILABLE_MODELS) {
    const opt = document.createElement('option');
    opt.value = model.id;
    opt.textContent = model.label;
    if (envModel && model.id === envModel) opt.selected = true;
    if (!envModel && model.id === AVAILABLE_MODELS[0].id) opt.selected = true; // default
    modelSelect.appendChild(opt);
  }
  for (const tool of router.list()) {
    const el = document.createElement('div');
    el.className = 'tool-item';
    el.innerHTML = `<strong>${tool.name}</strong><br><span class="tool-cat">${tool.category}</span>`;
    el.title = tool.description;
    toolListEl.appendChild(el);
  }

  // Create orchestrator
  orchestrator = new AgentOrchestrator(router, new WorkflowEngine(router, storage), storage, apiKey);

  // Restore API key if present
  if (apiKey) {
    apiKeyInput.value = apiKey.slice(0, 8) + '••••••••';
  }

  setStatus(`Ready — ${router.list().length} tools loaded — ${modelSelect.selectedOptions[0]?.textContent ?? 'default model'}`, 'success');
}

// eksekusi send btn method
// ── Actions ───────────────────────────────────────────────────────────────────
async function send() {
  const text = inputEl.value.trim();
  if (!text || loading || !orchestrator) return;

  if (!apiKey) {
    addMessage('system', 'Please enter an OpenRouter API key first.');
    return;
  }

  const sessionId = sessionInput.value.trim() || 'default';

  loading = true;
  sendBtn.disabled = true;
  inputEl.value = '';
  inputEl.style.height = 'auto';
  addMessage('user', text);
  clearTrace();
  statusEl.textContent = 'Processing…';
  statusEl.className = 'status loading';

  try {

    // proses utama , trigger orkestrasi
    orchestrator.setApiKey(apiKey);
    const reply = await orchestrator.chat(text, sessionId, handleProgress);

    addMessage('assistant', reply);
    setStatus(`Ready — trace updated`, 'success');
  } catch (err) {
    addTraceStep('❌', `Error`, (err as Error).message, 'red');
    setStatus('Error', 'error');
  } finally {
    loading = false;
    sendBtn.disabled = false;
    inputEl.focus();
  }
}

function clearChat() {
  const msgs = messagesEl.querySelectorAll('.msg');
  msgs.forEach(m => m.remove());
  addMessage('system', 'Chat cleared.');
  clearTrace();
  inputEl.focus();
}

// pencet send message Button
// ── Event listeners ───────────────────────────────────────────────────────────
sendBtn.addEventListener('click', send);
clearBtn.addEventListener('click', clearChat);

inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    send();
  }
});

setKeyBtn.addEventListener('click', () => {
  const key = prompt('Enter OpenRouter API Key:');
  if (key) {
    apiKey = key;
    apiKeyInput.value = key.slice(0, 8) + '••••••••';
    if (orchestrator) orchestrator.setApiKey(key);
    setStatus('API key updated', 'success');
  }
});

modelSelect.addEventListener('change', () => {
  const selected = modelSelect.value;
  if (orchestrator) orchestrator.setModel(selected);
  setStatus(`Model: ${AVAILABLE_MODELS.find(m => m.id === selected)?.label ?? selected}`, 'success');
});

// Auto-resize textarea
inputEl.addEventListener('input', () => {
  inputEl.style.height = 'auto';
  inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
});

// Start
init().catch((err) => {
  setStatus(`Init error: ${(err as Error).message}`, 'error');
});
