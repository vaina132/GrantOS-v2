import { useState } from 'react'
import { reportService, REPORT_TYPES, type ReportType } from '@/services/reportService'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { YearSelector } from '@/components/common/YearSelector'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/components/ui/use-toast'
import { FileSpreadsheet, FileText } from 'lucide-react'

export function ReportsList() {
  const { orgId } = useAuthStore()
  const { globalYear } = useUiStore()
  const [generating, setGenerating] = useState<string | null>(null)

  const handleExport = async (type: ReportType, format: 'excel' | 'pdf') => {
    if (!orgId) return
    setGenerating(`${type}-${format}`)
    try {
      if (format === 'excel') {
        await reportService.generateExcel(orgId, globalYear, type)
      } else {
        await reportService.generatePdf(orgId, globalYear, type)
      }
      toast({ title: 'Report generated', description: `${REPORT_TYPES[type].label} exported as ${format.toUpperCase()}.` })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate report'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setGenerating(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description={`Generate and export reports for ${globalYear}`}
        actions={<YearSelector />}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(Object.entries(REPORT_TYPES) as [ReportType, typeof REPORT_TYPES[ReportType]][]).map(
          ([type, config]) => (
            <Card key={type}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{config.label}</CardTitle>
                <CardDescription className="text-xs">{config.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleExport(type, 'excel')}
                    disabled={generating === `${type}-excel`}
                  >
                    <FileSpreadsheet className="mr-1 h-4 w-4" />
                    {generating === `${type}-excel` ? 'Generating...' : 'Excel'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleExport(type, 'pdf')}
                    disabled={generating === `${type}-pdf`}
                  >
                    <FileText className="mr-1 h-4 w-4" />
                    {generating === `${type}-pdf` ? 'Generating...' : 'PDF'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ),
        )}
      </div>
    </div>
  )
}
