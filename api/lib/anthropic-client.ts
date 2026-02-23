// =============================================
// Lightweight Anthropic API client for Cloudflare Workers
// Uses native fetch instead of @anthropic-ai/sdk to avoid
// potential Node.js compatibility issues in Workers runtime
// =============================================

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'

interface Tool {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

interface MessageRequest {
  model: string
  max_tokens: number
  system?: string
  tools?: Tool[]
  tool_choice?: { type: string; name: string }
  messages: Array<{ role: string; content: string }>
}

interface ContentBlock {
  type: string
  input?: unknown
}

interface MessageResponse {
  content: ContentBlock[]
}

export async function createMessage(
  apiKey: string,
  request: MessageRequest,
): Promise<MessageResponse> {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Anthropic API error ${response.status}: ${errorBody}`)
  }

  return (await response.json()) as MessageResponse
}
