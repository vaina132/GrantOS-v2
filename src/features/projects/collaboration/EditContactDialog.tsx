import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { collabContactService } from '@/services/collabProjectService'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/use-toast'
import type { CollabContact } from '@/types'

interface Props {
  partnerId: string
  partnerName: string
  open: boolean
  onClose: () => void
  onSaved: () => void
}

interface ContactForm {
  id?: string
  name: string
  email: string
  role_note: string
}

const EMPTY: ContactForm = { name: '', email: '', role_note: '' }

export function EditContactDialog({ partnerId, partnerName, open, onClose, onSaved }: Props) {
  const [contacts, setContacts] = useState<CollabContact[]>([])
  const [form, setForm] = useState<ContactForm>({ ...EMPTY })
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await collabContactService.list(partnerId)
      setContacts(data)
    } catch {
      toast({ title: 'Error', description: 'Failed to load contacts', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      load()
      setForm({ ...EMPTY })
      setEditing(false)
    }
  }, [open, partnerId])

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) return
    setSaving(true)
    try {
      if (form.id) {
        await collabContactService.update(form.id, {
          name: form.name.trim(),
          email: form.email.trim(),
          role_note: form.role_note || null,
        })
        toast({ title: 'Updated' })
      } else {
        await collabContactService.create({
          partner_id: partnerId,
          name: form.name.trim(),
          email: form.email.trim(),
          role_note: form.role_note || null,
          notify_reminders: true,
          notify_approvals: true,
          notify_rejections: true,
        })
        toast({ title: 'Added', description: `${form.name} added as contact` })
      }
      setForm({ ...EMPTY })
      setEditing(false)
      load()
      onSaved()
    } catch {
      toast({ title: 'Error', description: 'Failed to save contact', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (c: CollabContact) => {
    if (!confirm(`Remove ${c.name}?`)) return
    try {
      await collabContactService.remove(c.id)
      toast({ title: 'Removed' })
      load()
      onSaved()
    } catch {
      toast({ title: 'Error', description: 'Failed to remove contact', variant: 'destructive' })
    }
  }

  const startEdit = (c: CollabContact) => {
    setForm({ id: c.id, name: c.name, email: c.email, role_note: c.role_note || '' })
    setEditing(true)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-background rounded-lg shadow-lg w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Contacts — {partnerName}</h2>
            <p className="text-sm text-muted-foreground">Manage contact persons for this partner</p>
          </div>

          {/* Existing contacts list */}
          {loading ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No contacts added yet</p>
          ) : (
            <div className="divide-y rounded-md border">
              {contacts.map(c => (
                <div key={c.id} className="flex items-center justify-between px-3 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.email}{c.role_note ? ` · ${c.role_note}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => startEdit(c)}>Edit</Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(c)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add / Edit form */}
          <div className="border rounded-md p-3 space-y-3 bg-muted/30">
            <p className="text-sm font-medium">{editing ? 'Edit Contact' : 'Add Contact'}</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Name *</Label>
                <Input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Full name"
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Email *</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="email@example.com"
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Role / Note</Label>
              <Input
                value={form.role_note}
                onChange={e => setForm(f => ({ ...f, role_note: e.target.value }))}
                placeholder="e.g. Financial Officer, PI"
                className="h-8 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={saving || !form.name.trim() || !form.email.trim()}>
                {saving ? 'Saving...' : editing ? 'Update' : 'Add'}
              </Button>
              {editing && (
                <Button variant="ghost" size="sm" onClick={() => { setForm({ ...EMPTY }); setEditing(false) }}>
                  Cancel
                </Button>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
