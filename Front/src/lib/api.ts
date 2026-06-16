export type ApiSession = {
  apiBaseUrl?: string
  apiUrl?: string
  userId?: string
}

export type ApiPayload<T = any> = {
  ok?: boolean
  data?: T
  error?: string
  detail?: string
  message?: string
  [key: string]: any
}

export const DEFAULT_API_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "https://panaderia-backend-vrfl.onrender.com"

const REQUEST_TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_API_TIMEOUT_MS || 15000)

export class ApiError extends Error {
  status: number
  payload?: unknown

  constructor(message: string, status: number, payload?: unknown) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.payload = payload
  }
}

export function normalizeApiUrl(value: string) {
  return value.trim().replace(/\/+$/, "")
}

function baseUrl(session: ApiSession) {
  return normalizeApiUrl(session.apiBaseUrl || session.apiUrl || DEFAULT_API_URL)
}

function headersFor(session: ApiSession, hasBody = false): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/json"
  }

  if (hasBody) headers["Content-Type"] = "application/json"
  if (session.userId) headers["X-User-Id"] = session.userId

  return headers
}

export function buildQuery(params: Record<string, unknown>) {
  const qs = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue
    qs.set(key, String(value))
  }

  const text = qs.toString()
  return text ? `?${text}` : ""
}

async function request<T = any>(session: ApiSession, path: string, init: RequestInit = {}): Promise<T> {
  const body = init.body
  const controller = new AbortController()
  const timeout = globalThis.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const res = await fetch(`${baseUrl(session)}${path}`, {
      ...init,
      headers: {
        ...headersFor(session, body !== undefined),
        ...(init.headers || {})
      },
      signal: controller.signal,
      cache: "no-store"
    })

    const text = await res.text()
    let payload: any = null

    if (text) {
      try {
        payload = JSON.parse(text)
      } catch {
        payload = text
      }
    }

    if (!res.ok) {
      const msg =
        payload?.detail ||
        payload?.error ||
        payload?.message ||
        (typeof payload === "string" ? payload : "") ||
        `Error HTTP ${res.status}`

      throw new ApiError(String(msg), res.status, payload)
    }

    if (payload?.ok === false) {
      throw new ApiError(String(payload.error || payload.detail || "Error del backend"), res.status, payload)
    }

    return payload as T
  } catch (exc: any) {
    if (exc?.name === "AbortError") {
      throw new ApiError("No hubo respuesta del servidor. Revisá la conexión o reintentá en unos segundos.", 408)
    }

    throw exc
  } finally {
    globalThis.clearTimeout(timeout)
  }
}

export function apiGet<T = any>(session: ApiSession, path: string) {
  return request<T>(session, path)
}

export function apiPost<T = any>(session: ApiSession, path: string, payload?: unknown) {
  return request<T>(session, path, {
    method: "POST",
    body: JSON.stringify(payload ?? {})
  })
}

export function apiPatch<T = any>(session: ApiSession, path: string, payload?: unknown) {
  return request<T>(session, path, {
    method: "PATCH",
    body: JSON.stringify(payload ?? {})
  })
}

export function apiDelete<T = any>(session: ApiSession, path: string) {
  return request<T>(session, path, {
    method: "DELETE"
  })
}

export function unwrapData<T>(payload: ApiPayload<T> | T): T {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as ApiPayload<T>).data as T
  }

  return payload as T
}

export function getDefaultSession(): ApiSession {
  return {
    apiBaseUrl: normalizeApiUrl(DEFAULT_API_URL),
    apiUrl: normalizeApiUrl(DEFAULT_API_URL)
  }
}

export function getRows(
  session: ApiSession,
  table: string,
  params?: {
    q?: string
    limit?: number
    offset?: number
    includeInactive?: boolean
    orderBy?: string
    desc?: boolean
  }
) {
  const query = buildQuery({
    q: params?.q,
    limit: params?.limit ?? 200,
    offset: params?.offset ?? 0,
    include_inactive: params?.includeInactive,
    order_by: params?.orderBy,
    desc: params?.desc
  })

  return apiGet<ApiPayload<any[]>>(session, `/api/admin/crud/${table}${query}`).then(unwrapData<any[]>)
}

export function createRow(session: ApiSession, table: string, payload: Record<string, unknown>) {
  return apiPost<ApiPayload<Record<string, unknown>>>(session, `/api/admin/crud/${table}`, payload).then(
    unwrapData<Record<string, unknown>>
  )
}

export function updateRow(session: ApiSession, table: string, rowId: string, payload: Record<string, unknown>) {
  return apiPatch<ApiPayload<Record<string, unknown>>>(
    session,
    `/api/admin/crud/${table}/${encodeURIComponent(rowId)}`,
    payload
  ).then(unwrapData<Record<string, unknown>>)
}

export function deleteRow(session: ApiSession, table: string, rowId: string, hard = false) {
  return apiDelete<ApiPayload<{ message?: string }>>(
    session,
    `/api/admin/crud/${table}/${encodeURIComponent(rowId)}?hard=${String(hard)}`
  ).then(unwrapData<{ message?: string }>)
}
