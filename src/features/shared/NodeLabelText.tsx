type Props = {
  label: string
  cx: number
  cy: number
  isDiamond: boolean
  defaultLabel: string
  fillDefault: string
  fillTitle: string
}

export function NodeLabelText({
  label,
  cx,
  cy,
  isDiamond,
  defaultLabel,
  fillDefault,
  fillTitle,
}: Props) {
  const lines = label.split('\n')
  const lineHeight = 1.2
  const firstDy = -((lines.length - 1) * lineHeight) / 2
  return (
    <text
      x={cx}
      y={isDiamond ? cy + 2 : cy + 6}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={isDiamond ? 12 : 13.5}
      fontWeight={isDiamond ? 600 : 500}
      fill={label === defaultLabel ? fillDefault : fillTitle}
      style={{ pointerEvents: 'none', fontFamily: 'inherit' }}
    >
      {lines.map((line, i) => (
        <tspan key={i} x={cx} dy={`${i === 0 ? firstDy : lineHeight}em`}>
          {line}
        </tspan>
      ))}
    </text>
  )
}
