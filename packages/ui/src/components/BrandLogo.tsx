interface BrandLogoProps {
  showWordmark?: boolean
  className?: string
  markClassName?: string
}

interface BrandMarkProps {
  decorative: boolean
  className: string
}

function BrandMark({ decorative, className }: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : 'CodeOmniVis'}
      aria-hidden={decorative ? true : undefined}
      className={`shrink-0 ${className}`}
    >
      <path
        d="M48 15A22 22 0 1 0 48 49"
        stroke="currentColor"
        strokeWidth="5.5"
        strokeLinecap="round"
      />
      <circle cx="33" cy="32" r="11" stroke="#6F83FF" strokeWidth="3.5" />
      <path
        d="M26 26.5L33 38L40 26.5"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
    </svg>
  )
}

export function BrandLogo({
  showWordmark = false,
  className = '',
  markClassName = 'h-6 w-6',
}: BrandLogoProps) {
  if (!showWordmark) {
    return (
      <span className={`inline-flex ${className}`.trim()}>
        <BrandMark decorative={false} className={markClassName} />
      </span>
    )
  }

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`.trim()}>
      <BrandMark decorative className={markClassName} />
      <span data-brand-wordmark="true" className="font-[650] tracking-[-0.025em] text-content">
        Code<span className="text-[#6F83FF]">O</span>mniVis
      </span>
    </span>
  )
}
