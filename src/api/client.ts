import axios from 'axios'
import { ApiError } from './errors'

interface ApiErrorResponse {
  status: number
  message: string
}

const apiClient = axios.create({
  baseURL: '/api',
})

export async function get<T>(
  url: string,
  params?: Record<string, string | number | undefined>,
): Promise<T> {
  try {
    const response = await apiClient.get<T>(url, { params })
    return response.data
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const apiError = error.response?.data as ApiErrorResponse | undefined

      throw new ApiError(
        apiError?.status ?? error.response?.status ?? 0,
        apiError?.message ?? error.message,
      )
    }

    throw error
  }
}