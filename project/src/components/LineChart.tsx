interface DataPoint {
  label: string;
  value: number;
  value2?: number;
}

interface LineChartProps {
  data: DataPoint[];
  color?: string;
  color2?: string;
  label?: string;
  label2?: string;
  unit?: string;
  height?: number;
}

export default function LineChart({
  data,
  color = '#3b82f6',
  color2,
  label = '',
  label2 = '',
  unit = '',
  height = 180,
}: LineChartProps) {
  if (data.length < 2) return null;

  const allValues = data.flatMap((d) => [d.value, ...(d.value2 !== undefined ? [d.value2] : [])]);
  const max = Math.max(...allValues);
  const min = 0;
  const range = max - min || 1;
  const w = 500;
  const h = height;
  const padLeft = 40;
  const padRight = 10;
  const padTop = 10;
  const padBottom = 24;
  const chartW = w - padLeft - padRight;
  const chartH = h - padTop - padBottom;
  const step = chartW / (data.length - 1);

  const toX = (i: number) => padLeft + i * step;
  const toY = (v: number) => padTop + chartH - ((v - min) / range) * chartH;

  const polyline1 = data.map((d, i) => `${toX(i)},${toY(d.value)}`).join(' ');
  const area1 = `${padLeft},${padTop + chartH} ${polyline1} ${padLeft + chartW},${padTop + chartH}`;

  const polyline2 = color2
    ? data.map((d, i) => `${toX(i)},${toY(d.value2 ?? 0)}`).join(' ')
    : '';
  const area2 = color2
    ? `${padLeft},${padTop + chartH} ${polyline2} ${padLeft + chartW},${padTop + chartH}`
    : '';

  const gridLines = 4;

  return (
    <div className="w-full">
      {(label || label2) && (
        <div className="flex items-center gap-4 mb-3">
          {label && (
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 inline-block rounded" style={{ backgroundColor: color }} />
              <span className="text-xs text-gray-500">{label}</span>
            </div>
          )}
          {label2 && color2 && (
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 inline-block rounded" style={{ backgroundColor: color2 }} />
              <span className="text-xs text-gray-500">{label2}</span>
            </div>
          )}
        </div>
      )}
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }}>
        <defs>
          <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
          {color2 && (
            <linearGradient id="grad2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color2} stopOpacity="0.15" />
              <stop offset="100%" stopColor={color2} stopOpacity="0" />
            </linearGradient>
          )}
        </defs>

        {/* Grid lines */}
        {Array.from({ length: gridLines + 1 }, (_, i) => {
          const y = padTop + (i / gridLines) * chartH;
          const val = max - (i / gridLines) * max;
          return (
            <g key={i}>
              <line x1={padLeft} y1={y} x2={padLeft + chartW} y2={y} stroke="#f3f4f6" strokeWidth="1" />
              <text x={padLeft - 4} y={y + 4} textAnchor="end" fontSize="9" fill="#9ca3af">
                {val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val.toFixed(0)}{unit}
              </text>
            </g>
          );
        })}

        {/* Area fills */}
        {color2 && <polygon points={area2} fill="url(#grad2)" />}
        <polygon points={area1} fill="url(#grad1)" />

        {/* Lines */}
        {color2 && (
          <polyline points={polyline2} fill="none" stroke={color2} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        )}
        <polyline points={polyline1} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {/* X axis labels */}
        {data.map((d, i) => {
          if (data.length <= 12 || i % Math.ceil(data.length / 12) === 0) {
            return (
              <text key={i} x={toX(i)} y={h - 4} textAnchor="middle" fontSize="9" fill="#9ca3af">
                {d.label}
              </text>
            );
          }
          return null;
        })}
      </svg>
    </div>
  );
}
