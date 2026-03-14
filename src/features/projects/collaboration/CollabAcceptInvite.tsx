import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { CheckCircle, XCircle, Loader2, Globe } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface PartnerInfo {
  id: string
  org_name: string
  invite_status: string
  role: string
  participant_number: number | null
  collab_projects: {
    id: string
    acronym: string
    title: string
    host_org_id: string
    organisations: { name: string } | null
  }
}

export function CollabAcceptInvite() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const token = searchParams.get('token')

  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [partner, setPartner] = useState<PartnerInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [accepted, setAccepted] = useState(false)

  useEffect(() => {
    if (!token) {
      setError('No invitation token provided')
      setLoading(false)
      return
    }
    lookupInvite()
  }, [token])

  const lookupInvite = async () => {
    try {
      const res = await fetch('/api/collab-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'lookup', token }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error || 'Invitation not found')
        return
      }
      setPartner(data.partner)
      if (data.partner.invite_status === 'accepted') {
        setAccepted(true)
      }
    } catch {
      setError('Failed to load invitation details')
    } finally {
      setLoading(false)
    }
  }

  const handleAccept = async () => {
    if (!token) return
    setAccepting(true)
    try {
      const res = await fetch('/api/collab-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept', token, userId: user?.id }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to accept invitation')
        return
      }
      setAccepted(true)
    } catch {
      setError('Failed to accept invitation')
    } finally {
      setAccepting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center py-12 text-center">
            <XCircle className="h-12 w-12 text-destructive mb-4" />
            <h2 className="text-lg font-semibold mb-2">Invitation Error</h2>
            <p className="text-sm text-muted-foreground mb-6">{error}</p>
            <Button variant="outline" onClick={() => navigate('/')}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (accepted) {
    const project = partner?.collab_projects
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center py-12 text-center">
            <CheckCircle className="h-12 w-12 text-emerald-500 mb-4" />
            <h2 className="text-lg font-semibold mb-2">Invitation Accepted!</h2>
            <p className="text-sm text-muted-foreground mb-1">
              <strong>{partner?.org_name}</strong> is now part of <strong>{project?.acronym}</strong>.
            </p>
            <p className="text-xs text-muted-foreground mb-6">
              {project?.title}
            </p>
            {user ? (
              <Button onClick={() => navigate(`/projects/collaboration/${project?.id}`)}>
                Go to Project
              </Button>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Sign in to access the project on GrantLume.</p>
                <Button onClick={() => navigate('/login')}>Sign In</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  const project = partner?.collab_projects
  const hostOrg = project?.organisations?.name ?? 'the coordinating organisation'

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-lg w-full">
        <CardContent className="py-10 px-8">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Globe className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-xl font-semibold mb-1">Collaboration Invitation</h2>
            <p className="text-sm text-muted-foreground">
              You've been invited to join a research project
            </p>
          </div>

          <div className="space-y-3 text-sm mb-8">
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Project</span>
              <span className="font-medium">{project?.acronym}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Full Title</span>
              <span className="font-medium text-right max-w-[60%]">{project?.title}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Your Organisation</span>
              <span className="font-medium">{partner?.org_name}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Your Role</span>
              <span className="font-medium">{partner?.role === 'coordinator' ? 'Coordinator' : 'Partner'}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Coordinator</span>
              <span className="font-medium">{hostOrg}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => navigate('/')}>
              Decline
            </Button>
            <Button className="flex-1" onClick={handleAccept} disabled={accepting}>
              {accepting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Accept Invitation
            </Button>
          </div>

          {!user && (
            <p className="text-xs text-muted-foreground text-center mt-4">
              You don't need an account to accept. If you have one, <a href="/login" className="underline">sign in first</a> to link this project to your account.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
