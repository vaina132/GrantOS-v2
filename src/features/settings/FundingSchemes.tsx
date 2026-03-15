import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { settingsService } from '@/services/settingsService'
import { useAuthStore } from '@/stores/authStore'
import { ConfirmModal } from '@/components/common/ConfirmModal'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from '@/components/ui/use-toast'
import { Plus, Pencil, Trash2, Layers, Download, Loader2 } from 'lucide-react'
import type { FundingScheme } from '@/types'

const FUNDING_PRESETS: { name: string; type: string; overhead_rate: number }[] = [
  { name: 'Horizon Europe — RIA', type: 'EU Framework Programme', overhead_rate: 25 },
  { name: 'Horizon Europe — IA', type: 'EU Framework Programme', overhead_rate: 25 },
  { name: 'Horizon Europe — CSA', type: 'EU Framework Programme', overhead_rate: 25 },
  { name: 'ERC Starting Grant', type: 'EU ERC', overhead_rate: 25 },
  { name: 'ERC Consolidator Grant', type: 'EU ERC', overhead_rate: 25 },
  { name: 'ERC Advanced Grant', type: 'EU ERC', overhead_rate: 25 },
  { name: 'ERC Proof of Concept', type: 'EU ERC', overhead_rate: 25 },
  { name: 'MSCA Doctoral Networks', type: 'EU Marie Sk\u0142odowska-Curie', overhead_rate: 25 },
  { name: 'MSCA Postdoctoral Fellowships', type: 'EU Marie Sk\u0142odowska-Curie', overhead_rate: 25 },
  { name: 'MSCA Staff Exchanges', type: 'EU Marie Sk\u0142odowska-Curie', overhead_rate: 25 },
  { name: 'EIT KIC', type: 'EU EIT', overhead_rate: 25 },
  { name: 'Digital Europe Programme', type: 'EU Programme', overhead_rate: 7 },
  { name: 'Erasmus+ KA2', type: 'EU Education', overhead_rate: 7 },
  { name: 'Creative Europe', type: 'EU Programme', overhead_rate: 7 },
  { name: 'LIFE Programme', type: 'EU Programme', overhead_rate: 7 },
  { name: 'Interreg', type: 'EU Territorial Cooperation', overhead_rate: 15 },
  { name: 'COST Action', type: 'EU Networking', overhead_rate: 25 },
  { name: 'Eurostars', type: 'Eureka', overhead_rate: 0 },
  { name: 'National Grant', type: 'National', overhead_rate: 0 },
  { name: 'Industry Contract', type: 'Private', overhead_rate: 0 },
  { name: 'Internal / Self-funded', type: 'Internal', overhead_rate: 0 },
]

export function FundingSchemes() {
  const { t } = useTranslation()
  const { orgId } = useAuthStore()
  const [schemes, setSchemes] = useState<FundingScheme[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<FundingScheme | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<FundingScheme | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [type, setType] = useState('')
  const [overheadRate, setOverheadRate] = useState('')
  const [loadingPresets, setLoadingPresets] = useState(false)

  const handleLoadPresets = async () => {
    if (!orgId) return
    setLoadingPresets(true)
    try {
      const existingNames = new Set(schemes.map(s => s.name.toLowerCase()))
      const toCreate = FUNDING_PRESETS.filter(p => !existingNames.has(p.name.toLowerCase()))
      if (toCreate.length === 0) {
        toast({ title: t('settings.presetsExist') })
        setLoadingPresets(false)
        return
      }
      for (const preset of toCreate) {
        await settingsService.createFundingScheme({
          org_id: orgId,
          name: preset.name,
          type: preset.type,
          overhead_rate: preset.overhead_rate,
        })
      }
      toast({ title: t('settings.presetsLoaded'), description: `${toCreate.length} ${t('settings.schemesAdded')}` })
      fetch()
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.failedToSave')
      toast({ title: t('common.error'), description: message, variant: 'destructive' })
    } finally {
      setLoadingPresets(false)
    }
  }

  const fetch = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await settingsService.listFundingSchemes(orgId)
      setSchemes(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.failedToSave')
      toast({ title: t('common.error'), description: message, variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    fetch()
  }, [fetch])

  const openCreate = () => {
    setEditTarget(null)
    setName('')
    setType('')
    setOverheadRate('')
    setDialogOpen(true)
  }

  const openEdit = (scheme: FundingScheme) => {
    setEditTarget(scheme)
    setName(scheme.name)
    setType(scheme.type)
    setOverheadRate(String(scheme.overhead_rate))
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      if (editTarget) {
        await settingsService.updateFundingScheme(editTarget.id, {
          name: name.trim(),
          type: type.trim(),
          overhead_rate: Number(overheadRate) || 0,
        })
        toast({ title: t('common.updated'), description: t('common.hasBeenUpdated', { name }) })
      } else {
        await settingsService.createFundingScheme({
          org_id: orgId ?? '',
          name: name.trim(),
          type: type.trim(),
          overhead_rate: Number(overheadRate) || 0,
        })
        toast({ title: t('common.created'), description: t('common.hasBeenCreated', { name }) })
      }
      setDialogOpen(false)
      fetch()
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.failedToSave')
      toast({ title: t('common.error'), description: message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await settingsService.removeFundingScheme(deleteTarget.id)
      toast({ title: t('common.deleted'), description: t('common.hasBeenRemoved', { name: deleteTarget.name }) })
      setDeleteTarget(null)
      fetch()
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.failedToDelete')
      toast({ title: t('common.error'), description: message, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t('settings.fundingSchemes')}</CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleLoadPresets} disabled={loadingPresets}>
            {loadingPresets ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            {loadingPresets ? t('common.loading') : t('settings.loadPresets')}
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> {t('settings.addScheme')}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : schemes.length === 0 ? (
          <EmptyState
            icon={Layers}
            title={t('settings.noSchemes')}
            description={t('settings.noSchemesDesc')}
          />
        ) : (
          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium">{t('common.name')}</th>
                  <th className="px-4 py-2 text-left font-medium">{t('common.type')}</th>
                  <th className="px-4 py-2 text-right font-medium">{t('settings.overheadPercent')}</th>
                  <th className="px-4 py-2 text-right font-medium">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {schemes.map((scheme) => (
                  <tr key={scheme.id} className="border-b last:border-0">
                    <td className="px-4 py-2 font-medium">{scheme.name}</td>
                    <td className="px-4 py-2 text-muted-foreground">{scheme.type || '—'}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{scheme.overhead_rate}%</td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(scheme)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(scheme)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTarget ? t('settings.editScheme') : t('settings.newScheme')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="scheme-name">{t('common.name')} *</Label>
              <Input
                id="scheme-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Horizon Europe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scheme-type">{t('common.type')}</Label>
              <Input
                id="scheme-type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                placeholder="e.g. EU Framework Programme"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scheme-overhead">{t('settings.defaultOverheadRate')}</Label>
              <Input
                id="scheme-overhead"
                type="number"
                step="0.01"
                value={overheadRate}
                onChange={(e) => setOverheadRate(e.target.value)}
                placeholder="25"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? t('common.saving') : editTarget ? t('common.update') : t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t('settings.deleteScheme')}
        message={t('settings.deleteSchemeConfirm', { name: deleteTarget?.name ?? '' })}
        confirmLabel={t('common.delete')}
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />
    </Card>
  )
}
