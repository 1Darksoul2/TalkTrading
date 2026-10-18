const sizeMap = { sm: 'w-8 h-8', md: 'w-10 h-10', lg: 'w-12 h-12', xl: 'w-16 h-16', '2xl': 'w-20 h-20' }

export default function Avatar({ src, alt = 'Avatar', size = 'md', storyRing = false, online = false, verified = false, className = '' }) {
  const sizeClass = sizeMap[size] || sizeMap.md

  const img = (
    <img
      src={src}
      alt={alt}
      className={`${sizeClass} rounded-full object-cover ${storyRing ? 'border-2 border-background' : ''} ${className}`}
      loading="lazy"
    />
  )

  return (
    <div className="relative inline-block flex-shrink-0">
      {storyRing ? (
        <div className="story-ring">{img}</div>
      ) : img}

      {online && (
        <div className="absolute -bottom-0.5 -right-0.5 bg-background rounded-full p-[2px]">
          <span className="block w-3 h-3 bg-bullish rounded-full" />
        </div>
      )}

      {verified && (
        <div className="absolute -bottom-0.5 -right-0.5 bg-surface-container-high rounded-full p-0.5 border border-primary/30">
          <span className="material-symbols-outlined text-[14px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
        </div>
      )}
    </div>
  )
}
