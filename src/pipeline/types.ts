export interface JournalEntry {
  type: 'user' | 'assistant' | string
  message: { role?: string; content: string | ContentBlock[] }
  timestamp: string
  sessionId: string
  uuid?: string
}

export interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result'
  text?: string
  content?: string | ContentBlock[]
}

export interface Message {
  role: 'user' | 'assistant'
  text: string
  isToolOutput: boolean
  timestamp: string
}

export interface Chunk {
  messages: Message[]
  userTextLen: number
  totalLen: number
  startTs: string
  endTs: string
  insightScore?: number
}

export interface InsightCard {
  slug: string
  category: 'GOTCHA' | 'PATTERN' | 'DECISION' | 'DISCOVERY'
  confidence: number
  title: string
  body: string
  tags: string[]
  sessionId: string
  extractedAt: string
}

export interface SessionMeta {
  sessionId: string
  cwd: string
  startTime: string
  endTime: string
  totalEntries: number
  totalMessages: number
  totalChunks: number
  signalChunks: number
  cardsExtracted: number
}

export interface CardIndex {
  cards: string[]
  sessions: string[]
  lastUpdated: string
}
