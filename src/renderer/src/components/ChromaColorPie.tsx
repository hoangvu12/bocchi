import React from 'react'

interface ChromaColorPieProps {
  colors: string[]
  size?: number
  className?: string
}

export const ChromaColorPie: React.FC<ChromaColorPieProps> = ({
  colors,
  size = 16,
  className = ''
}) => {
  if (!colors || colors.length === 0) {
    return null
  }

  const radius = size / 2
  const center = radius
  const strokeWidth = 0

  // Special case for single color - draw a circle
  if (colors.length === 1) {
    return (
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className={className}
        style={{ borderRadius: '50%' }}
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill={colors[0]}
          stroke={strokeWidth > 0 ? '#000' : 'none'}
          strokeWidth={strokeWidth}
        />
      </svg>
    )
  }

  // Create pie segments for multiple colors
  const segments = colors.map((color, index) => {
    const startAngle = (index * 360) / colors.length
    const endAngle = ((index + 1) * 360) / colors.length

    // Convert to radians
    const startRad = (startAngle * Math.PI) / 180
    const endRad = (endAngle * Math.PI) / 180

    // Calculate arc points
    const x1 = center + radius * Math.cos(startRad)
    const y1 = center + radius * Math.sin(startRad)
    const x2 = center + radius * Math.cos(endRad)
    const y2 = center + radius * Math.sin(endRad)

    // Large arc flag (1 if angle > 180)
    const largeArc = endAngle - startAngle > 180 ? 1 : 0

    // Create path
    const path = [
      `M ${center} ${center}`,
      `L ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
      'Z'
    ].join(' ')

    return (
      <path
        key={index}
        d={path}
        fill={color}
        stroke={strokeWidth > 0 ? '#000' : 'none'}
        strokeWidth={strokeWidth}
      />
    )
  })

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      style={{ borderRadius: '50%' }}
    >
      {segments}
    </svg>
  )
}
