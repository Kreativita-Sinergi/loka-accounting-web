import { describe, expect, it } from 'vitest'
import { api } from './client'

describe('accounting API client', () => {
  it('uses the versioned accounting boundary', () => {
    expect(String(api.defaults.baseURL)).toContain('/api/v1/accounting')
  })
})
