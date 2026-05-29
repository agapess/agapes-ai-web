import { create } from 'zustand'

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  /** Code that was generated for this message — stored separately so the chat can hide/show it */
  generatedCode?: string
}

/** Coarse phases shown in the building indicator */
export type BuildPhase = 'idle' | 'thinking' | 'building' | 'done'

interface ChatState {
  messages: ChatMessage[]
  streaming: boolean
  streamingContent: string
  buildPhase: BuildPhase
  addMessage: (message: ChatMessage) => void
  setStreaming: (streaming: boolean) => void
  appendStreamingContent: (content: string) => void
  finalizeStreamingMessage: (generatedCode?: string) => void
  clearMessages: () => void
  setBuildPhase: (phase: BuildPhase) => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  streaming: false,
  streamingContent: '',
  buildPhase: 'idle',
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  setStreaming: (streaming) =>
    set((state) => ({ streaming, streamingContent: streaming ? '' : state.streamingContent })),
  appendStreamingContent: (content) =>
    set((state) => ({ streamingContent: state.streamingContent + content })),
  setBuildPhase: (phase) => set({ buildPhase: phase }),
  finalizeStreamingMessage: (generatedCode?: string) => {
    const { streamingContent, messages } = get()
    if (!streamingContent) {
      set({ streaming: false, buildPhase: 'idle' })
      return
    }
    // Strip raw code blocks from the displayed message
    const displayContent = stripCodeBlocks(streamingContent).trim()
    set({
      messages: [
        ...messages,
        {
          role: 'assistant',
          content: displayContent || '✓ Done — preview updated.',
          timestamp: Date.now(),
          generatedCode,
        },
      ],
      streamingContent: '',
      streaming: false,
      buildPhase: 'idle',
    })
  },
  clearMessages: () => set({ messages: [], streamingContent: '', streaming: false, buildPhase: 'idle' }),
}))

/** Remove ```jsx ... ``` code fences from text so they don't clutter the chat */
function stripCodeBlocks(text: string): string {
  return text
    .replace(/```(?:jsx?|tsx?|javascript|typescript)[\s\S]*?```/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
