# Vonage Reports MCP App (Claude Desktop)

Interactive in-chat dashboard (MCP Apps) that wraps the Vonage Tooling MCP server’s `get-records-report` tool behind two friendly tools:
- `sms_weekly_report`
- `voice_call_lookup`

The UI masks phone numbers by default and keeps `include_message` off by default.

## Prerequisites
- Node.js
- Claude Desktop with MCP enabled
- Vonage credentials exported as environment variables (do not hardcode):
  - `VONAGE_API_KEY`
  - `VONAGE_API_SECRET`
  - Optional depending on your account/setup: `VONAGE_APPLICATION_ID`, `VONAGE_PRIVATE_KEY64`, `VONAGE_VIRTUAL_NUMBER`

## Install + build

```bash
npm install
npm run build
```

## Run (stdio MCP server)

```bash
npm start
```

## Claude Desktop configuration
Add a server entry pointing at this repo’s built server:

```json
{
  "mcpServers": {
    "vonage-reports-dashboard": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/vonage-reports-mcp-app/dist/server.js"],
      "env": {
        "VONAGE_API_KEY": "...",
        "VONAGE_API_SECRET": "..."
      }
    }
  }
}
```

Then in Claude Desktop, call either tool:
- `sms_weekly_report` (it will render the dashboard UI; defaults to the last 7 days if you omit dates)
- `voice_call_lookup` (same UI, voice tab)

## Notes
- This server spawns the Vonage tooling server via:
  - `npx -y @vonage/vonage-mcp-server-api-bindings`
- The advanced UI toggle “Include message content” maps to `include_message: true` and can expose PII/secrets.
