export interface ToolActivityItem {
  tool: string
  status: 'ok' | 'cache_hit' | 'error'
  durationMs: number
}
