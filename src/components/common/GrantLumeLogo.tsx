/**
 * GrantLume Logo — SVG recreation of the brand logo (checkmark + star).
 *
 * Variants:
 *  - "color"   → green/teal gradient checkmark with gold star (for light backgrounds)
 *  - "dark"    → dark navy monochrome (for dark/navy backgrounds, uses white)
 *  - "icon"    → rounded-rect dark background with white checkmark (app icon style)
 *
 * Usage:
 *  <GrantLumeLogo size={32} />                    — color logo, 32px
 *  <GrantLumeLogo variant="icon" size={40} />     — app icon, 40px
 *  <GrantLumeLogo variant="dark" size={36} />     — white mono on dark bg
 */

interface GrantLumeLogoProps {
  size?: number
  variant?: 'color' | 'dark' | 'icon'
  className?: string
}

export function GrantLumeLogo({ size = 32, variant = 'color', className }: GrantLumeLogoProps) {
  if (variant === 'icon') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        <rect width="64" height="64" rx="14" fill="#1a2744" />
        {/* Checkmark body */}
        <path
          d="M18 34 L24 28 L30 38 L46 16"
          stroke="white"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Star sparkle */}
        <path
          d="M44 14 L45 10 L46 14 L50 15 L46 16 L45 20 L44 16 L40 15 Z"
          fill="white"
        />
      </svg>
    )
  }

  if (variant === 'dark') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        {/* Checkmark body */}
        <path
          d="M8 26 L14 20 L22 32 L40 8"
          stroke="white"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Star sparkle */}
        <path
          d="M38 6 L39.2 2 L40.4 6 L44 7.2 L40.4 8.4 L39.2 12 L38 8.4 L34 7.2 Z"
          fill="white"
        />
      </svg>
    )
  }

  // Default: color variant
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="gl-check-grad" x1="8" y1="32" x2="40" y2="8" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="50%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#0d9488" />
        </linearGradient>
      </defs>
      {/* Checkmark body */}
      <path
        d="M8 26 L14 20 L22 32 L40 8"
        stroke="url(#gl-check-grad)"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Star sparkle — gold */}
      <path
        d="M38 6 L39.2 2 L40.4 6 L44 7.2 L40.4 8.4 L39.2 12 L38 8.4 L34 7.2 Z"
        fill="#f59e0b"
      />
    </svg>
  )
}

/** GrantLume logo + wordmark side-by-side */
export function GrantLumeWordmark({
  size = 28,
  variant = 'color',
  className,
  textClassName,
}: GrantLumeLogoProps & { textClassName?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      <GrantLumeLogo size={size} variant={variant} />
      <span className={textClassName ?? 'text-lg font-bold tracking-tight'}>
        <span className="text-[#1a2744] dark:text-white">Grant</span>
        <span className="text-emerald-600">Lume</span>
      </span>
    </div>
  )
}
