"use client";

import { LineChart, Line } from "recharts";

interface SparklineProps {
  data: number[]; // 12 monthly values, zero-filled
  width?: number;
  height?: number;
}

export default function Sparkline({
  data,
  width = 80,
  height = 28,
}: SparklineProps) {
  const chartData = data.map((value, i) => ({ i, value }));

  return (
    <LineChart width={width} height={height} data={chartData}>
      <Line
        type="monotone"
        dataKey="value"
        stroke="var(--interactive)"
        strokeWidth={1.5}
        dot={false}
        isAnimationActive={false}
      />
    </LineChart>
  );
}
