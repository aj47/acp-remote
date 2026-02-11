/**
 * ACP Main Agent Handler
 *
 * Routes transcripts to an ACP agent instead of the LLM API when ACP mode is enabled.
 * This allows using agents like Claude Code as the "brain" for ACP Remote.
 */

import { acpService, ACPContentBlock } from "./acp-service"
import {
  getSessionForConversation,
  setSessionForConversation,
  clearSessionForConversation,
  touchSession,
  setAcpToSpeakMcpSessionMapping,
  hasContextBeenInjected,
  markContextInjected,
} from "./acp-session-state"
import { emitAgentProgress } from "./emit-agent-progress"
import { AgentProgressUpdate, AgentProgressStep, AgentMemory, AgentProfile } from "../shared/types"
import { logApp } from "./debug"
import { conversationService } from "./conversation-service"
import { memoryService } from "./memory-service"
import { skillsService } from "./skills-service"
import { configStore } from "./config"
import { agentProfileService } from "./agent-profile-service"

/**
 * Format memories for ACP context injection.
 * Similar to formatMemoriesForPrompt in system-prompts.ts but returns a simpler format.
 */
function formatMemoriesForContext(memories: AgentMemory[], maxMemories: number = 15): string {
  if (!memories || memories.length === 0) return ""

  // Sort by importance (critical > high > medium > low) then by recency
  const importanceOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
  const sorted = [...memories].sort((a, b) => {
    const impDiff = importanceOrder[a.importance] - importanceOrder[b.importance]
    if (impDiff !== 0) return impDiff
    return b.createdAt - a.createdAt // More recent first
  })

  // Take top N memories
  const selected = sorted.slice(0, maxMemories)
  if (selected.length === 0) return ""

  // Format as single-line entries
  return selected.map(mem => `- ${mem.content.replace(/[\r\n]+/g, ' ')}`).join("\n")
}

/**
 * Construct the context prefix to inject into the first ACP prompt.
 * This includes memories, guidelines, skills, and persona context - similar to how LLM mode works.
 *
 * @param profileId - Optional profile ID for scoping memories
 * @param mainAgentProfile - Optional main agent profile for persona-specific context
 */
async function constructACPContextPrefix(
  profileId?: string,
  mainAgentProfile?: AgentProfile
): Promise<string> {
  const sections: string[] = []
  const config = configStore.get()

  // 1. Persona System Prompt (if the main agent has one)
  // This defines the agent's personality and behavior
  if (mainAgentProfile?.systemPrompt?.trim()) {
    sections.push(`# Persona Instructions
${mainAgentProfile.systemPrompt.trim()}`)
    logApp(`[ACP Context] Injecting persona system prompt from ${mainAgentProfile.name}`)
  }

  // 2. Persona Properties (dynamic key-value pairs from persona)
  if (mainAgentProfile?.properties && Object.keys(mainAgentProfile.properties).length > 0) {
    const propertiesText = Object.entries(mainAgentProfile.properties)
      .map(([key, value]) => `- **${key}**: ${value}`)
      .join("\n")
    sections.push(`# Persona Properties
${propertiesText}`)
    logApp(`[ACP Context] Injecting ${Object.keys(mainAgentProfile.properties).length} persona properties`)
  }

  // 3. Memories (profile-scoped if available)
  if (config.memoriesEnabled !== false && config.dualModelInjectMemories) {
    try {
      const allMemories = profileId
        ? await memoryService.getMemoriesByProfile(profileId)
        : await memoryService.getAllMemories()

      const formattedMemories = formatMemoriesForContext(allMemories, 15)
      if (formattedMemories) {
        sections.push(`# Memories from Previous Sessions
These are important insights and learnings saved from previous interactions. Use them to inform your decisions.

${formattedMemories}`)
      }
    } catch (error) {
      logApp(`[ACP Context] Failed to load memories: ${error}`)
    }
  }

  // 4. Guidelines (from persona first, then global config as fallback)
  const personaGuidelines = mainAgentProfile?.guidelines?.trim()
  const globalGuidelines = config.mcpToolsSystemPrompt?.trim()

  // Combine persona and global guidelines if both exist
  const combinedGuidelines = [personaGuidelines, globalGuidelines]
    .filter(Boolean)
    .join("\n\n")

  if (combinedGuidelines) {
    sections.push(`# User Guidelines
${combinedGuidelines}`)
  }

  // 3. Skills (enabled skills for the profile)
  try {
    const enabledSkills = skillsService.getEnabledSkills()
    if (enabledSkills.length > 0) {
      const skillsList = enabledSkills.map(skill => {
        const source = skill.source === "external" && skill.sourceDirectory
          ? ` (from ${skill.sourceDirectory})`
          : ""
        return `- **${skill.name}**${source}: ${skill.description || 'No description'}`
      }).join("\n")

      sections.push(`# Available Skills
The following skills are available to help with specialized tasks:

${skillsList}

To get full instructions for a skill, you can ask about it or use the skill's guidance directly.`)
    }
  } catch (error) {
    logApp(`[ACP Context] Failed to load skills: ${error}`)
  }

  if (sections.length === 0) {
    return ""
  }

  return `---
# Context from ACP Remote

The following context is provided to help you assist the user effectively.

${sections.join("\n\n")}

---

`
}

export interface ACPMainAgentOptions {
  /** Name of the ACP agent to use */
  agentName: string
  /** ACP Remote conversation ID */
  conversationId: string
  /** Force creating a new session even if one exists */
  forceNewSession?: boolean
  /** Session ID for progress tracking (from agentSessionTracker) */
  sessionId: string
  /** Callback for progress updates */
  onProgress?: (update: AgentProgressUpdate) => void
}

export interface ACPMainAgentResult {
  /** Whether the request succeeded */
  success: boolean
  /** The agent's response text */
  response?: string
  /** The ACP session ID (for future prompts) */
  acpSessionId?: string
  /** Why the agent stopped */
  stopReason?: string
  /** Error message if failed */
  error?: string
}

/**
 * Process a transcript using an ACP agent as the main agent.
 * This bypasses the normal LLM API call and routes directly to the ACP agent.
 */
export async function processTranscriptWithACPAgent(
  transcript: string,
  options: ACPMainAgentOptions
): Promise<ACPMainAgentResult> {
  const { agentName, conversationId, forceNewSession, sessionId, onProgress } = options

  logApp(`[ACP Main] Processing transcript with agent ${agentName} for conversation ${conversationId}`)

  // Track accumulated text across all session updates for streaming display
  let accumulatedText = ""

  // Counter for generating unique step IDs to avoid collisions in tight loops
  let stepIdCounter = 0
  const generateStepId = (prefix: string): string => `${prefix}-${Date.now()}-${++stepIdCounter}`

  // Load existing conversation history for UI display
  type ConversationHistoryMessage = {
    role: "user" | "assistant" | "tool"
    content: string
    timestamp?: number
  }
  let conversationHistory: ConversationHistoryMessage[] = []

  try {
    const conversation = await conversationService.loadConversation(conversationId)
    if (conversation) {
      conversationHistory = conversation.messages.map(m => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
      }))
    }
  } catch (err) {
    logApp(`[ACP Main] Failed to load conversation history: ${err}`)
  }

  // Helper to get ACP session info for progress updates (Task 3.1)
  const getAcpSessionInfo = () => {
    const agentInstance = acpService.getAgentInstance(agentName)
    if (!agentInstance) return undefined
    return {
      agentName: agentInstance.agentInfo?.name,
      agentTitle: agentInstance.agentInfo?.title,
      agentVersion: agentInstance.agentInfo?.version,
      currentModel: agentInstance.sessionInfo?.models?.currentModelId,
      currentMode: agentInstance.sessionInfo?.modes?.currentModeId,
      availableModels: agentInstance.sessionInfo?.models?.availableModels?.map(m => ({
        id: m.modelId,
        name: m.name,
        description: m.description,
      })),
      availableModes: agentInstance.sessionInfo?.modes?.availableModes?.map(m => ({
        id: m.id,
        name: m.name,
        description: m.description,
      })),
    }
  }

  // Emit progress with optional streaming content and conversation history
  const emitProgress = async (
    steps: AgentProgressStep[],
    isComplete: boolean,
    finalContent?: string,
    streamingContent?: { text: string; isStreaming: boolean }
  ) => {
    const update: AgentProgressUpdate = {
      sessionId,
      conversationId,
      currentIteration: 1,
      maxIterations: 1,
      steps,
      isComplete,
      finalContent,
      streamingContent,
      conversationHistory,
      // Include ACP session info in progress updates (Task 3.1)
      acpSessionInfo: getAcpSessionInfo(),
    }
    await emitAgentProgress(update)
    onProgress?.(update)
  }

  // Note: User message is already added to conversation by createMcpTextInput or processQueuedMessages
  // So we don't add it here - it's already in the loaded conversationHistory

  // Show thinking step
  await emitProgress([
    {
      id: generateStepId("acp-thinking"),
      type: "thinking",
      title: `Sending to ${agentName}...`,
      status: "in_progress",
      timestamp: Date.now(),
    },
  ], false)

  try {
    // Get or create ACP session
    const existingSession = forceNewSession ? undefined : getSessionForConversation(conversationId)
    let acpSessionId: string | undefined

    if (existingSession && existingSession.agentName === agentName) {
      // Reuse existing session
      acpSessionId = existingSession.sessionId
      touchSession(conversationId)
      logApp(`[ACP Main] Reusing existing session ${acpSessionId}`)
    } else {
      // Create new session
      acpSessionId = await acpService.getOrCreateSession(agentName, true)
      if (!acpSessionId) {
        throw new Error(`Failed to create session with agent ${agentName}`)
      }
      setSessionForConversation(conversationId, acpSessionId, agentName)
      logApp(`[ACP Main] Created new session ${acpSessionId}`)
    }

    // Register the ACP session → ACP Remote session mapping
    // This is critical for routing tool approval requests to the correct UI session
    setAcpToSpeakMcpSessionMapping(acpSessionId, sessionId)

    // Set up progress listener for session updates
    const progressHandler = (event: {
      agentName: string
      sessionId: string
      content?: ACPContentBlock[]
      isComplete?: boolean
      toolResponseStats?: {
        status?: string
        agentId?: string
        totalDurationMs?: number
        totalTokens?: number
        totalToolUseCount?: number
        usage?: {
          input_tokens?: number
          cache_creation_input_tokens?: number
          cache_read_input_tokens?: number
          output_tokens?: number
        }
      }
    }) => {
      if (event.sessionId !== acpSessionId) return

      // Map content blocks to progress steps and accumulate text
      const steps: AgentProgressStep[] = []
      if (event.content) {
        for (const block of event.content) {
          if (block.type === "text" && block.text) {
            // Accumulate text for streaming display
            accumulatedText += block.text
            steps.push({
              id: generateStepId("acp-text"),
              type: "thinking",
              title: "Agent response",
              description: block.text.substring(0, 200) + (block.text.length > 200 ? "..." : ""),
              status: event.isComplete ? "completed" : "in_progress",
              timestamp: Date.now(),
              llmContent: accumulatedText, // Use accumulated text, not just this block
            })
          } else if (block.type === "tool_use" && block.name) {
            const step: AgentProgressStep = {
              id: generateStepId("acp-tool"),
              type: "tool_call",
              title: `Tool: ${block.name}`,
              status: "in_progress",
              timestamp: Date.now(),
            }
            // Attach execution stats if available from tool response
            if (event.toolResponseStats) {
              step.executionStats = {
                durationMs: event.toolResponseStats.totalDurationMs,
                totalTokens: event.toolResponseStats.totalTokens,
                toolUseCount: event.toolResponseStats.totalToolUseCount,
                inputTokens: event.toolResponseStats.usage?.input_tokens,
                outputTokens: event.toolResponseStats.usage?.output_tokens,
                cacheHitTokens: event.toolResponseStats.usage?.cache_read_input_tokens,
              }
              step.subagentId = event.toolResponseStats.agentId
            }
            steps.push(step)
          }
        }
      }

      // If we have toolResponseStats but no tool_use content block, it's a tool completion update
      // Emit a step with the execution stats
      if (event.toolResponseStats && steps.length === 0) {
        steps.push({
          id: generateStepId("acp-tool-result"),
          type: "tool_call",
          title: "Tool completed",
          status: "completed",
          timestamp: Date.now(),
          executionStats: {
            durationMs: event.toolResponseStats.totalDurationMs,
            totalTokens: event.toolResponseStats.totalTokens,
            toolUseCount: event.toolResponseStats.totalToolUseCount,
            inputTokens: event.toolResponseStats.usage?.input_tokens,
            outputTokens: event.toolResponseStats.usage?.output_tokens,
            cacheHitTokens: event.toolResponseStats.usage?.cache_read_input_tokens,
          },
          subagentId: event.toolResponseStats.agentId,
        })
      }

      // Always emit with streaming content to show accumulated text
      // Handle the promise to avoid unhandled rejections in the main process
      emitProgress(
        steps.length > 0 ? steps : [{
          id: generateStepId("acp-streaming"),
          type: "thinking",
          title: "Agent response",
          status: "in_progress",
          timestamp: Date.now(),
          llmContent: accumulatedText,
        }],
        event.isComplete ?? false,
        undefined,
        {
          text: accumulatedText,
          isStreaming: !event.isComplete,
        }
      ).catch(err => {
        logApp(`[ACP Main] Failed to emit progress: ${err}`)
      })
    }

    acpService.on("sessionUpdate", progressHandler)

    try {
      // Check if this is the first prompt for this session (context not yet injected)
      const shouldInjectContext = !hasContextBeenInjected(conversationId)
      let promptToSend = transcript

      if (shouldInjectContext) {
        // Get the main agent's profile to inject persona-specific context
        const mainAgentProfile = agentProfileService.getByName(agentName)

        // Construct and prepend context prefix (memories, guidelines, skills, persona)
        const contextPrefix = await constructACPContextPrefix(
          configStore.get().mcpCurrentProfileId,
          mainAgentProfile
        )
        if (contextPrefix) {
          promptToSend = contextPrefix + transcript
          logApp(`[ACP Main] Injected context prefix (${contextPrefix.length} chars) for first prompt`)
        }
        // Mark context as injected so we don't inject again for this session
        markContextInjected(conversationId)
      }

      // Send the prompt
      const result = await acpService.sendPrompt(agentName, acpSessionId, promptToSend)

      // Use accumulated text if result.response is empty but we received streaming content
      const finalResponse = result.response || accumulatedText || undefined

      // Add assistant response to conversation history for display
      if (finalResponse) {
        conversationHistory.push({
          role: "assistant",
          content: finalResponse,
          timestamp: Date.now(),
        })
      }

      // Emit completion with final accumulated text
      await emitProgress([
        {
          id: generateStepId("acp-complete"),
          type: "completion",
          title: result.success ? "Response complete" : "Request failed",
          description: result.error,
          status: result.success ? "completed" : "error",
          timestamp: Date.now(),
          llmContent: finalResponse,
        },
      ], true, finalResponse, {
        text: finalResponse || "",
        isStreaming: false,
      })

      logApp(`[ACP Main] Completed - success: ${result.success}, response length: ${finalResponse?.length || 0}`)

      return {
        success: result.success,
        response: finalResponse,
        acpSessionId,
        stopReason: result.stopReason,
        error: result.error,
      }
    } finally {
      acpService.off("sessionUpdate", progressHandler)
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logApp(`[ACP Main] Error: ${errorMessage}`)

    await emitProgress([
      {
        id: generateStepId("acp-error"),
        type: "completion",
        title: "Error",
        description: errorMessage,
        status: "error",
        timestamp: Date.now(),
      },
    ], true, undefined, {
      text: accumulatedText,
      isStreaming: false,
    })

    return {
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Start a new session for a conversation, discarding previous context.
 */
export function startNewACPSession(conversationId: string): void {
  clearSessionForConversation(conversationId)
  logApp(`[ACP Main] Cleared session for conversation ${conversationId}`)
}

