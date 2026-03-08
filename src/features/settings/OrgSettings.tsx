import { useState, useEffect } from 'react'
import { settingsService } from '@/services/settingsService'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import { Save, Download } from 'lucide-react'
import { exportService } from '@/services/exportService'

export function OrgSettings() {
  const { orgId } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('EUR')
  const [workingHoursPerDay, setWorkingHoursPerDay] = useState('8')
  const [workingDaysPerYear, setWorkingDaysPerYear] = useState('220')
  const [defaultOverheadRate, setDefaultOverheadRate] = useState('25')
  const [departments, setDepartments] = useState('')

  useEffect(() => {
    if (!orgId) return
    setLoading(true)
    settingsService.getOrganisation(orgId).then((org) => {
      if (org) {
        setName(org.name ?? '')
        setCurrency(org.currency ?? 'EUR')
        setWorkingHoursPerDay(String(org.working_hours_per_day ?? 8))
        setWorkingDaysPerYear(String(org.working_days_per_year ?? 220))
        setDefaultOverheadRate(String(org.default_overhead_rate ?? 25))
        setDepartments((org.departments ?? []).join(', '))
      }
    }).catch(() => {}).finally(() => setLoading(false))
  }, [orgId])

  const handleSave = async () => {
    if (!orgId) return
    setSaving(true)
    try {
      await settingsService.updateOrganisation(orgId, {
        name,
        currency,
        working_hours_per_day: Number(workingHoursPerDay),
        working_days_per_year: Number(workingDaysPerYear),
        default_overhead_rate: Number(defaultOverheadRate),
        departments: departments.split(',').map((d) => d.trim()).filter(Boolean),
      })
      toast({ title: 'Saved', description: 'Organisation settings updated.' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Skeleton className="h-64 w-full" />

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Organisation Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Organisation Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Currency</Label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="EUR">EUR (€)</option>
              <option value="USD">USD ($)</option>
              <option value="GBP">GBP (£)</option>
              <option value="CHF">CHF</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Working Hours / Day</Label>
            <Input type="number" value={workingHoursPerDay} onChange={(e) => setWorkingHoursPerDay(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Working Days / Year</Label>
            <Input type="number" value={workingDaysPerYear} onChange={(e) => setWorkingDaysPerYear(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Default Overhead Rate (%)</Label>
            <Input type="number" value={defaultOverheadRate} onChange={(e) => setDefaultOverheadRate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Departments (comma-separated)</Label>
            <Input value={departments} onChange={(e) => setDepartments(e.target.value)} placeholder="e.g. CS, EE, Physics" />
          </div>
        </div>
        <div className="flex justify-between">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={exporting || !orgId}
              onClick={async () => {
                if (!orgId) return
                setExporting(true)
                try {
                  await exportService.exportOrganisation(orgId, 'json')
                  toast({ title: 'Export complete', description: 'JSON file downloaded.' })
                } catch (_e) { toast({ title: 'Export failed', variant: 'destructive' }) }
                finally { setExporting(false) }
              }}
            >
              <Download className="mr-1 h-4 w-4" />
              {exporting ? 'Exporting...' : 'Export JSON'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={exporting || !orgId}
              onClick={async () => {
                if (!orgId) return
                setExporting(true)
                try {
                  await exportService.exportOrganisation(orgId, 'csv')
                  toast({ title: 'Export complete', description: 'CSV file downloaded.' })
                } catch (_e) { toast({ title: 'Export failed', variant: 'destructive' }) }
                finally { setExporting(false) }
              }}
            >
              <Download className="mr-1 h-4 w-4" />
              Export CSV
            </Button>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-1 h-4 w-4" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
