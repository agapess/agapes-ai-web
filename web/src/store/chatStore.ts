import { create } from 'zustand'

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

interface ChatState {
  messages: ChatMessage[]
  streaming: boolean
  streamingContent: string
  addMessage: (message: ChatMessage) => void
  setStreaming: (streaming: boolean) => void
  appendStreamingContent: (content: string) => void
  finalizeStreamingMessage: () => void
  clearMessages: () => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  streaming: false,
  streamingContent: '',
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  setStreaming: (streaming) =>
    set((state) => ({ streaming, streamingContent: streaming ? '' : state.streamingContent })),
  appendStreamingContent: (content) =>
    set((state) => ({ streamingContent: state.streamingContent + content })),
  finalizeStreamingMessage: () => {
    const { streamingContent, messages } = get()
    if (!streamingContent) {
      set({ streaming: false })
      return
    }
    set({
      messages: [
        ...messages,
        { role: 'assistant', content: streamingContent, timestamp: Date.now() },
      ],
      streamingContent: '',
      streaming: false,
    })
  },
  clearMessages: () => set({ messages: [], streamingContent: '', streaming: false }),
}))
