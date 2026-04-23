import type { Project, ProjectListResponse } from '../features/editor/types'

const API_BASE = '/api'

export class ApiError extends Error {
  status: number
  code?: string

  constructor(status: number, message: string, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  const data = await res.json()
  if (!res.ok) {
    const body = data as { error?: string; code?: string }
    throw new ApiError(res.status, body.error ?? 'エラーが発生しました', body.code)
  }
  return data as T
}

export function fetchProjects(): Promise<ProjectListResponse> {
  return apiFetch<ProjectListResponse>('/projects')
}

export function createProject(name: string): Promise<{ project: Project }> {
  return apiFetch<{ project: Project }>('/projects', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export function renameProject(id: string, name: string): Promise<{ project: Project }> {
  return apiFetch<{ project: Project }>(`/projects/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  })
}

export function deleteProject(id: string): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/projects/${id}`, {
    method: 'DELETE',
  })
}

export function moveFlowToProject(
  flowId: string,
  projectId: string | null,
): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/flows/${flowId}/move`, {
    method: 'PUT',
    body: JSON.stringify({ projectId }),
  })
}
