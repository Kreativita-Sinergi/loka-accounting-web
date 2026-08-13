import axios from 'axios'

export const api = axios.create({
  baseURL:
    import.meta.env.VITE_ACCOUNTING_API_BASE_URL ??
    'http://localhost:8085/api/v1/accounting',
  timeout: 15_000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('accounting_profile')
      window.dispatchEvent(new Event('loka:unauthorized'))
    }
    return Promise.reject(error)
  },
)
