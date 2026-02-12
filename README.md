# ACP Remote

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL%203.0-blue.svg)](./LICENSE)
[![Electron](https://img.shields.io/badge/Electron-31.0.2-47848f.svg)](https://electronjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6.3-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3.1-61dafb.svg)](https://reactjs.org/)

**Voice and mobile interface for [ACP (Agent Client Protocol)](https://agentclientprotocol.com/) agents.**

ACP Remote lets you control AI coding agents like [Augment](https://www.augmentcode.com/), [Claude Code](https://github.com/anthropics/claude-code), [Gemini CLI](https://github.com/google-gemini/gemini-cli), and other ACP-compatible agents using voice commands or from your mobile device.

## What is ACP?

The [Agent Client Protocol (ACP)](https://agentclientprotocol.com/) is an open standard that enables seamless communication between code editors/IDEs and AI coding agents — similar to how LSP standardized language server integration. ACP Remote acts as a client that can connect to any ACP-compatible agent.

## ✨ Features

| Category | Capabilities |
|----------|--------------|
| **🤖 ACP Agents** | Connect to Augment, Claude Code, Gemini CLI, Codex CLI, and any ACP-compatible agent |
| **🎤 Voice Control** | Hold-to-record voice commands, 30+ languages, auto-transcription |
| **📱 Mobile App** | Control your desktop agents from iOS/Android via secure Cloudflare Tunnel |
| **🔧 MCP Tools** | Pass MCP servers to agents for filesystem, browser, database access |
| **🧠 Skills** | Dynamic instruction files that enhance agent capabilities on specialized tasks |
| **💾 Memories** | Persistent storage of agent interactions with key findings and tags |
| **👤 Personas** | Custom agent profiles with guidelines, system prompts, and per-profile MCP/skill configs |
| **💬 WhatsApp** | Send and receive WhatsApp messages via built-in MCP server with auto-reply |
| **🔊 TTS** | Text-to-speech responses via OpenAI, Groq, or Gemini |
| **⚙️ Model Selection** | Switch between agent models and modes via UI without chat commands |
| **🔐 Tool Approval** | Security workflow for approving sensitive MCP tool executions |
| **📋 Sessions** | Conversation history with full session management |
| **🎨 UX** | Dark/light themes, QR code mobile setup, real-time progress |

## 🚀 Quick Start

### Download

**[📥 Download Latest Release](https://github.com/aj47/acp-remote/releases/latest)**

> **Platform Support**: macOS (Apple Silicon & Intel). Windows/Linux support coming soon.

### Setup

1. **Install an ACP agent** (e.g., Augment):
   ```bash
   npm install -g @anthropics/claude-code  # or use Augment, Gemini CLI, etc.
   ```

2. **Launch ACP Remote** and configure your agent in Settings → Agent Profiles

3. **Start talking** — hold the hotkey to record, release to send to your agent

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Hold `Ctrl` | Voice recording → send to agent |
| Hold `Ctrl+Alt` | Voice recording with MCP tools |
| `Ctrl+T` | Text input mode |
| `Ctrl+Shift+Escape` | Emergency stop |

## 📱 Mobile & Web App

Control your ACP agents from your phone or any browser:

### Option 1: Web App (Easiest)

1. **Desktop**: Enable remote access in Settings → enable Cloudflare tunnel
2. **Open**: Visit **[acp-remote.pages.dev](https://acp-remote.pages.dev)** on any device
3. **Connect**: Scan the QR code or paste the connection URL from your desktop app
4. **Chat**: Send voice or text messages to your agent from anywhere

### Option 2: Native Mobile App

1. **Download**: Get the app from [App Store](#) or [Google Play](#) *(coming soon)*
2. **Desktop**: Enable remote access in Settings → enable Cloudflare tunnel
3. **Connect**: Scan the QR code shown in the desktop app
4. **Chat**: Full native experience with push notifications

### Features

| Feature | Web | Mobile |
|---------|-----|--------|
| Voice input | ✅ (Chrome/Edge) | ✅ |
| Text chat | ✅ | ✅ |
| QR code scanning | ✅ (camera) | ✅ |
| TTS voice selection | ✅ | ✅ |
| Push notifications | ❌ | ✅ |
| Offline support | ❌ | ✅ |

The app connects securely to your desktop via Cloudflare Tunnel — your agent runs locally, but you can control it remotely from anywhere.

## 🧠 Skills

Skills are dynamic instruction files that enhance agent capabilities on specialized tasks. They use a simple SKILL.md format:

```markdown
---
name: my-skill
description: What this skill does
---

Your instructions here...
```

Skills are loaded from `~/.speakmcp/skills/` and can be:
- **Local** — Created directly in the app
- **Imported** — Loaded from SKILL.md files
- **External** — Synced from `~/.augment/skills/` or other directories

Configure which skills are enabled per profile for fine-grained control.

## 💬 WhatsApp Integration

The built-in WhatsApp MCP server enables messaging capabilities:

- **Send/receive messages** to any WhatsApp contact
- **Auto-reply** — AI agent responds to incoming messages
- **Chat history** — Access recent conversations
- **QR code auth** — Easy setup via WhatsApp mobile app

Configure in Settings → WhatsApp, then ask the agent to "connect to WhatsApp" to scan the QR code.

## 🔧 Configuration

### Agent Profiles

Configure ACP agents in Settings → Agent Profiles:

```json
{
  "name": "augment",
  "connection": {
    "type": "stdio",
    "command": "augment-agent",
    "args": ["--acp"]
  }
}
```

### MCP Servers

Add MCP tools that agents can use:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"]
    }
  }
}
```

### STT/TTS Providers

Configure speech providers in Settings → Providers:
- **STT**: OpenAI Whisper, Groq Whisper, or local Sherpa-ONNX
- **TTS**: OpenAI, Groq, or Google Gemini voices

## 🖥️ Headless Mode (SSH/VM)

Run ACP Remote on a remote server or VM without a GUI:

### CLI Setup

Configure the app entirely from the terminal:

```bash
# Build the CLI
cd apps/desktop && pnpm run build:cli

# Interactive setup wizard
node dist-cli/index.js setup

# Or configure manually
node dist-cli/index.js config set remoteServerEnabled true
node dist-cli/index.js agent add auggie --command auggie --args "--acp"
node dist-cli/index.js agent set-main auggie
```

### CLI Commands

| Command | Description |
|---------|-------------|
| `acp-remote setup` | Interactive setup wizard |
| `acp-remote config get [key]` | Get configuration value(s) |
| `acp-remote config set <key> <value>` | Set a configuration value |
| `acp-remote agent list` | List all agent profiles |
| `acp-remote agent add <name>` | Add a new agent profile |
| `acp-remote agent set-main <name>` | Set the main agent |
| `acp-remote qr` | Show connection QR code |
| `acp-remote status` | Show current status |

### Running Headless

Start the app without GUI (server-only mode):

```bash
# Via command line flag
pnpm dev -- --headless

# Via environment variable
ACP_HEADLESS=1 pnpm dev

# With QR code output for mobile connection
pnpm dev -- --headless --qr
```

In headless mode:
- No windows are created
- Remote server starts automatically on port 3210
- Cloudflare tunnel auto-starts if configured
- Server URL printed to terminal

### Example Workflow

```bash
# 1. SSH into your VM
ssh user@your-vm

# 2. Clone and setup
git clone https://github.com/aj47/acp-remote.git && cd acp-remote
pnpm install && pnpm build-rs

# 3. Configure via CLI
cd apps/desktop && pnpm run build:cli
node dist-cli/index.js setup

# 4. Run headless with tunnel
pnpm dev -- --headless --qr

# 5. Scan QR code from mobile app to connect
```

## 🛠️ Development

```bash
git clone https://github.com/aj47/acp-remote.git && cd acp-remote
pnpm install && pnpm build-rs && pnpm dev
```

### Project Structure

```
apps/
  desktop/     # Electron desktop app
  mobile/      # React Native/Expo mobile app
packages/
  shared/      # Shared types and utilities
```

### Commands

```bash
pnpm dev              # Start desktop app in dev mode
pnpm dev:mobile       # Start mobile app
pnpm build            # Production build
pnpm test             # Run tests
pnpm typecheck        # Type check all packages
```

See **[DEVELOPMENT.md](DEVELOPMENT.md)** for full setup and architecture details.

## 🤝 Contributing

We welcome contributions! Fork the repo, create a feature branch, and open a Pull Request.

**💬 Get help on [Discord](https://discord.gg/cK9WeQ7jPq)**

## 📄 License

This project is licensed under the [AGPL-3.0 License](./LICENSE).

## 🙏 Acknowledgments

- [Agent Client Protocol](https://agentclientprotocol.com/) by Zed Industries
- [Model Context Protocol](https://modelcontextprotocol.io/) by Anthropic
- Built with [Electron](https://electronjs.org/), [React](https://reactjs.org/), [Expo](https://expo.dev/)

---

**Made with ❤️ by AJ**
