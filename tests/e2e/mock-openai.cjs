/* Mock OpenAI-compatible server for AI Assistant E2E (port 3999).
   Turn 1 (no tool result yet): request a site__overview tool call.
   Turn 2 (tool result present): answer with the real postCount. */
const http = require('http')

let toolCallCount = 0

const server = http.createServer((req, res) => {
  if (req.method !== 'POST' || !req.url.includes('/chat/completions')) {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'not found' }))
    return
  }
  let body = ''
  req.on('data', (c) => {
    body += c
  })
  req.on('end', () => {
    const parsed = JSON.parse(body)
    const hasToolResult = (parsed.messages || []).some(m => m.role === 'tool')
    res.writeHead(200, { 'Content-Type': 'application/json' })

    if (!hasToolResult) {
      toolCallCount++
      const userMsg = (parsed.messages || []).filter(m => m.role === 'user').pop()
      console.log(`[mock] user content bytes: ${JSON.stringify(userMsg?.content ?? null)}`)
      const wantsList = (userMsg?.content || '').includes('列出')
      const fnName = wantsList ? 'content__posts__list' : 'site__overview'
      console.log(`[mock] turn ${toolCallCount}: emitting ${fnName} tool call`)
      res.end(JSON.stringify({
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        model: parsed.model,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [{
              id: `call_${toolCallCount}`,
              type: 'function',
              function: { name: fnName, arguments: '{}' }
            }]
          },
          finish_reason: 'tool_calls'
        }],
        usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 }
      }))
      return
    }

    const toolMsg = (parsed.messages || []).filter(m => m.role === 'tool').pop()
    let summary = ''
    try {
      const data = JSON.parse(toolMsg.content)
      summary = Array.isArray(data)
        ? `站点最新文章：${data.map(p => p.title).join('、')}。`
        : `站点当前共有 ${data.postCount} 篇已发布文章。`
    } catch { /* malformed tool result — answer with empty summary */ }
    console.log(`[mock] final answer: ${summary}`)
    res.end(JSON.stringify({
      id: `chatcmpl-${Date.now()}-final`,
      object: 'chat.completion',
      model: parsed.model,
      choices: [{
        index: 0,
        message: { role: 'assistant', content: summary, tool_calls: undefined },
        finish_reason: 'stop'
      }],
      usage: { prompt_tokens: 300, completion_tokens: 30, total_tokens: 330 }
    }))
  })
})

server.listen(3999, () => console.log('[mock] openai-compatible server on :3999'))
