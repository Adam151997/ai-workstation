// components/charts/UsageCharts.tsx
// Reusable chart components using Recharts - Theme Aware
'use client';

import {
    LineChart,
    Line,
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ComposedChart,
} from 'recharts';

// Theme Colors - Electric Purple accent
const COLORS = {
    primary: '#8b5cf6',      // Electric Purple
    secondary: '#a78bfa',    // Light Purple
    tertiary: '#c4b5fd',     // Pale Purple
    accent: '#7c3aed',       // Deep Purple
    success: '#10b981',      // Green
    warning: '#f59e0b',      // Orange
    info: '#6366f1',         // Indigo
    text: '#a0a0b0',         // Muted text
    grid: '#2a2a38',         // Grid lines (dark)
    gridLight: '#e5e7eb',    // Grid lines (light)
};

// Types
export interface TimeSeriesData {
    date: string;
    displayDate: string;
    tokens: number;
    requests: number;
    cost: number;
    successRate?: number;
    chatTokens?: number;
    embeddingTokens?: number;
}

interface ChartProps {
    data: TimeSeriesData[];
    height?: number;
}

// Custom tooltip with theme-aware styling
const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div style={{
                background: 'var(--surface-primary)',
                border: '1px solid var(--border-primary)',
                borderRadius: '8px',
                padding: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}>
                <p style={{ 
                    fontFamily: 'var(--font-display)',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginBottom: '8px',
                    fontSize: '12px',
                }}>{label}</p>
                {payload.map((entry: any, index: number) => (
                    <p key={index} style={{ 
                        color: entry.color,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '13px',
                        marginBottom: '4px',
                    }}>
                        <span style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            backgroundColor: entry.color,
                            boxShadow: `0 0 8px ${entry.color}40`,
                        }} />
                        <span style={{ color: 'var(--text-secondary)' }}>{entry.name}:</span>
                        <span style={{ fontWeight: 600, fontFamily: 'var(--font-data)' }}>
                            {entry.name.toLowerCase().includes('cost') 
                                ? `$${entry.value.toFixed(4)}`
                                : entry.name.toLowerCase().includes('rate')
                                    ? `${entry.value.toFixed(1)}%`
                                    : entry.value.toLocaleString()}
                        </span>
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

// Token Usage Chart - Area chart showing token consumption over time
export function TokenUsageChart({ data, height = 300 }: ChartProps) {
    return (
        <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                    <linearGradient id="tokenGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
                <XAxis 
                    dataKey="displayDate" 
                    stroke={COLORS.text}
                    fontSize={11}
                    tickLine={false}
                    fontFamily="var(--font-mono)"
                />
                <YAxis 
                    stroke={COLORS.text}
                    fontSize={11}
                    tickLine={false}
                    fontFamily="var(--font-data)"
                    tickFormatter={(value) => {
                        if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                        if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                        return value;
                    }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                    type="monotone"
                    dataKey="tokens"
                    name="Tokens"
                    stroke={COLORS.primary}
                    strokeWidth={2}
                    fill="url(#tokenGradient)"
                />
            </AreaChart>
        </ResponsiveContainer>
    );
}

// Request Chart - Bar chart showing daily requests
export function RequestChart({ data, height = 300 }: ChartProps) {
    return (
        <ResponsiveContainer width="100%" height={height}>
            <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
                <XAxis 
                    dataKey="displayDate" 
                    stroke={COLORS.text}
                    fontSize={11}
                    tickLine={false}
                    fontFamily="var(--font-mono)"
                />
                <YAxis 
                    stroke={COLORS.text}
                    fontSize={11}
                    tickLine={false}
                    fontFamily="var(--font-data)"
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                    dataKey="requests" 
                    name="Requests"
                    fill={COLORS.info}
                    radius={[4, 4, 0, 0]}
                />
            </BarChart>
        </ResponsiveContainer>
    );
}

// Cost Trend Chart - Line chart showing cost over time
export function CostTrendChart({ data, height = 300 }: ChartProps) {
    return (
        <ResponsiveContainer width="100%" height={height}>
            <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
                <XAxis 
                    dataKey="displayDate" 
                    stroke={COLORS.text}
                    fontSize={11}
                    tickLine={false}
                    fontFamily="var(--font-mono)"
                />
                <YAxis 
                    stroke={COLORS.text}
                    fontSize={11}
                    tickLine={false}
                    fontFamily="var(--font-data)"
                    tickFormatter={(value) => `$${value.toFixed(2)}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                    type="monotone"
                    dataKey="cost"
                    name="Cost"
                    stroke={COLORS.success}
                    strokeWidth={2}
                    dot={{ fill: COLORS.success, strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, fill: COLORS.success, stroke: COLORS.success, strokeWidth: 2 }}
                />
            </LineChart>
        </ResponsiveContainer>
    );
}

// Success Rate Chart - Area chart showing success percentage
export function SuccessRateChart({ data, height = 300 }: ChartProps) {
    return (
        <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                    <linearGradient id="successGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.success} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={COLORS.success} stopOpacity={0} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
                <XAxis 
                    dataKey="displayDate" 
                    stroke={COLORS.text}
                    fontSize={11}
                    tickLine={false}
                    fontFamily="var(--font-mono)"
                />
                <YAxis 
                    stroke={COLORS.text}
                    fontSize={11}
                    tickLine={false}
                    fontFamily="var(--font-data)"
                    domain={[0, 100]}
                    tickFormatter={(value) => `${value}%`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                    type="monotone"
                    dataKey="successRate"
                    name="Success Rate"
                    stroke={COLORS.success}
                    strokeWidth={2}
                    fill="url(#successGradient)"
                />
            </AreaChart>
        </ResponsiveContainer>
    );
}

// Combined Usage Chart - Shows tokens and requests together
export function CombinedUsageChart({ data, height = 300 }: ChartProps) {
    return (
        <ResponsiveContainer width="100%" height={height}>
            <ComposedChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                    <linearGradient id="combinedTokenGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
                <XAxis 
                    dataKey="displayDate" 
                    stroke={COLORS.text}
                    fontSize={11}
                    tickLine={false}
                    fontFamily="var(--font-mono)"
                />
                <YAxis 
                    yAxisId="left"
                    stroke={COLORS.primary}
                    fontSize={11}
                    tickLine={false}
                    fontFamily="var(--font-data)"
                    tickFormatter={(value) => {
                        if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                        return value;
                    }}
                />
                <YAxis 
                    yAxisId="right"
                    orientation="right"
                    stroke={COLORS.info}
                    fontSize={11}
                    tickLine={false}
                    fontFamily="var(--font-data)"
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                    wrapperStyle={{ 
                        fontFamily: 'var(--font-display)',
                        fontSize: '12px',
                    }}
                />
                <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="tokens"
                    name="Tokens"
                    stroke={COLORS.primary}
                    strokeWidth={2}
                    fill="url(#combinedTokenGradient)"
                />
                <Bar 
                    yAxisId="right"
                    dataKey="requests" 
                    name="Requests"
                    fill={COLORS.info}
                    radius={[4, 4, 0, 0]}
                    opacity={0.8}
                />
            </ComposedChart>
        </ResponsiveContainer>
    );
}

// Cost Breakdown Chart - Stacked area showing different cost types
export function CostBreakdownChart({ data, height = 300 }: ChartProps) {
    return (
        <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                    <linearGradient id="chatCostGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.info} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={COLORS.info} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="embeddingCostGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.warning} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={COLORS.warning} stopOpacity={0} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
                <XAxis 
                    dataKey="displayDate" 
                    stroke={COLORS.text}
                    fontSize={11}
                    tickLine={false}
                    fontFamily="var(--font-mono)"
                />
                <YAxis 
                    stroke={COLORS.text}
                    fontSize={11}
                    tickLine={false}
                    fontFamily="var(--font-data)"
                    tickFormatter={(value) => `$${value.toFixed(2)}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                    wrapperStyle={{ 
                        fontFamily: 'var(--font-display)',
                        fontSize: '12px',
                    }}
                />
                <Area
                    type="monotone"
                    dataKey="chatTokens"
                    name="Chat Cost"
                    stackId="1"
                    stroke={COLORS.info}
                    fill="url(#chatCostGradient)"
                />
                <Area
                    type="monotone"
                    dataKey="embeddingTokens"
                    name="Embedding Cost"
                    stackId="1"
                    stroke={COLORS.warning}
                    fill="url(#embeddingCostGradient)"
                />
            </AreaChart>
        </ResponsiveContainer>
    );
}

// Mini Sparkline - Small inline chart for dashboards
export function SparklineChart({ 
    data, 
    dataKey = 'value',
    color = COLORS.primary,
    height = 40 
}: { 
    data: { value: number }[]; 
    dataKey?: string;
    color?: string;
    height?: number;
}) {
    return (
        <ResponsiveContainer width="100%" height={height}>
            <LineChart data={data}>
                <Line
                    type="monotone"
                    dataKey={dataKey}
                    stroke={color}
                    strokeWidth={2}
                    dot={false}
                />
            </LineChart>
        </ResponsiveContainer>
    );
}
