import './brand-mark.css'

type BrandMarkProps = {
  surface?: 'light' | 'dark'
  compact?: boolean
  className?: string
  imageClassName?: string
  variant?: 'default' | 'reverse'
}

export function BrandMark({
  surface = 'light',
  compact = false,
  className = '',
  imageClassName = '',
  variant = 'default',
}: BrandMarkProps) {
  return (
    <span
      className={`tf-brand ${compact ? 'tf-brand--compact' : ''} ${className}`.trim()}
      data-surface={surface}
      data-variant={variant}
      role="img"
      aria-label="TriFaros"
    >
      <img
        className={`tf-brand__image ${imageClassName}`.trim()}
        src={variant === 'reverse'
          ? '/brand/trifaros-logo-horizontal-reverse.png'
          : '/brand/trifaros-logo-horizontal.png'}
        alt=""
        aria-hidden="true"
        width={2048}
        height={682}
      />
    </span>
  )
}
