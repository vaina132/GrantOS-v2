/**
 * Frontend service for DocuSign timesheet signing integration.
 * Calls the /api/docusign-sign endpoint to create an envelope and get a signing URL.
 */

import { apiFetch } from '@/lib/apiClient'

export const docusignService = {
  /**
   * Request employee signing for a submitted timesheet (step 1 of dual flow).
   * Returns { envelopeId, signingUrl, status } or throws.
   */
  async requestSigning(params: {
    orgId: string
    personId: string
    year: number
    month: number
    userId: string
  }): Promise<{ envelopeId: string; signingUrl: string; status: string }> {
    const res = await apiFetch('/api/docusign?action=sign', {
      method: 'POST',
      body: JSON.stringify(params),
    })

    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || data.details || 'Failed to request signing')
    }
    return data
  },

  /**
   * Request approver signing for a timesheet already signed by the employee (step 2 of dual flow).
   * The approver signs second, completing the dual-signature process.
   * Returns { envelopeId, signingUrl, status } or throws.
   */
  async requestApproverSigning(params: {
    orgId: string
    personId: string
    year: number
    month: number
    approverId: string
  }): Promise<{ envelopeId: string; signingUrl: string; status: string }> {
    const res = await apiFetch('/api/docusign?action=approver-sign', {
      method: 'POST',
      body: JSON.stringify(params),
    })

    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || data.details || 'Failed to request approver signing')
    }
    return data
  },
}
