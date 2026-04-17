import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult, ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { VonageToolingClient, type GetRecordsReportArgs } from "./vonageClient.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = __filename.endsWith(".ts") ? path.join(__dirname, "..", "dist") : __dirname;

function maskPhoneLike(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const digits = value.replace(/\D/g, "");
  if (digits.length < 8) return value;
  const last4 = digits.slice(-4);
  return `***${last4}`;
}

function maskObjectDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(maskObjectDeep);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const lower = k.toLowerCase();
      if (/(msisdn|phone|from|to|number)/.test(lower)) {
        out[k] = maskPhoneLike(v);
      } else {
        out[k] = maskObjectDeep(v);
      }
    }
    return out;
  }
  return value;
}

const SmsWeeklyInput = z.object({
  date_start: z.string().optional(),
  date_end: z.string().optional(),
  status: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  country: z.string().optional(),
  include_message: z.boolean().optional(),
});

type SmsWeeklyInput = z.infer<typeof SmsWeeklyInput>;

const VoiceReportInput = z.object({
  date_start: z.string().optional(),
  date_end:   z.string().optional(),
  status:     z.string().optional(),
  direction:  z.enum(["inbound", "outbound"]).optional(),
});

type VoiceReportInput = z.infer<typeof VoiceReportInput>;

function isoNow(): string {
  return new Date().toISOString();
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function extractStructured(res: unknown): unknown {
  const r = res as any;
  // Prefer explicit structuredContent if present
  if (r?.structuredContent != null) return r.structuredContent;
  // Fall back to parsing content[0].text as JSON (common for upstream MCP servers)
  const text = r?.content?.[0]?.text;
  if (typeof text === "string") {
    // The Vonage MCP server prefixes responses with a human-readable summary
    // before the JSON blob, e.g. "Records report for SMS:\n...\n\n{...}"
    // Extract the first {...} or [...] block we can parse.
    const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch { /* fall through */ }
    }
    try {
      return JSON.parse(text);
    } catch {
      return { message: text };
    }
  }
  return {};
}

/** Normalise the upstream response into { records: [...], meta: {...} }
 *  The Vonage Reports API returns arrays under "items", "records", or "data". */
function normalizeToRecords(data: unknown): { records: Record<string, unknown>[]; meta: Record<string, unknown> } {
  const d = data as any;
  const arr: unknown = d?.records ?? d?.items ?? d?.data ?? d?.messages ?? d?.calls;
  const records = Array.isArray(arr) ? arr as Record<string, unknown>[] : [];
  // Everything that isn't the array becomes meta
  const { records: _r, items: _i, data: _d, messages: _m, calls: _c, ...rest } = d ?? {};
  return { records, meta: rest };
}

export function createServer(): McpServer {
  const server = new McpServer({
    name: "Vonage Reports MCP App",
    version: "0.1.0",
  });

  const resourceUri = "ui://vonage-reports/mcp-app.html";

  const vonage = new VonageToolingClient({
    VONAGE_API_KEY: process.env.VONAGE_API_KEY,
    VONAGE_API_SECRET: process.env.VONAGE_API_SECRET,
    VONAGE_APPLICATION_ID: process.env.VONAGE_APPLICATION_ID,
    VONAGE_PRIVATE_KEY64: process.env.VONAGE_PRIVATE_KEY64,
    VONAGE_VIRTUAL_NUMBER: process.env.VONAGE_VIRTUAL_NUMBER,
  });

  registerAppTool(
    server,
    "sms_report",
    {
      title: "SMS Report",
      description: "Fetch outbound SMS records for a date range (optimized for an ops dashboard).",
      inputSchema: SmsWeeklyInput.shape,
      outputSchema: z.object({
        records: z.array(z.record(z.string(), z.unknown())),
        meta: z.record(z.string(), z.unknown()).optional(),
      }),
      _meta: { ui: { resourceUri } },
    },
    async (args: SmsWeeklyInput): Promise<CallToolResult> => {
      const reportArgs: GetRecordsReportArgs = {
        product: "SMS",
        direction: "outbound",
        date_start: args.date_start ?? isoDaysAgo(7),
        date_end: args.date_end ?? isoNow(),
        status: args.status,
        from: args.from,
        to: args.to,
        country: args.country,
        include_message: args.include_message ?? false,
      };

      const res = await vonage.getRecordsReport(reportArgs);
      const normalized = normalizeToRecords(extractStructured(res));
      const masked = maskObjectDeep(normalized);

      return {
        content: [
          {
            type: "text",
            text: "SMS weekly report ready (structured data provided to the UI).",
          },
        ],
        structuredContent: masked as any,
      };
    },
  );

  registerAppTool(
    server,
    "voice_report",
    {
      title: "Voice Report",
      description: "Browse voice call records for a date range with optional status and direction filters.",
      inputSchema: VoiceReportInput.shape,
      outputSchema: z.object({
        records: z.array(z.record(z.string(), z.unknown())).optional(),
        meta: z.record(z.string(), z.unknown()).optional(),
      }),
      _meta: { ui: { resourceUri } },
    },
    async (args: VoiceReportInput): Promise<CallToolResult> => {
      const reportArgs: GetRecordsReportArgs = {
        product:    "VOICE-CALL",
        date_start: args.date_start ?? isoDaysAgo(7),
        date_end:   args.date_end   ?? isoNow(),
        status:     args.status,
        direction:  args.direction,
      };

      const res = await vonage.getRecordsReport(reportArgs);
      const normalized = normalizeToRecords(extractStructured(res));
      const masked = maskObjectDeep(normalized);

      return {
        content: [{ type: "text", text: "Voice report ready (structured data provided to the UI)." }],
        structuredContent: masked as any,
      };
    },
  );

  registerAppResource(
    server,
    resourceUri,
    resourceUri,
    { mimeType: RESOURCE_MIME_TYPE },
    async (): Promise<ReadResourceResult> => {
      const html = await fs.readFile(path.join(DIST_DIR, "mcp-app.html"), "utf-8");
      return {
        contents: [{ uri: resourceUri, mimeType: RESOURCE_MIME_TYPE, text: html }],
      };
    },
  );

  return server;
}

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
