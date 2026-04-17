import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

type VonageToolingEnv = {
  VONAGE_API_KEY?: string;
  VONAGE_API_SECRET?: string;
  VONAGE_APPLICATION_ID?: string;
  VONAGE_PRIVATE_KEY64?: string;
  VONAGE_VIRTUAL_NUMBER?: string;
};

export type GetRecordsReportArgs = {
  account_id?: string;
  call_id?: string;
  country?: string;
  date_end?: string;
  date_start?: string;
  direction?: "inbound" | "outbound";
  from?: string;
  id?: string;
  include_message?: boolean;
  product:
    | "SMS"
    | "SMS-TRAFFIC-CONTROL"
    | "VOICE-CALL"
    | "VOICE-FAILED"
    | "VOICE-TTS"
    | "IN-APP-VOICE"
    | "WEBSOCKET-CALL"
    | "ASR"
    | "AMD"
    | "VERIFY-API"
    | "VERIFY-V2"
    | "NUMBER-INSIGHT"
    | "NUMBER-INSIGHT-V2"
    | "CONVERSATION-EVENT"
    | "CONVERSATION-MESSAGE"
    | "MESSAGES"
    | "VIDEO-API"
    | "NETWORK-API-EVENT"
    | "REPORTS-USAGE";
  status?: string;
  to?: string;
};

export class VonageToolingClient {
  private client: Client;
  private transport: StdioClientTransport;
  private connected = false;

  constructor(private readonly env: VonageToolingEnv) {
    this.transport = new StdioClientTransport({
      command: "npx",
      args: ["-y", "@vonage/vonage-mcp-server-api-bindings"],
      env: {
        ...process.env,
        ...env,
      },
    });

    this.client = new Client(
      {
        name: "vonage-reports-mcp-app",
        version: "0.1.0",
      },
      {
        capabilities: {},
      },
    );
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    await this.client.connect(this.transport);
    this.connected = true;
  }

  async getRecordsReport(args: GetRecordsReportArgs): Promise<CallToolResult> {
    await this.connect();
    try {
      const res = await this.client.callTool({
        name: "get-records-report",
        arguments: args,
      });
      return res as CallToolResult;
    } catch (err: any) {
      const message = typeof err?.message === "string" ? err.message : "";
      if (!message.toLowerCase().includes("not found")) {
        throw err;
      }

      const res = await this.client.callTool({
        name: "mcp2_get-records-report",
        arguments: args,
      });
      return res as CallToolResult;
    }
  }

  async close(): Promise<void> {
    if (!this.connected) return;
    await this.client.close();
    this.connected = false;
  }
}
