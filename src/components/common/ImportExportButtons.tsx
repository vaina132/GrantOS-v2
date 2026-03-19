import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Upload, Download, FileSpreadsheet, FileText, Sparkles, ChevronDown } from 'lucide-react'

interface ImportExportButtonsProps {
  onImportFile: () => void
  onImportAI: () => void
  onExportExcel: () => void
  onExportPDF: () => void
  hasData: boolean
}

export function ImportExportButtons({
  onImportFile,
  onImportAI,
  onExportExcel,
  onExportPDF,
  hasData,
}: ImportExportButtonsProps) {
  const { t } = useTranslation()
  const { aiEnabled } = useAuthStore()

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Upload className="h-4 w-4" />
            {t('common.import')}
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={onImportFile} className="gap-2 cursor-pointer">
            <FileSpreadsheet className="h-4 w-4" />
            {t('import.fromFile')}
          </DropdownMenuItem>
          {aiEnabled && (
            <DropdownMenuItem onClick={onImportAI} className="gap-2 cursor-pointer">
              <Sparkles className="h-4 w-4" />
              {t('import.withAI')}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {hasData && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Download className="h-4 w-4" />
              {t('common.export')}
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onExportExcel} className="gap-2 cursor-pointer">
              <FileSpreadsheet className="h-4 w-4" />
              Excel (.xlsx)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onExportPDF} className="gap-2 cursor-pointer">
              <FileText className="h-4 w-4" />
              PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </>
  )
}
