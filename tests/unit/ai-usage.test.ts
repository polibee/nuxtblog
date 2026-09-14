import { describe, expect, it } from 'vitest'
import { estimateAiCostMicros } from '../../server/modules/ai/ai.service'

describe('AI usage cost estimation', () => {
  it('estimates known model costs in micro-dollars', () => {
    expect(estimateAiCostMicros('gpt-4o-mini', 1000, 1000)).toBe(750)
  })

  it('does not invent a price for unknown models', () => {
    expect(estimateAiCostMicros('local-llama', 1000, 1000)).toBe(0)
  })
})
