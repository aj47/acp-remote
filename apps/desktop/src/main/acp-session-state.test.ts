/**
 * Tests for ACP Session State Manager
 *
 * Note: Due to module-level initialization in acp-session-state.ts,
 * we test the in-memory behavior after module load, not the initial persistence loading.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Mock electron app BEFORE any imports
vi.mock("electron", () => ({
  app: {
    getPath: vi.fn(() => "/mock/app/data"),
  },
}))

// Mock fs - the module reads on load so we start with empty state
let mockFileData: string | null = null
const mockFsModule = {
  existsSync: vi.fn(() => mockFileData !== null),
  readFileSync: vi.fn(() => mockFileData || ""),
  writeFileSync: vi.fn((_path: string, data: string) => {
    mockFileData = data
  }),
  mkdirSync: vi.fn(),
}
vi.mock("fs", () => ({
  default: mockFsModule,
  ...mockFsModule,
}))

// Mock debug
vi.mock("./debug", () => ({
  logApp: vi.fn(),
}))

describe("ACP Session State Manager", () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    mockFileData = null
    // Reset the module to get fresh state for each test
    vi.resetModules()
  })

  afterEach(() => {
    vi.resetModules()
  })

  describe("In-Memory Session Management", () => {
    it("should set and get a session for a conversation", async () => {
      const { setSessionForConversation, getSessionForConversation } = await import("./acp-session-state")

      setSessionForConversation("conv-123", "session-abc", "test-agent", "/test/dir")

      const session = getSessionForConversation("conv-123")
      expect(session).toBeDefined()
      expect(session?.sessionId).toBe("session-abc")
      expect(session?.agentName).toBe("test-agent")
      expect(session?.cwd).toBe("/test/dir")
    })

    it("should persist sessions when setting a new session", async () => {
      const { setSessionForConversation } = await import("./acp-session-state")

      setSessionForConversation("conv-456", "session-xyz", "my-agent", "/work/dir")

      expect(mockFsModule.writeFileSync).toHaveBeenCalled()

      // Parse the persisted data
      expect(mockFileData).not.toBeNull()
      const writtenData = JSON.parse(mockFileData!)

      expect(writtenData.version).toBe(1)
      expect(writtenData.sessions["conv-456"]).toBeDefined()
      expect(writtenData.sessions["conv-456"].sessionId).toBe("session-xyz")
      expect(writtenData.sessions["conv-456"].cwd).toBe("/work/dir")
    })

    it("should clear a session and persist", async () => {
      const { setSessionForConversation, clearSessionForConversation, getSessionForConversation } = await import("./acp-session-state")

      // First set a session
      setSessionForConversation("conv-to-clear", "session-old", "old-agent")
      expect(getSessionForConversation("conv-to-clear")).toBeDefined()

      // Clear the mocks to verify clear triggers a write
      mockFsModule.writeFileSync.mockClear()

      // Clear it
      clearSessionForConversation("conv-to-clear")

      // Should persist the change
      expect(mockFsModule.writeFileSync).toHaveBeenCalled()

      // Session should be gone
      expect(getSessionForConversation("conv-to-clear")).toBeUndefined()
    })

    it("should update existing session", async () => {
      const { setSessionForConversation, getSessionForConversation } = await import("./acp-session-state")

      setSessionForConversation("conv-update", "session-v1", "agent-1")
      const session1 = getSessionForConversation("conv-update")
      const createdAt1 = session1?.createdAt

      // Wait a bit to ensure timestamp changes
      await new Promise(r => setTimeout(r, 5))

      // Update the session
      setSessionForConversation("conv-update", "session-v2", "agent-2", "/new/dir")

      const session2 = getSessionForConversation("conv-update")
      expect(session2?.sessionId).toBe("session-v2")
      expect(session2?.agentName).toBe("agent-2")
      expect(session2?.cwd).toBe("/new/dir")
      // createdAt should remain unchanged
      expect(session2?.createdAt).toBe(createdAt1)
      // lastUsedAt should be updated
      expect(session2?.lastUsedAt).toBeGreaterThanOrEqual(session2!.createdAt)
    })
  })

  describe("Context Injection Tracking", () => {
    it("should track context injection status", async () => {
      const { setSessionForConversation, hasContextBeenInjected, markContextInjected } = await import("./acp-session-state")

      setSessionForConversation("conv-ctx", "session-1", "agent-1")

      // Initially not injected
      expect(hasContextBeenInjected("conv-ctx")).toBe(false)

      // Mark as injected
      markContextInjected("conv-ctx")

      // Now should be true
      expect(hasContextBeenInjected("conv-ctx")).toBe(true)
    })
  })

  describe("getPersistedSessionInfo", () => {
    it("should return session info for session/load", async () => {
      const { setSessionForConversation, getPersistedSessionInfo } = await import("./acp-session-state")

      setSessionForConversation("conv-load", "load-session-id", "load-agent", "/load/dir")

      const info = getPersistedSessionInfo("conv-load")
      expect(info).toEqual({
        sessionId: "load-session-id",
        agentName: "load-agent",
        cwd: "/load/dir",
      })
    })

    it("should return undefined for non-existent conversation", async () => {
      const { getPersistedSessionInfo } = await import("./acp-session-state")

      const info = getPersistedSessionInfo("non-existent")
      expect(info).toBeUndefined()
    })
  })

  describe("Clear All Sessions", () => {
    it("should clear all sessions and persist by default", async () => {
      const { setSessionForConversation, clearAllSessions, getAllSessions } = await import("./acp-session-state")

      setSessionForConversation("conv-1", "session-1", "agent-1")
      setSessionForConversation("conv-2", "session-2", "agent-2")

      expect(getAllSessions().size).toBe(2)

      mockFsModule.writeFileSync.mockClear()

      clearAllSessions()

      expect(getAllSessions().size).toBe(0)
      expect(mockFsModule.writeFileSync).toHaveBeenCalled()
    })

    it("should not persist when persistToDisk is false", async () => {
      const { setSessionForConversation, clearAllSessions, getAllSessions } = await import("./acp-session-state")

      setSessionForConversation("conv-1", "session-1", "agent-1")

      mockFsModule.writeFileSync.mockClear()

      clearAllSessions(false)

      expect(getAllSessions().size).toBe(0)
      expect(mockFsModule.writeFileSync).not.toHaveBeenCalled()
    })
  })
})

