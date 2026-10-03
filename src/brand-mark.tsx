import './brand-mark.css'

type BrandMarkProps = {
  surface?: 'light' | 'dark'
  compact?: boolean
  className?: string
  imageClassName?: string
}

export function BrandMark({
  surface = 'light',
  compact = false,
  className = '',
  imageClassName = '',
}: BrandMarkProps) {
  return (
    <span
      className={`tf-brand ${compact ? 'tf-brand--compact' : ''} ${className}`.trim()}
      data-surface={surface}
      role="img"
      aria-label="TriFaros"
    >
      <img
        className={`tf-brand__image ${imageClassName}`.trim()}
        src="/brand/trifaros-logo-horizontal.png"
        alt=""
        aria-hidden="true"
        width={2048}
        height={682}
      />
    </span>
  )
}
