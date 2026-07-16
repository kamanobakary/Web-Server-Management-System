interface GaugeChartProps {
  value: number;
  label: string;
  unit?: string;
  color?: string;
  size?: number;
}

export default function GaugeChart({ value, label, unit = '%', color = '#3b82f6', size = 100 }: GaugeChartProps) {
  const r = 38;
  const cx = 50;
  const cy = 50;
  const circumference = Math.PI * r;
  const progress = Math.min(100, Math.max(0, value));
  const dashOffset = circumference - (progress / 100) * circumference;

  const getColor = () => {
    if (value >= 90) return '#ef4444';
    if (value >= 75) return '#f97316';
    if (value >= 60) return '#eab308';
    return color;
  };

  const arcColor = getColor();

  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <svg viewBox="0 0 100 60" style={{ width: size, height: size * 0.6 }}>
        {/* Background arc */}
        <path
          d={`M 12 50 A 38 38 0 0 1 88 50`}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="8"
          strokeLinecap="round"
        />
        {/* Progress arc */}
        <path
          d={`M 12 50 A 38 38 0 0 1 88 50`}
          fill="none"
          stroke={arcColor}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.3s ease' }}
        />
        <text x={cx} y={46} textAnchor="middle" fontSize="16" fontWeight="700" fill="#111827">
          {progress.toFixed(0)}
        </text>
        <text x={cx} y={56} textAnchor="middle" fontSize="8" fill="#6b7280">
          {unit}
        </text>
      </svg>
      <p className="text-xs text-gray-500 font-medium mt-1 text-center">{label}</p>
    </div>
  );
}
