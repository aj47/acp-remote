# Desktop Main Process - Agent Guidelines

## Architecture Overview

The desktop app has two modes for processing user requests:

### 1. Direct LLM API Mode (`mainAgentMode: "api"`)
- Uses `processTranscriptWithAgentMode()` in `llm.ts`
- Requires an LLM API key (OpenAI, Groq, or Gemini) configured in settings
- The desktop app calls the LLM API directly

### 2. ACP Agent Mode (`mainAgentMode: "acp"`)
- Uses `processTranscriptWithACPAgent()` in `acp-main-agent.ts`
- Routes requests to an external ACP agent (e.g., Claude Code, Cursor)
- **Does NOT require an LLM API key** - the ACP agent handles all LLM calls
- The desktop app acts as a proxy/orchestrator

## Key Files

| File | Purpose |
|------|---------|
| `tipc.ts` | IPC handlers for renderer, includes ACP mode routing logic |
| `remote-server.ts` | HTTP server for mobile app connections, must mirror tipc.ts routing |
| `llm.ts` | Direct LLM API calls via `processTranscriptWithAgentMode()` |
| `acp-main-agent.ts` | ACP agent routing via `processTranscriptWithACPAgent()` |
| `ai-sdk-provider.ts` | Creates LLM instances, throws if API key missing |

## Critical: Remote Server Must Mirror TIPC Routing

When adding new routing logic to `tipc.ts`, **always update `remote-server.ts` to match**.

The `runAgent()` function in `remote-server.ts` must check for ACP mode:

```typescript
// Check if ACP main agent mode is enabled
if (cfg.mainAgentMode === "acp" && cfg.mainAgentName) {
  const mainAgentProfile = agentProfileService.getByName(cfg.mainAgentName)
  const isInternalProfile = mainAgentProfile?.connection.type === "internal"
  
  if (!isInternalProfile) {
    // Route to ACP agent - no LLM API key needed
    return processTranscriptWithACPAgent(prompt, { ... })
  }
}
// Fall through to direct LLM path (requires API key)
```

## Common Mistakes

### ❌ "API key is required for openai" error from mobile app
This means the remote server is trying to use direct LLM mode but no API key is configured.

**Cause:** Remote server not checking for ACP mode before calling `processTranscriptWithAgentMode()`

**Fix:** Ensure `remote-server.ts` checks `cfg.mainAgentMode === "acp"` and routes to `processTranscriptWithACPAgent()` when appropriate.

### ❌ Assuming mobile app calls OpenAI directly
The mobile app ALWAYS routes through the desktop's remote server. It never calls LLM APIs directly.

**Flow:** Mobile App → Cloudflare Tunnel → Desktop Remote Server → (ACP Agent OR LLM API)

## Testing Checklist

When modifying agent routing:
1. Test desktop UI with ACP mode enabled
2. Test desktop UI with direct LLM mode
3. Test mobile app connection with ACP mode enabled
4. Test mobile app connection with direct LLM mode

