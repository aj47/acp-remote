/**
 * ACP Session State Manager
 *
 * Manages mapping between ACP Remote conversations and ACP sessions.
 * This allows maintaining context across multiple prompts in the same conversation
 * when using an ACP agent as the main agent.
 *
 * Session mappings are persisted to disk to enable resuming sessions after app restart.
 */

import { app } from "electron"
import path from "path"
import fs from "fs"
import { logApp } from "./debug"

/**
 * Information about an active ACP session
 */
export interface ACPSessionInfo {
  /** The ACP session ID */
  sessionId: string
  /** Name of the ACP agent */
  agentName: string
  /** Timestamp when the session was created */
  createdAt: number
  /** Timestamp when the session was last used */
  lastUsedAt: number
  /** Whether context (memories, guidelines, skills) has been injected for this session */
  contextInjected?: boolean
  /** Working directory used when the session was created */
  cwd?: string
}

// Session persistence file path - computed lazily after app is ready
let dataFolder: string | null = null
let sessionPersistencePath: string | null = null

/**
 * Persisted session data structure
 */
interface PersistedSessionData {
  version: number
  sessions: Record<string, ACPSessionInfo>
}

/**
 * Get the session persistence path, initializing if needed
 */
function getSessionPersistencePath(): string {
  if (!sessionPersistencePath) {
    dataFolder = path.join(app.getPath("appData"), process.env.APP_ID || "speakmcp")
    sessionPersistencePath = path.join(dataFolder, "acp-sessions.json")
  }
  return sessionPersistencePath
}

/**
 * Get the data folder path, initializing if needed
 */
function getDataFolder(): string {
  if (!dataFolder) {
    dataFolder = path.join(app.getPath("appData"), process.env.APP_ID || "speakmcp")
    sessionPersistencePath = path.join(dataFolder, "acp-sessions.json")
  }
  return dataFolder
}

/**
 * Load persisted sessions from disk
 */
function loadPersistedSessions(): void {
  try {
    const persistPath = getSessionPersistencePath()
    logApp(`[ACP Session] Loading sessions from: ${persistPath}`)
    if (fs.existsSync(persistPath)) {
      const data = fs.readFileSync(persistPath, "utf8")
      const parsed: PersistedSessionData = JSON.parse(data)
      logApp(`[ACP Session] Parsed data version: ${parsed.version}, sessions: ${JSON.stringify(Object.keys(parsed.sessions || {}))}`)
      if (parsed.version === 1 && parsed.sessions) {
        // Load sessions into the map
        for (const [key, value] of Object.entries(parsed.sessions)) {
          conversationSessions.set(key, value)
        }
        logApp(`[ACP Session] Loaded ${conversationSessions.size} persisted sessions from disk`)
      }
    } else {
      logApp(`[ACP Session] Sessions file does not exist yet`)
    }
  } catch (error) {
    logApp(`[ACP Session] Failed to load persisted sessions: ${error}`)
  }
}

/**
 * Save sessions to disk for persistence across app restarts
 */
function persistSessions(): void {
  try {
    const folder = getDataFolder()
    const persistPath = getSessionPersistencePath()
    fs.mkdirSync(folder, { recursive: true })
    const data: PersistedSessionData = {
      version: 1,
      sessions: Object.fromEntries(conversationSessions),
    }
    fs.writeFileSync(persistPath, JSON.stringify(data, null, 2))
    logApp(`[ACP Session] Persisted ${conversationSessions.size} sessions to disk`)
  } catch (error) {
    logApp(`[ACP Session] Failed to persist sessions: ${error}`)
  }
}

// In-memory storage for conversation-to-session mapping
// Initialized empty, populated by initializeSessionState() after app is ready
const conversationSessions: Map<string, ACPSessionInfo> = new Map()

// Track which sessions have been verified as active in the current app session
// Sessions loaded from disk need to go through session/load before being used
const verifiedActiveSessions: Set<string> = new Set()

// Track if session state has been initialized
let sessionStateInitialized = false

/**
 * Initialize session state - must be called after app.whenReady()
 * Loads persisted sessions from disk
 */
export function initializeSessionState(): void {
  if (sessionStateInitialized) {
    logApp("[ACP Session] Session state already initialized, skipping")
    return
  }
  sessionStateInitialized = true
  logApp("[ACP Session] Initializing session state...")
  loadPersistedSessions()
}

// Mapping from ACP session ID → ACP Remote session ID
// This is needed for routing tool approval requests to the correct UI session
const acpToSpeakMcpSession: Map<string, string> = new Map()

/**
 * Get the ACP session for a conversation (if any).
 * Only returns sessions that have been verified as active in the current app session.
 * For persisted sessions that need session/load, use getPersistedSessionInfo().
 * @param conversationId The ACP Remote conversation ID
 * @returns Session info if exists and is verified active, undefined otherwise
 */
export function getSessionForConversation(conversationId: string): ACPSessionInfo | undefined {
  const session = conversationSessions.get(conversationId)
  // Only return if this session has been verified as active in the current app session
  if (session && verifiedActiveSessions.has(conversationId)) {
    return session
  }
  return undefined
}

/**
 * Set/update the ACP session for a conversation.
 * This marks the session as verified active in the current app session.
 * @param conversationId The ACP Remote conversation ID
 * @param sessionId The ACP session ID
 * @param agentName The name of the ACP agent
 * @param cwd Optional working directory used for the session
 */
export function setSessionForConversation(
  conversationId: string,
  sessionId: string,
  agentName: string,
  cwd?: string
): void {
  const now = Date.now()
  const existing = conversationSessions.get(conversationId)

  if (existing) {
    // Update existing session info
    existing.sessionId = sessionId
    existing.agentName = agentName
    existing.lastUsedAt = now
    if (cwd) existing.cwd = cwd
    logApp(`[ACP Session] Updated session for conversation ${conversationId}: ${sessionId}`)
  } else {
    // Create new session info
    conversationSessions.set(conversationId, {
      sessionId,
      agentName,
      createdAt: now,
      lastUsedAt: now,
      cwd,
    })
    logApp(`[ACP Session] Created session mapping for conversation ${conversationId}: ${sessionId}`)
  }

  // Mark as verified active in the current app session
  verifiedActiveSessions.add(conversationId)

  // Persist to disk
  persistSessions()
}

/**
 * Clear the session for a conversation.
 * Use when user explicitly requests a new session or when conversation is deleted.
 * @param conversationId The ACP Remote conversation ID
 */
export function clearSessionForConversation(conversationId: string): void {
  if (conversationSessions.has(conversationId)) {
    conversationSessions.delete(conversationId)
    verifiedActiveSessions.delete(conversationId)
    logApp(`[ACP Session] Cleared session for conversation ${conversationId}`)
    persistSessions()
  }
}

/**
 * Clear all sessions.
 * Use on app shutdown or when ACP agent is restarted.
 * @param persistToDisk Whether to persist the change to disk (default: true)
 */
export function clearAllSessions(persistToDisk: boolean = true): void {
  const count = conversationSessions.size
  conversationSessions.clear()
  verifiedActiveSessions.clear()
  logApp(`[ACP Session] Cleared all ${count} sessions`)
  if (persistToDisk) {
    persistSessions()
  }
}

/**
 * Get all active sessions.
 * Useful for debugging and UI display.
 * @returns Map of conversation ID to session info
 */
export function getAllSessions(): Map<string, ACPSessionInfo> {
  return new Map(conversationSessions)
}

/**
 * Update the last used timestamp for a session.
 * @param conversationId The ACP Remote conversation ID
 */
export function touchSession(conversationId: string): void {
  const session = conversationSessions.get(conversationId)
  if (session) {
    session.lastUsedAt = Date.now()
  }
}

/**
 * Check if context has been injected for a session.
 * @param conversationId The ACP Remote conversation ID
 * @returns true if context has been injected, false otherwise
 */
export function hasContextBeenInjected(conversationId: string): boolean {
  const session = conversationSessions.get(conversationId)
  return session?.contextInjected ?? false
}

/**
 * Mark context as injected for a session.
 * @param conversationId The ACP Remote conversation ID
 */
export function markContextInjected(conversationId: string): void {
  const session = conversationSessions.get(conversationId)
  if (session) {
    session.contextInjected = true
    logApp(`[ACP Session] Marked context as injected for conversation ${conversationId}`)
    persistSessions()
  }
}

/**
 * Check if a persisted session exists for a conversation that could potentially be loaded.
 * This is useful to determine if we should attempt session/load before creating a new session.
 * @param conversationId The ACP Remote conversation ID
 * @returns true if a persisted session exists with the given agent
 */
export function hasPersistedSession(conversationId: string, agentName: string): boolean {
  const session = conversationSessions.get(conversationId)
  return !!session && session.agentName === agentName
}

/**
 * Get session info for session/load call
 * @param conversationId The ACP Remote conversation ID
 * @returns Session info needed for session/load, or undefined
 */
export function getPersistedSessionInfo(conversationId: string): {
  sessionId: string
  agentName: string
  cwd?: string
} | undefined {
  const session = conversationSessions.get(conversationId)
  logApp(`[ACP Session] getPersistedSessionInfo for ${conversationId}: ${session ? `found session ${session.sessionId} for agent ${session.agentName}` : 'not found'}`)
  logApp(`[ACP Session] Available sessions: ${JSON.stringify(Array.from(conversationSessions.keys()))}`)
  if (!session) return undefined
  return {
    sessionId: session.sessionId,
    agentName: session.agentName,
    cwd: session.cwd,
  }
}

/**
 * Map an ACP session ID to an ACP Remote session ID.
 * This is needed for routing tool approval requests to the correct UI session.
 * @param acpSessionId The ACP agent's session ID
 * @param speakMcpSessionId The ACP Remote internal session ID (for UI progress tracking)
 */
export function setAcpToSpeakMcpSessionMapping(
  acpSessionId: string,
  speakMcpSessionId: string
): void {
  acpToSpeakMcpSession.set(acpSessionId, speakMcpSessionId)
  logApp(`[ACP Session] Mapped ACP session ${acpSessionId} → ACP Remote session ${speakMcpSessionId}`)
}

/**
 * Get the ACP Remote session ID for a given ACP session ID.
 * @param acpSessionId The ACP agent's session ID
 * @returns The ACP Remote session ID, or undefined if not mapped
 */
export function getSpeakMcpSessionForAcpSession(acpSessionId: string): string | undefined {
  return acpToSpeakMcpSession.get(acpSessionId)
}

/**
 * Clear the ACP → ACP Remote session mapping.
 * @param acpSessionId The ACP session ID to remove
 */
export function clearAcpToSpeakMcpSessionMapping(acpSessionId: string): void {
  if (acpToSpeakMcpSession.has(acpSessionId)) {
    acpToSpeakMcpSession.delete(acpSessionId)
    logApp(`[ACP Session] Cleared ACP → ACP Remote mapping for ${acpSessionId}`)
  }
}

