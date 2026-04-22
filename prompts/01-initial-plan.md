# Initial Plan: Vonage Reports Dashboard as an MCP App (Claude Desktop)

This plan outlines a Vonage Developer Blog tutorial that builds a runnable MCP server which renders an in-chat MCP App dashboard (SMS + Voice) and uses the existing `vonage-tooling-official` MCP server's `get-records-report` tool for real ops/debugging workflows.

---

## Post concept

**Working title:** "An In-Chat Ops Dashboard for Vonage SMS + Voice Using MCP Apps (with Claude Desktop)"

**One-liner value prop:** Turn raw Vonage traffic records into an interactive, conversation-native dashboard for weekly SMS monitoring and voice-call incident lookup.

**Target reader:** Developers/DevOps who already send SMS/make calls with Vonage and want faster visibility during incidents (delivery spikes, failure triage, call debugging).

---

## What you'll build (end state)

A new MCP server (the tutorial's repo) that:
- Exposes friendly tools (e.g. `sms_weekly_report`, `voice_call_lookup`) whose descriptions declare an MCP App UI via `_meta.ui.resourceUri: ui://…`
- Serves `ui://` resources (HTML/JS/CSS) for a two-tab dashboard rendered inside Claude Desktop
- Implements a thin adapter layer that proxies calls to `vonage-tooling-official` by requesting `tools/call` for `mcp2_get-records-report`

An MCP App UI with two tabs:
- **SMS Weekly:** defaults to last 7 days; status breakdown; optional filters; export to CSV
- **Voice Lookup:** paste a `call_id`; view record details; highlight failure/latency indicators

---

## Narrative / scenario for the blog post

**Story hook:** "Support says 'SMS is down' — you need to answer in minutes: is it regional, a sender issue, a carrier issue, or just an app bug?"

**Why MCP Apps:** keep context + tooling inside the incident chat; no switching to external dashboards; actions (filters/exports) stay next to the conversation.

---

## Key Vonage tool capabilities to highlight

Use the `get-records-report` tool to illustrate two query styles:

**Date-based:** "All outbound SMS sent over the last week"
- Parameters: `product: "SMS"`, `direction: "outbound"`, `date_start`, `date_end` (ISO-8601)
- Optional: `status`, `from`, `to`, `country`, `include_message`
- Default to `include_message: false` in the tutorial and UI
- Mention `include_message: true` as an advanced toggle with a warning and redaction guidance

**ID-based:** "Report for Voice Call ID …"
- Parameters: `product: "VOICE-CALL"`, `call_id` or `id`

---

## Proposed outline (blog sections)

1. **What we're building** — Screenshot/gif concept: two-tab dashboard inside Claude Desktop. "You'll use Vonage's tooling MCP server — no custom Reports API client needed."
2. **Prerequisites** — Vonage account + API key, Claude Desktop, Node.js
3. **Architecture: MCP tooling server + MCP App server** — Diagram + proxy pattern explanation
4. **Step 1: Configure Claude Desktop** — Add both servers, quick smoke test
5. **Step 2: Create the MCP App server** — Skeleton using `@modelcontextprotocol/sdk` + `@modelcontextprotocol/ext-apps`
6. **Step 3: Build the UI** — Two tabs, date pickers, filters, export, advanced message toggle
7. **Step 4: Map ops questions to filters** — Playbook: failure spikes, regional issues, carrier triage
8. **Step 5: Hardening + UX polish** — Empty states, masking, pagination, loading states
9. **Wrap-up and next steps** — MESSAGES/RCS, scheduled exports, share snapshot

---

## Concrete demo queries (verbatim snippets)

**Outbound SMS, last 7 days**
```json
{
  "product": "SMS",
  "direction": "outbound",
  "date_start": "<now-7d ISO>",
  "date_end": "<now ISO>",
  "include_message": false
}
```

**Voice Call ID lookup**
```json
{
  "product": "VOICE-CALL",
  "call_id": "1234-abcd-5678-efgh"
}
```

---

## Design decisions made during planning

| Decision | Choice | Rationale |
|---|---|---|
| Tool wiring | Wrap Vonage tool behind friendly tools (`sms_weekly_report`, `voice_call_lookup`) | Simpler UI, opinionated defaults, more teachable |
| Message content | `include_message: false` by default | PII safety; offered as advanced toggle with warning |
| Phone number display | Masked by default (last 4 digits) | Safe for screenshots, blog posts, and exports |

---

## Repo deliverables

- `package.json` with `@modelcontextprotocol/sdk` and `@modelcontextprotocol/ext-apps`
- MCP server entrypoint (`src/server.ts`)
- UI bundle served as `ui://` resource (single-file HTML via `vite-plugin-singlefile`)
- `README.md` with Claude Desktop config snippet, run instructions, and expected screenshots

---

## Open questions at time of writing

- Which SMS statuses are most meaningful to surface? *(resolved: delivered, failed, rejected, submitted, accepted, buffered, expired, deleted, unknown)*
- Redaction requirements for blog screenshots? *(resolved: mask by default, last 4 digits retained)*
