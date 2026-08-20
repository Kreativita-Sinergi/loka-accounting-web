import { api } from './client'

/** Opens a printable document. PDF and HTML both render in a new tab. */
export async function openDocumentPrint(id: string, format: 'pdf' | 'html') {
  const response = await api.get(`/documents/${id}/print/${format}`, { responseType: 'blob' })
  const type = format === 'pdf' ? 'application/pdf' : 'text/html'
  const url = URL.createObjectURL(new Blob([response.data as BlobPart], { type }))
  const opened = window.open(url, '_blank', 'noopener')
  if (!opened) {
    // Popup blocked: fall back to a direct download so the operator still gets the file.
    const link = document.createElement('a')
    link.href = url
    link.download = `dokumen.${format}`
    link.click()
  }
  // Give the new tab time to load before releasing the object URL.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
