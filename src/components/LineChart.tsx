interface LineChartProps {
  data: number[];
  max: number;
  times?: Date[];
  color: string;
  currentValue?: string;
  yTickFormat?: (v: number) => string;
}

const W = 320;
const H = 120;
const PAD_LEFT = 40;
const PAD_RIGHT = 8;
const PAD_TOP = 6;
const PAD_BOTTOM = 20;

function fmtTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function LineChart({
  data,
  max,
  times,
  color,
  currentValue,
  yTickFormat,
}: LineChartProps) {
  const plotW = W - PAD_LEFT - PAD_RIGHT;
  const plotH = H - PAD_TOP - PAD_BOTTOM;

  if (data.length === 0) {
    return (
      <div style={{ height: H }} className="flex items-center justify-center text-xs text-neutral-600">
        No data yet
      </div>
    );
  }

  const range = max > 0 ? max : 1;
  const step = plotW / (data.length - 1 || 1);

  const yFor = (v: number) =>
    PAD_TOP + plotH - (Math.min(v, range) / range) * plotH;

  const points = data.map((v, i) => [PAD_LEFT + i * step, yFor(v)] as const);

  const linePath = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");

  const areaPath = `${linePath} L${points[points.length - 1][0].toFixed(1)},${(
    PAD_TOP + plotH
  ).toFixed(1)} L${PAD_LEFT},${(PAD_TOP + plotH).toFixed(1)} Z`;

  const gradId = `grad-${color.replace(/[^a-zA-Z0-9]/g, "")}`;

  const yTicks = [0, 0.5, 1].map((frac) => ({ frac, value: frac * max }));
  const fmtTick =
    yTickFormat ?? ((v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1)));

  const xTicks = (() => {
    if (!times || times.length === 0) {
      return [{ i: 0, label: "" }];
    }
    const n = times.length;
    const idxs = n === 1 ? [0] : [0, Math.floor((n - 1) / 2), n - 1];
    return idxs.map((i) => ({ i, label: fmtTime(times[i]) }));
  })();

  return (
    <div>
      {currentValue && (
        <div className="mb-1 flex items-center justify-between">
          <span className="font-mono text-sm text-neutral-200">{currentValue}</span>
        </div>
      )}
      <svg
        width="100%"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="block"
        style={{ maxHeight: H }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.4" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {yTicks.map((t) => {
          const y = yFor(t.value);
          return (
            <g key={t.frac}>
              <line
                x1={PAD_LEFT}
                y1={y}
                x2={W - PAD_RIGHT}
                y2={y}
                stroke="#262626"
                strokeWidth="1"
                strokeDasharray={t.frac === 0 ? "" : "2 3"}
              />
              <text
                x={PAD_LEFT - 6}
                y={y + 3}
                textAnchor="end"
                fontSize="9"
                fill="#737373"
              >
                {fmtTick(t.value)}
              </text>
            </g>
          );
        })}

        <path d={areaPath} fill={`url(#${gradId})`} />
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {xTicks.map((t) => (
          <text
            key={t.i}
            x={PAD_LEFT + t.i * step}
            y={H - 4}
            textAnchor={t.i === 0 ? "start" : t.i === data.length - 1 ? "end" : "middle"}
            fontSize="9"
            fill="#737373"
          >
            {t.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

export default LineChart;