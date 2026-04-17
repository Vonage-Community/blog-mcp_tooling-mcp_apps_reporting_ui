import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";

type SmsWeeklyArgs = {
  date_start: string;
  date_end: string;
  status?: string;
  from?: string;
  to?: string;
  country?: string;
  include_message?: boolean;
};

type VoiceReportArgs = {
  date_start?: string;
  date_end?: string;
  status?: string;
  direction?: "inbound" | "outbound";
};

type SmsWeeklyRow = Record<string, unknown>;

function maskE164(value: unknown): string {
  const s = typeof value === "string" ? value : "";
  if (!s) return "";
  const digits = s.replace(/\D/g, "");
  if (digits.length <= 4) return s;
  const last4 = digits.slice(-4);
  return `***${last4}`;
}

function toCsv(rows: SmsWeeklyRow[]): string {
  if (rows.length === 0) return "";
  const cols = Array.from(
    rows.reduce((set, r) => {
      for (const k of Object.keys(r)) set.add(k);
      return set;
    }, new Set<string>())
  );
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    const needs = /[\n\r,"]/.test(s);
    const q = s.replace(/"/g, '""');
    return needs ? `"${q}"` : q;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function handleHostContextChanged(ctx: McpUiHostContext) {
  if (ctx.theme) {
    applyDocumentTheme(ctx.theme);
  }
  if (ctx.styles?.variables) {
    applyHostStyleVariables(ctx.styles.variables);
  }
  if (ctx.styles?.css?.fonts) {
    applyHostFonts(ctx.styles.css.fonts);
  }
}

const app = new App({ name: "Vonage Reports Dashboard", version: "0.1.0" });

app.onhostcontextchanged = handleHostContextChanged;
app.onerror = console.error;

const root = document.getElementById("app")!;

root.innerHTML = `
  <style>
    :root { color-scheme: light dark; }
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"; margin: 0; padding: 12px; }
    .banner { border: 1px solid var(--mcp-border-color, rgba(127,127,127,.35)); border-radius: 10px; padding: 10px 12px; margin-bottom: 12px; }
    .tabs { display: flex; gap: 8px; margin-bottom: 12px; }
    button { padding: 8px 10px; border-radius: 8px; border: 1px solid var(--mcp-border-color, rgba(127,127,127,.35)); background: var(--mcp-surface-color, rgba(127,127,127,.08)); color: inherit; cursor: pointer; }
    button.active { background: var(--mcp-accent-color, rgba(70,120,255,.25)); }
    .card { border: 1px solid var(--mcp-border-color, rgba(127,127,127,.35)); border-radius: 10px; padding: 12px; }
    .row { display: grid; grid-template-columns: 160px 1fr; gap: 8px; margin: 8px 0; align-items: center; }
    input, select { width: 100%; padding: 8px; border-radius: 8px; border: 1px solid var(--mcp-border-color, rgba(127,127,127,.35)); background: transparent; color: inherit; }
    .actions { display: flex; gap: 8px; align-items: center; margin-top: 10px; }
    .hint { opacity: .8; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { border-bottom: 1px solid var(--mcp-border-color, rgba(127,127,127,.25)); text-align: left; padding: 6px; font-size: 12px; }
    .kpis { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 10px; }
    .kpi { padding: 10px; border-radius: 10px; border: 1px solid var(--mcp-border-color, rgba(127,127,127,.25)); min-width: 180px; }
    .kpi .label { font-size: 12px; opacity: .8; }
    .kpi .value { font-size: 18px; margin-top: 6px; }
    .voice-detail-row td { background: var(--mcp-surface-color, rgba(127,127,127,.06)); padding: 10px; }
    .detail-grid { display: grid; grid-template-columns: 140px 1fr; gap: 4px 12px; font-size: 12px; }
    .detail-key { opacity: .7; font-weight: 500; }
    .detail-val { word-break: break-all; }
    .detail-toggle { padding: 2px 7px; font-size: 11px; opacity: .7; }
    .detail-toggle:hover { opacity: 1; }
    .pager { display: flex; gap: 8px; align-items: center; margin-top: 10px; }
  </style>

  <div id="preview-banner" class="banner" style="display:none">
    <div style="font-weight:600; margin-bottom:6px">Preview mode (no MCP host connected)</div>
    <div class="hint">This page is running standalone in a browser, so tool calls are disabled. To use the dashboard for real, open it via an MCP Apps host like Claude Desktop.</div>
  </div>

  <div class="tabs">
    <button id="tab-sms" class="active">SMS Weekly</button>
    <button id="tab-voice">Voice Report</button>
  </div>

  <div id="panel-sms" class="card"></div>
  <div id="panel-voice" class="card" style="display:none"></div>
`;

const tabSms = document.getElementById("tab-sms")! as HTMLButtonElement;
const tabVoice = document.getElementById("tab-voice")! as HTMLButtonElement;
const panelSms = document.getElementById("panel-sms")!;
const panelVoice = document.getElementById("panel-voice")!;
const previewBanner = document.getElementById("preview-banner")!;

const runningStandalone = window.parent === window;
if (runningStandalone) {
  previewBanner.style.display = "block";
}

function setTab(tab: "sms" | "voice") {
  const sms = tab === "sms";
  tabSms.classList.toggle("active", sms);
  tabVoice.classList.toggle("active", !sms);
  panelSms.style.display = sms ? "block" : "none";
  panelVoice.style.display = sms ? "none" : "block";
}

tabSms.onclick = () => setTab("sms");
tabVoice.onclick = () => setTab("voice");

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function isoNow(): string {
  return new Date().toISOString();
}

let lastSmsRows: SmsWeeklyRow[] = [];

panelSms.innerHTML = `
  <div class="row">
    <div>Date start (ISO)</div>
    <input id="sms-start" />
  </div>
  <div class="row">
    <div>Date end (ISO)</div>
    <input id="sms-end" />
  </div>
  <div class="row">
    <div>Status (optional)</div>
    <input id="sms-status" placeholder="delivered | failed | ..." />
  </div>
  <div class="row">
    <div>From (optional)</div>
    <input id="sms-from" placeholder="+12025550123" />
  </div>
  <div class="row">
    <div>To (optional)</div>
    <input id="sms-to" placeholder="+12025550123" />
  </div>
  <div class="row">
    <div>Country (optional)</div>
    <input id="sms-country" placeholder="US" />
  </div>
  <div class="row">
    <div>Include message content</div>
    <label style="display:flex; gap:8px; align-items:center;">
      <input id="sms-include-message" type="checkbox" />
      <span class="hint">Advanced. Message bodies may contain PII/secrets; avoid screenshots/exports when enabled.</span>
    </label>
  </div>
  <div class="actions">
    <button id="sms-run">Run report</button>
    <button id="sms-export" disabled>Export CSV</button>
    <span id="sms-state" class="hint"></span>
  </div>
  <div class="kpis" id="sms-kpis"></div>
  <div id="sms-table"></div>
`;

const smsStart = document.getElementById("sms-start")! as HTMLInputElement;
const smsEnd = document.getElementById("sms-end")! as HTMLInputElement;
const smsStatus = document.getElementById("sms-status")! as HTMLInputElement;
const smsFrom = document.getElementById("sms-from")! as HTMLInputElement;
const smsTo = document.getElementById("sms-to")! as HTMLInputElement;
const smsCountry = document.getElementById("sms-country")! as HTMLInputElement;
const smsIncludeMessage = document.getElementById("sms-include-message")! as HTMLInputElement;
const smsRun = document.getElementById("sms-run")! as HTMLButtonElement;
const smsExport = document.getElementById("sms-export")! as HTMLButtonElement;
const smsState = document.getElementById("sms-state")!;
const smsKpis = document.getElementById("sms-kpis")!;
const smsTable = document.getElementById("sms-table")!;

smsStart.value = isoDaysAgo(7);
smsEnd.value = isoNow();

function renderKpis(rows: SmsWeeklyRow[]) {
  const total = rows.length;
  const byStatus = new Map<string, number>();
  for (const r of rows) {
    const st = (r["status"] ?? r["message_status"] ?? r["state"] ?? "unknown") as string;
    byStatus.set(st, (byStatus.get(st) ?? 0) + 1);
  }
  const top = Array.from(byStatus.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  smsKpis.innerHTML = `
    <div class="kpi"><div class="label">Records</div><div class="value">${total}</div></div>
    ${top
      .map(
        ([k, v]) =>
          `<div class="kpi"><div class="label">Status: ${k}</div><div class="value">${v}</div></div>`
      )
      .join("")}
  `;
}

function renderTable(rows: SmsWeeklyRow[]) {
  if (rows.length === 0) {
    smsTable.innerHTML = "<div class=\"hint\">No records.</div>";
    return;
  }
  const cols = Object.keys(rows[0]).slice(0, 10);
  const safe = (k: string, v: unknown) => {
    if (k.toLowerCase().includes("to") || k.toLowerCase().includes("from") || k.toLowerCase().includes("msisdn")) {
      return maskE164(v);
    }
    return v == null ? "" : String(v);
  };
  smsTable.innerHTML = `
    <table>
      <thead><tr>${cols.map((c) => `<th>${c}</th>`).join("")}</tr></thead>
      <tbody>
        ${rows
          .slice(0, 200)
          .map((r) => `<tr>${cols.map((c) => `<td>${safe(c, r[c])}</td>`).join("")}</tr>`)
          .join("")}
      </tbody>
    </table>
    <div class="hint">Showing up to 200 rows and first 10 columns. Numbers are masked by default.</div>
  `;
}

smsRun.onclick = async () => {
  if (runningStandalone) {
    smsState.textContent = "Tool calls are disabled in preview mode (no MCP host connected).";
    return;
  }
  smsState.textContent = "Loading…";
  smsExport.disabled = true;
  smsKpis.innerHTML = "";
  smsTable.innerHTML = "";

  const args: SmsWeeklyArgs = {
    date_start: smsStart.value,
    date_end: smsEnd.value,
    include_message: smsIncludeMessage.checked,
  };
  if (smsStatus.value.trim()) args.status = smsStatus.value.trim();
  if (smsFrom.value.trim()) args.from = smsFrom.value.trim();
  if (smsTo.value.trim()) args.to = smsTo.value.trim();
  if (smsCountry.value.trim()) args.country = smsCountry.value.trim();

  try {
    const res = await app.callServerTool({ name: "sms_weekly_report", arguments: args });
    const structured = (res as any)?.structuredContent;
    lastSmsRows = structured?.records ?? structured?.items ?? structured?.data ?? [];
    if (!Array.isArray(lastSmsRows)) lastSmsRows = [];

    renderKpis(lastSmsRows);
    renderTable(lastSmsRows);
    smsExport.disabled = lastSmsRows.length === 0;
    smsState.textContent = `Loaded ${lastSmsRows.length} records.`;
  } catch (e: any) {
    smsState.textContent = e?.message ? `Error: ${e.message}` : "Error";
  }
};

smsExport.onclick = () => {
  const csv = toCsv(lastSmsRows);
  download(`sms_weekly_${Date.now()}.csv`, csv);
};

type VoiceRow = Record<string, unknown>;

type VoiceColDef = { label: string; keys: string[]; format?: (v: unknown) => string };

function formatDate(v: unknown): string {
  if (v == null || v === "") return "";
  const s = typeof v === "string" || typeof v === "number" ? v : String(v);
  const d = new Date(s);
  if (isNaN(d.getTime())) return String(v);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function firstDefined(row: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (row[k] != null && row[k] !== "") return row[k];
  }
  return undefined;
}

const VOICE_COLS: VoiceColDef[] = [
  { label: "start", keys: ["start_time", "date_start", "start", "call_start_time", "timestamp"], format: formatDate },
  { label: "end", keys: ["end_time", "date_end", "end", "call_end_time"], format: formatDate },
  { label: "from", keys: ["from"] },
  { label: "to", keys: ["to"] },
  { label: "direction", keys: ["direction"] },
  { label: "status", keys: ["status"] },
];
const VOICE_PAGE_SIZE = 10;
const VOICE_STATUSES = [
  "answered",
  "completed",
  "failed",
  "busy",
  "cancelled",
  "unanswered",
  "machine",
  "error",
];

let lastVoiceRows: VoiceRow[] = [];
let voicePage = 0;
const voiceExpanded = new Set<number>();

panelVoice.innerHTML = `
  <div class="row">
    <div>Date start</div>
    <input id="voice-start" type="datetime-local" />
  </div>
  <div class="row">
    <div>Date end</div>
    <input id="voice-end" type="datetime-local" />
  </div>
  <div class="row">
    <div>Status</div>
    <select id="voice-status">
      <option value="">Any</option>
      ${VOICE_STATUSES.map((s) => `<option value="${s}">${s}</option>`).join("")}
    </select>
  </div>
  <div class="row">
    <div>Direction</div>
    <select id="voice-direction">
      <option value="">Any</option>
      <option value="inbound">inbound</option>
      <option value="outbound">outbound</option>
    </select>
  </div>
  <div class="actions">
    <button id="voice-run">Search calls</button>
    <span id="voice-state" class="hint"></span>
  </div>
  <div id="voice-table"></div>
`;

const voiceStart = document.getElementById("voice-start")! as HTMLInputElement;
const voiceEnd = document.getElementById("voice-end")! as HTMLInputElement;
const voiceStatusSel = document.getElementById("voice-status")! as HTMLSelectElement;
const voiceDirection = document.getElementById("voice-direction")! as HTMLSelectElement;
const voiceRun = document.getElementById("voice-run")! as HTMLButtonElement;
const voiceState = document.getElementById("voice-state")!;
const voiceTable = document.getElementById("voice-table")!;

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
voiceStart.value = toDatetimeLocal(isoDaysAgo(7));
voiceEnd.value = toDatetimeLocal(isoNow());

function voiceSafe(k: string, v: unknown): string {
  const lk = k.toLowerCase();
  if (lk === "from" || lk === "to" || lk.includes("msisdn") || lk.includes("phone") || lk.includes("number")) {
    return maskE164(v);
  }
  return v == null ? "" : String(v);
}

function renderVoiceTable(rows: VoiceRow[], page: number) {
  if (rows.length === 0) {
    voiceTable.innerHTML = '<div class="hint">No records.</div>';
    return;
  }

  const totalPages = Math.max(1, Math.ceil(rows.length / VOICE_PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * VOICE_PAGE_SIZE;
  const pageRows = rows.slice(start, start + VOICE_PAGE_SIZE);

  const bodyRows: string[] = [];
  pageRows.forEach((r, i) => {
    const absoluteIndex = start + i;
    const expanded = voiceExpanded.has(absoluteIndex);
    bodyRows.push(
      `<tr>` +
        `<td><button class="detail-toggle" data-idx="${absoluteIndex}">${expanded ? "▼" : "▶"}</button></td>` +
        VOICE_COLS.map((c) => {
          const raw = firstDefined(r, c.keys);
          const display = c.format ? c.format(raw) : voiceSafe(c.keys[0], raw);
          return `<td>${display}</td>`;
        }).join("") +
        `</tr>`
    );
    if (expanded) {
      const entries = Object.entries(r);
      bodyRows.push(
        `<tr class="voice-detail-row"><td colspan="${VOICE_COLS.length + 1}">` +
          `<div class="detail-grid">` +
          entries
            .map(
              ([k, v]) =>
                `<div class="detail-key">${k}</div><div class="detail-val">${voiceSafe(k, v)}</div>`
            )
            .join("") +
          `</div>` +
          `</td></tr>`
      );
    }
  });

  voiceTable.innerHTML = `
    <table>
      <thead><tr><th></th>${VOICE_COLS.map((c) => `<th>${c.label}</th>`).join("")}</tr></thead>
      <tbody>${bodyRows.join("")}</tbody>
    </table>
    <div class="pager">
      <button id="voice-prev" ${safePage === 0 ? "disabled" : ""}>Prev</button>
      <span class="hint">Page ${safePage + 1} of ${totalPages} · ${rows.length} calls</span>
      <button id="voice-next" ${safePage >= totalPages - 1 ? "disabled" : ""}>Next</button>
    </div>
    <div class="hint">Click ▶ to expand a row for full call details. Numbers are masked.</div>
  `;

  voiceTable.querySelectorAll<HTMLButtonElement>(".detail-toggle").forEach((btn) => {
    btn.onclick = () => {
      const idx = Number(btn.dataset.idx);
      if (voiceExpanded.has(idx)) voiceExpanded.delete(idx);
      else voiceExpanded.add(idx);
      renderVoiceTable(lastVoiceRows, voicePage);
    };
  });
  const prev = document.getElementById("voice-prev") as HTMLButtonElement | null;
  const next = document.getElementById("voice-next") as HTMLButtonElement | null;
  if (prev) prev.onclick = () => { voicePage = Math.max(0, voicePage - 1); renderVoiceTable(lastVoiceRows, voicePage); };
  if (next) next.onclick = () => { voicePage = voicePage + 1; renderVoiceTable(lastVoiceRows, voicePage); };
}

voiceRun.onclick = async () => {
  if (runningStandalone) {
    voiceState.textContent = "Tool calls are disabled in preview mode (no MCP host connected).";
    return;
  }
  voiceState.textContent = "Loading…";
  voiceTable.innerHTML = "";
  voiceExpanded.clear();
  voicePage = 0;

  const args: VoiceReportArgs = {};
  if (voiceStart.value) args.date_start = new Date(voiceStart.value).toISOString();
  if (voiceEnd.value) args.date_end = new Date(voiceEnd.value).toISOString();
  if (voiceStatusSel.value) args.status = voiceStatusSel.value;
  if (voiceDirection.value) args.direction = voiceDirection.value as "inbound" | "outbound";

  try {
    const res = await app.callServerTool({ name: "voice_report", arguments: args });
    const structured = (res as any)?.structuredContent;
    let rows = structured?.records ?? structured?.items ?? structured?.data ?? [];
    if (!Array.isArray(rows)) rows = [];
    lastVoiceRows = rows as VoiceRow[];

    renderVoiceTable(lastVoiceRows, voicePage);
    voiceState.textContent = `Loaded ${lastVoiceRows.length} calls.`;
  } catch (e: any) {
    voiceState.textContent = e?.message ? `Error: ${e.message}` : "Error";
  }
};

if (!runningStandalone) {
  app.connect().then(() => {
    const ctx = app.getHostContext();
    if (ctx) {
      handleHostContextChanged(ctx);
    }
  });
}
