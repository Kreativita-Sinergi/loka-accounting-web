import { api } from './client'
import type { ApiEnvelope } from '../types/accounting'
import type { Project, ProjectProfitabilityReport } from '../types/reports'

const data = async <T>(request: Promise<{ data: ApiEnvelope<T> }>) => (await request).data.data

export type ProjectInput = {
  code: string
  name: string
  contact_id?: string | null
  start_date?: string
  end_date?: string
  contract_value?: string
  budget_cost?: string
  status?: string
  notes?: string
}

export const listProjects = (status = '') => data<Project[]>(api.get('/projects', { params: status ? { status } : undefined }))
export const getProject = (id: string) => data<Project>(api.get(`/projects/${id}`))
export const createProject = (input: ProjectInput) => data<Project>(api.post('/projects', input))
export const updateProject = (id: string, input: ProjectInput) => data<Project>(api.put(`/projects/${id}`, input))
export const getProjectProfitability = (filters: { project_id?: string; start_date?: string; end_date?: string }) =>
  data<ProjectProfitabilityReport>(api.get('/reports/projects/profitability', {
    params: Object.fromEntries(Object.entries(filters).filter(([, value]) => value)),
  }))
