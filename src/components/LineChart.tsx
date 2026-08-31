interface LineChartProps {
  data: number[];
  max: number;
  width?: number;
  height?: number;
  color: string;
  suffix?: string;
  currentValue?: string;
  label?: string;
}

function LineChart({
  data,
  max,
  width = 320,
  height = 96,
  color,
  label,
  currentValue,
}: LineChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[96px] items-center justify-center text-sm text-neutral-600">
        No data yet
      </div>
    );
  }

  const top = 4;
  const bottom = height - 4;
  const range = max > 0 ? max : 1;
  const step = width / (data.length - 1 || 1);

  const points = data.map((v, i) => {
    const x = i * step;
    const y = bottom - (v / range) * (bottom - top);
    return [x, y] as const;
  });

  const linePath = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");

  const areaPath = `${linePath} L${points[points.length - 1][0].toFixed(
    1,
  )},${bottom} L0,${bottom} Z`;

  const gradId = `grad-${color.replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-xs text-neutral-500">{label}</span>
        {currentValue && (
          <span className="font-mono text-sm text-neutral-200">{currentValue}</span>
        )}
      </div>
      <svg
        width="100%"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="block"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.45" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradId})`} />
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

export default LineChart;
