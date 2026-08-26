import { describe, expect, it } from 'vitest'
import { permissionMatches } from './rbac'

describe('pencocokan wewenang peran', () => {
  it('super admin memakai wildcard akuntansi', () => {
    expect(permissionMatches(['accounting.*'], 'accounting.settings.manage')).toBe(true)
  })

  it('prefiks berakhiran titik mencakup seluruh turunannya', () => {
    expect(permissionMatches(['accounting.bank.'], 'accounting.bank.manage')).toBe(true)
    expect(permissionMatches(['accounting.bank.'], 'accounting.coa.manage')).toBe(false)
  })

  it('wewenang persis hanya cocok dengan dirinya sendiri', () => {
    expect(permissionMatches(['accounting.reports.view'], 'accounting.reports.view')).toBe(true)
    expect(permissionMatches(['accounting.reports.view'], 'accounting.reports.export')).toBe(false)
  })
})
