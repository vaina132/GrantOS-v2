import { useState, useRef, useEffect, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

export interface ComboOption {
  label: string
  value: string
  description?: string
}

interface ComboInputProps {
  value: string
  onChange: (value: string) => void
  options?: ComboOption[]
  onSearch?: (query: string) => Promise<ComboOption[]>
  placeholder?: string
  debounceMs?: number
  loading?: boolean
  className?: string
  emptyMessage?: string
}

export function ComboInput({
  value,
  onChange,
  options: staticOptions,
  onSearch,
  placeholder,
  debounceMs = 300,
  loading: externalLoading,
  className,
  emptyMessage = 'No suggestions found',
}: ComboInputProps) {
  const [open, setOpen] = useState(false)
  const [searchResults, setSearchResults] = useState<ComboOption[]>([])
  const [searching, setSearching] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isLoading = externalLoading || searching

  // Compute visible options: static filtered + async results
  const filtered = staticOptions
    ? staticOptions.filter(
        (o) =>
          o.label.toLowerCase().includes(value.toLowerCase()) ||
          o.value.toLowerCase().includes(value.toLowerCase()) ||
          (o.description ?? '').toLowerCase().includes(value.toLowerCase()),
      )
    : []

  const allOptions = [...filtered, ...searchResults]
  // Deduplicate by value
  const seen = new Set<string>()
  const options = allOptions.filter((o) => {
    if (seen.has(o.value)) return false
    seen.add(o.value)
    return true
  })

  // Async search with debounce
  const doSearch = useCallback(
    (query: string) => {
      if (!onSearch || query.length < 2) {
        setSearchResults([])
        return
      }
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(async () => {
        setSearching(true)
        try {
          const results = await onSearch(query)
          setSearchResults(results)
        } catch {
          setSearchResults([])
        } finally {
          setSearching(false)
        }
      }, debounceMs)
    },
    [onSearch, debounceMs],
  )

  const handleInputChange = (text: string) => {
    onChange(text)
    setOpen(true)
    setHighlightIndex(-1)
    doSearch(text)
  }

  const handleSelect = (option: ComboOption) => {
    onChange(option.value)
    setOpen(false)
    setHighlightIndex(-1)
    inputRef.current?.blur()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || options.length === 0) {
      if (e.key === 'ArrowDown' && value.length > 0) {
        setOpen(true)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightIndex((i) => Math.min(i + 1, options.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightIndex((i) => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (highlightIndex >= 0 && highlightIndex < options.length) {
          handleSelect(options[highlightIndex])
        } else {
          setOpen(false)
        }
        break
      case 'Escape':
        setOpen(false)
        setHighlightIndex(-1)
        break
    }
  }

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-combo-item]')
      items[highlightIndex]?.scrollIntoView({ block: 'nearest' })
    }
  }, [highlightIndex])

  // Clean up timer
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const showDropdown = open && (options.length > 0 || isLoading || (value.length >= 2 && !isLoading))

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="relative">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (value.length > 0 || (staticOptions && staticOptions.length > 0)) setOpen(true)
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn('pr-8', className)}
          autoComplete="off"
        />
        {isLoading && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {showDropdown && (
        <div
          ref={listRef}
          className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md overflow-hidden"
        >
          <div className="max-h-[220px] overflow-y-auto py-1">
            {options.length === 0 && !isLoading && (
              <div className="px-3 py-2 text-xs text-muted-foreground">{emptyMessage}</div>
            )}
            {isLoading && options.length === 0 && (
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Searching...
              </div>
            )}
            {options.map((option, i) => (
              <div
                key={option.value + i}
                data-combo-item
                className={cn(
                  'flex flex-col cursor-pointer px-3 py-1.5 text-sm transition-colors',
                  i === highlightIndex && 'bg-primary/10',
                  option.value === value && 'bg-primary/5 font-medium',
                  'hover:bg-muted/60',
                )}
                onMouseDown={(e) => {
                  e.preventDefault()
                  handleSelect(option)
                }}
                onMouseEnter={() => setHighlightIndex(i)}
              >
                <span className="truncate">{option.label}</span>
                {option.description && (
                  <span className="text-xs text-muted-foreground truncate">{option.description}</span>
                )}
              </div>
            ))}
          </div>
          {value.length > 0 && !options.some((o) => o.value === value) && (
            <div className="border-t px-3 py-1.5 text-xs text-muted-foreground">
              Press <kbd className="rounded border px-1 py-0.5 text-[10px] font-mono">Enter</kbd> to use "{value}" as custom value
            </div>
          )}
        </div>
      )}
    </div>
  )
}
