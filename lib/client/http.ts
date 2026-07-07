export type ApiResponse<T> = {
  data: T
  msg: string
  successful: boolean
}

export const SERVICE_ERROR_MESSAGE = "网络或服务异常，请稍后重试"

export class BusinessError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "BusinessError"
  }
}

export function getRequestErrorMessage(error: unknown) {
  if (error instanceof BusinessError) {
    return error.message
  }
  return SERVICE_ERROR_MESSAGE
}

export async function requestApi<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    })
  } catch {
    throw new Error(SERVICE_ERROR_MESSAGE)
  }

  if (!response.ok) {
    throw new Error(SERVICE_ERROR_MESSAGE)
  }

  let payload: ApiResponse<T>
  try {
    payload = (await response.json()) as ApiResponse<T>
  } catch {
    throw new Error(SERVICE_ERROR_MESSAGE)
  }

  if (!payload.successful) {
    throw new BusinessError(payload.msg || SERVICE_ERROR_MESSAGE)
  }

  return payload.data
}
