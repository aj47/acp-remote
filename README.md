# ACP Remote

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL%203.0-blue.svg)](./LICENSE)
[![Electron](https://img.shields.io/badge/Electron-31.0.2-47848f.svg)](https://electronjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6.3-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3.1-61dafb.svg)](https://reactjs.org/)

**Voice and mobile interface for [ACP (Agent Client Protocol)](https://agentclientprotocol.com/) agents.**

ACP Remote lets you control AI coding agents like [Claude Code](https://github.com/anthropics/claude-code), [Augment](https://www.augmentcode.com/), [Gemini CLI](https://github.com/google-gemini/gemini-cli), and other ACP-compatible agents using voice commands or from your mobile device.

## What is ACP?

The [Agent Client Protocol (ACP)](https://agentclientprotocol.com/) is an open standard that enables seamless communication between code editors/IDEs and AI coding agents — similar to how LSP standardized language server integration. ACP Remote acts as a client that can connect to any ACP-compatible agent.

## ✨ Features

| Category | Capabilities |
|----------|--------------|
| **🤖 ACP Agents** | Connect to Claude Code, Augment, Gemini CLI, Codex CLI, and any ACP-compatible agent |
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

1. **Install an ACP agent** (e.g., Claude Code):
   ```bash
   npm install -g @anthropics/claude-code
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

## 📱 Mobile App

Control your ACP agents from your phone:

1. **Desktop**: Enable remote access in Settings → enable Cloudflare tunnel
2. **Mobile**: Scan the QR code or enter the connection URL
3. **Chat**: Send voice or text messages to your agent from anywhere

The mobile app connects securely to your desktop via Cloudflare Tunnel — your agent runs locally, but you can control it remotely.

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
  "name": "claude-code",
  "connection": {
    "type": "stdio",
    "command": "claude",
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

**Made with ❤️ by the ACP Remote team**
