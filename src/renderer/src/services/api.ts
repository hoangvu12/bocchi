// Base API service with common error handling
export class ApiError extends Error {
  constructor(
    message: string,
    public code?: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function handleApiResponse<T>(
  promise: Promise<{ success: boolean; data?: T; error?: string; message?: string }>
): Promise<T> {
  const result = await promise

  if (!result.success) {
    throw new ApiError(result.error || result.message || 'Unknown error')
  }

  return result.data as T
}
