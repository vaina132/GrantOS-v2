import { cn } from '@/lib/utils'

interface PersonAvatarProps {
  name: string
  avatarUrl?: string | null
  size?: 'xs' | 'sm' | 'md'
  className?: string
}

const SIZE_MAP = {
  xs: 'h-5 w-5 text-[9px]',
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-8 w-8 text-xs',
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

// Consistent color from name string
function getColor(name: string): string {
  const colors = [
    'bg-blue-100 text-blue-700',
    'bg-emerald-100 text-emerald-700',
    'bg-amber-100 text-amber-700',
    'bg-purple-100 text-purple-700',
    'bg-rose-100 text-rose-700',
    'bg-cyan-100 text-cyan-700',
    'bg-orange-100 text-orange-700',
    'bg-indigo-100 text-indigo-700',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

export function PersonAvatar({ name, avatarUrl, size = 'sm', className }: PersonAvatarProps) {
  const sizeClass = SIZE_MAP[size]

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={cn('rounded-full object-cover shrink-0', sizeClass, className)}
      />
    )
  }

  return (
    <div
      className={cn(
        'rounded-full shrink-0 flex items-center justify-center font-medium select-none',
        sizeClass,
        getColor(name),
        className,
      )}
      title={name}
    >
      {getInitials(name)}
    </div>
  )
}
