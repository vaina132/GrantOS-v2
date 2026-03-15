/**
 * Frontend service for DocuSign timesheet signing integration.
 * Calls the /api/docusign-sign endpoint to create an envelope and get a signing URL.
 */

export const docusignService = {
  /**
   * Request signing for a submitted timesheet.
   * Returns { envelopeId, signingUrl, status } or throws.
   */
  async requestSigning(params: {
    orgId: string
    personId: string
    year: number
    month: number
    userId: string
  }): Promise<{ envelopeId: string; signingUrl: string; status: string }> {
    const res = await fetch('/api/docusign?action=sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })

    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || data.details || 'Failed to request signing')
    }
    return data
  },
}
