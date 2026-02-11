# Desktop Main Process - Agent Guidelines

## Architecture Overview

The desktop app uses ACP (Agent Communication Protocol) mode for all agent interactions:

### ACP Agent Mode (Default and Only Mode)
- Uses `processTranscriptWithACPAgent()` in `acp-main-agent.ts`
- Routes requests to an external ACP agent (e.g., Claude Code, Cursor, Auggie)
- **Does NOT require an LLM API key** - the ACP agent handles all LLM calls
- The desktop app acts as a proxy/orchestrator
- LLM API keys are only needed for STT (speech-to-text) and TTS (text-to-speech)

> **Note:** The `mainAgentMode` config option is deprecated. The app always operates in ACP mode now.

## Key Files

| File | Purpose |
|------|---------|
| `tipc.ts` | IPC handlers for renderer, routes to ACP agents |
| `remote-server.ts` | HTTP server for mobile app connections, must mirror tipc.ts routing |
| `acp-main-agent.ts` | ACP agent routing via `processTranscriptWithACPAgent()` |
| `llm.ts` | Internal agent fallback for "internal" connection type profiles |
| `ai-sdk-provider.ts` | Creates LLM instances for internal profiles (requires API key) |

## Critical: Remote Server Must Mirror TIPC Routing

When adding new routing logic to `tipc.ts`, **always update `remote-server.ts` to match**.

The `runAgent()` function in `remote-server.ts` routes to the configured ACP agent:

```typescript
// Route to the configured ACP agent
if (cfg.mainAgentName) {
  const mainAgentProfile = agentProfileService.getByName(cfg.mainAgentName)
  const isInternalProfile = mainAgentProfile?.connection.type === "internal"

  if (!isInternalProfile) {
    // External ACP agent - no LLM API key needed
    return processTranscriptWithACPAgent(prompt, { ... })
  }
}
// Fall through to internal profile path (requires API key)
```

## Agent Profile Types

| Connection Type | Description | LLM API Key Required? |
|-----------------|-------------|----------------------|
| `acp` | External ACP agent via URL | No |
| `stdio` | Local ACP agent via command | No |
| `remote` | Remote ACP agent endpoint | No |
| `internal` | Built-in agent using local LLM | Yes |

## Common Mistakes

### ❌ "API key is required for openai" error
This means you're using an internal profile but no LLM API key is configured.

**Fix:** Either:
1. Switch to an external ACP agent (e.g., auggie, claude-code)
2. Configure an LLM API key in Settings → Providers

### ❌ Assuming mobile app calls OpenAI directly
The mobile app ALWAYS routes through the desktop's remote server. It never calls LLM APIs directly.

**Flow:** Mobile App → Cloudflare Tunnel → Desktop Remote Server → ACP Agent

## Testing Checklist

When modifying agent routing:
1. Test desktop UI with external ACP agent (e.g., auggie)
2. Test desktop UI with internal profile (requires LLM API key)
3. Test mobile app connection with external ACP agent
4. Test mobile app connection with internal profile

