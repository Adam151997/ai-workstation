// app/settings/billing/page.tsx
// Comprehensive Billing & Usage Dashboard with Charts
'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { 
    CreditCard,
    Zap,
    BarChart3,
    Clock,
    TrendingUp,
    TrendingDown,
    AlertTriangle,
    CheckCircle,
    Loader2,
    RefreshCw,
    ArrowUpRight,
    Activity,
    Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// Dynamic imports for charts
const TokenUsageChart = dynamic(
  () => import('@/components/charts/UsageCharts').then(mod => mod.TokenUsageChart),
  { ssr: false, loading: () => <ChartSkeleton /> }
);
const CombinedUsageChart = dynamic(
  () => import('@/components/charts/UsageCharts').then(mod => mod.CombinedUsageChart),
  { ssr: false, loading: () => <ChartSkeleton /> }
);
const CostTrendChart = dynamic(
  () => import('@/components/charts/UsageCharts').then(mod => mod.CostTrendChart),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

const ChartSkeleton = () => (
  <div className="h-[250px] bg-gray-100 animate-pulse rounded-lg" />
);

interface Subscription {
    tierName: string;
    status: string;
    billingPeriod: string;
    currentPeriodStart?: string;
    currentPeriodEnd?: string;
}

interface Tier {
    name: string;
    displayName: string;
    description?: string;
    tokensPerMonth: number;
    requestsPerDay: number;
    requestsPerMinute: number;
    maxDocuments: number;
    maxProjects: number;
    maxFileSizeMb: number;
    features: string[];
    priceMonthly?: number;
    priceYearly?: number;
}

interface UsageSummary {
    currentPeriod: {
        start: string;
        end: string;
        tokensUsed: number;
        tokensLimit: number;
        tokensPercentage: number;
        requestsToday: number;
        requestsLimit: number;
        requestsPercentage: number;
        totalCost: number;
    };
    today: {
        requests: number;
        tokens: number;
        cost: number;
    };
    thisMonth: {
        requests: number;
        tokens: number;
        cost: number;
    };
}

interface RateLimits {
    allowed: boolean;
    reason?: string;
    limits: {
        minute: { current: number; limit: number };
        day: { current: number; limit: number };
        month: { current: number; limit: number };
    };
}

interface TimeSeriesData {
    date: string;
    displayDate: string;
    tokens: number;
    requests: number;
    cost: number;
}

export default function BillingPage() {
    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const [tier, setTier] = useState<Tier | null>(null);
    const [tiers, setTiers] = useState<Tier[]>([]);
    const [summary, setSummary] = useState<UsageSummary | null>(null);
    const [rateLimits, setRateLimits] = useState<RateLimits | null>(null);
    const [usageData, setUsageData] = useState<TimeSeriesData[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [chartDays, setChartDays] = useState(14);
    const [activeChart, setActiveChart] = useState<'combined' | 'tokens' | 'cost'>('combined');

    const fetchData = async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        try {
            // Fetch subscription
            const subRes = await fetch('/api/billing/subscription');
            const subData = await subRes.json();
            if (subData.success) {
                setSubscription(subData.subscription);
                setTier(subData.tier);
            }

            // Fetch usage summary
            const usageRes = await fetch('/api/billing/usage?type=summary');
            const usageData = await usageRes.json();
            if (usageData.success) {
                setSummary(usageData.summary);
                setRateLimits(usageData.rateLimits);
            }

            // Fetch time-series usage data
            const analyticsRes = await fetch(`/api/analytics?type=usage&days=${chartDays}`);
            const analyticsData = await analyticsRes.json();
            if (analyticsData.success) {
                setUsageData(analyticsData.data || []);
            }

            // Fetch available tiers
            const tiersRes = await fetch('/api/billing/tiers');
            const tiersData = await tiersRes.json();
            if (tiersData.success) {
                setTiers(tiersData.tiers || []);
            }
        } catch (error) {
            console.error('Failed to fetch billing data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [chartDays]);

    const formatNumber = (num: number) => {
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
        return num.toString();
    };

    const formatCost = (cost: number) => {
        if (cost >= 1) return `$${cost.toFixed(2)}`;
        if (cost >= 0.01) return `$${cost.toFixed(4)}`;
        return `$${cost.toFixed(6)}`;
    };

    const getProgressColor = (percentage: number) => {
        if (percentage >= 90) return 'bg-red-500';
        if (percentage >= 70) return 'bg-yellow-500';
        return 'bg-green-500';
    };

    const getTotalUsageFromChart = () => {
        return usageData.reduce((acc, day) => ({
            tokens: acc.tokens + day.tokens,
            requests: acc.requests + day.requests,
            cost: acc.cost + day.cost,
        }), { tokens: 0, requests: 0, cost: 0 });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    const chartTotals = getTotalUsageFromChart();

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <CreditCard className="h-7 w-7 text-blue-600" />
                        Billing & Usage
                    </h1>
                    <p className="text-gray-600 mt-1">
                        Manage your subscription and monitor usage
                    </p>
                </div>
                <Button
                    variant="outline"
                    onClick={() => fetchData(true)}
                    disabled={refreshing}
                >
                    <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {/* Current Plan Card */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-blue-100 text-sm">Current Plan</p>
                        <h2 className="text-3xl font-bold mt-1">
                            {tier?.displayName || 'Free'}
                        </h2>
                        <p className="text-blue-100 mt-2">
                            {subscription?.status === 'active' ? (
                                <span className="flex items-center gap-1">
                                    <CheckCircle className="h-4 w-4" />
                                    Active • {subscription.billingPeriod}
                                </span>
                            ) : (
                                'Free tier'
                            )}
                        </p>
                    </div>
                    <div className="text-right">
                        <Sparkles className="h-12 w-12 text-blue-200" />
                    </div>
                </div>
                
                <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white/10 rounded-lg p-3">
                        <p className="text-blue-100 text-xs">Tokens/Month</p>
                        <p className="text-xl font-bold">{formatNumber(tier?.tokensPerMonth || 50000)}</p>
                    </div>
                    <div className="bg-white/10 rounded-lg p-3">
                        <p className="text-blue-100 text-xs">Requests/Day</p>
                        <p className="text-xl font-bold">{tier?.requestsPerDay || 50}</p>
                    </div>
                    <div className="bg-white/10 rounded-lg p-3">
                        <p className="text-blue-100 text-xs">Documents</p>
                        <p className="text-xl font-bold">{tier?.maxDocuments || 10}</p>
                    </div>
                    <div className="bg-white/10 rounded-lg p-3">
                        <p className="text-blue-100 text-xs">Projects</p>
                        <p className="text-xl font-bold">{tier?.maxProjects || 2}</p>
                    </div>
                </div>
            </div>

            {/* Usage Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg border p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">Tokens Used</p>
                            <p className="text-2xl font-bold text-gray-900 mt-1">
                                {formatNumber(summary?.currentPeriod.tokensUsed || 0)}
                            </p>
                        </div>
                        <div className="p-3 bg-purple-100 rounded-lg">
                            <Zap className="h-6 w-6 text-purple-600" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-gray-500">
                                of {formatNumber(summary?.currentPeriod.tokensLimit || 0)}
                            </span>
                            <span className={`font-medium ${
                                (summary?.currentPeriod.tokensPercentage || 0) >= 90 ? 'text-red-600' :
                                (summary?.currentPeriod.tokensPercentage || 0) >= 70 ? 'text-yellow-600' :
                                'text-green-600'
                            }`}>
                                {(summary?.currentPeriod.tokensPercentage || 0).toFixed(1)}%
                            </span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                            <div
                                className={`h-2 rounded-full ${getProgressColor(summary?.currentPeriod.tokensPercentage || 0)}`}
                                style={{ width: `${Math.min(summary?.currentPeriod.tokensPercentage || 0, 100)}%` }}
                            />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg border p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">Requests Today</p>
                            <p className="text-2xl font-bold text-gray-900 mt-1">
                                {summary?.currentPeriod.requestsToday || 0}
                            </p>
                        </div>
                        <div className="p-3 bg-blue-100 rounded-lg">
                            <Activity className="h-6 w-6 text-blue-600" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-gray-500">
                                of {summary?.currentPeriod.requestsLimit || 0}
                            </span>
                            <span className={`font-medium ${
                                (summary?.currentPeriod.requestsPercentage || 0) >= 90 ? 'text-red-600' :
                                (summary?.currentPeriod.requestsPercentage || 0) >= 70 ? 'text-yellow-600' :
                                'text-green-600'
                            }`}>
                                {(summary?.currentPeriod.requestsPercentage || 0).toFixed(1)}%
                            </span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                            <div
                                className={`h-2 rounded-full ${getProgressColor(summary?.currentPeriod.requestsPercentage || 0)}`}
                                style={{ width: `${Math.min(summary?.currentPeriod.requestsPercentage || 0, 100)}%` }}
                            />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg border p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">Cost This Month</p>
                            <p className="text-2xl font-bold text-gray-900 mt-1">
                                {formatCost(summary?.thisMonth.cost || 0)}
                            </p>
                        </div>
                        <div className="p-3 bg-green-100 rounded-lg">
                            <TrendingUp className="h-6 w-6 text-green-600" />
                        </div>
                    </div>
                    <div className="mt-3 text-sm text-gray-500">
                        Based on API usage
                    </div>
                </div>

                <div className="bg-white rounded-lg border p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">Rate Limit</p>
                            <p className="text-2xl font-bold text-gray-900 mt-1">
                                {rateLimits?.allowed ? (
                                    <span className="text-green-600">OK</span>
                                ) : (
                                    <span className="text-red-600">Limited</span>
                                )}
                            </p>
                        </div>
                        <div className={`p-3 rounded-lg ${
                            rateLimits?.allowed ? 'bg-green-100' : 'bg-red-100'
                        }`}>
                            {rateLimits?.allowed ? (
                                <CheckCircle className="h-6 w-6 text-green-600" />
                            ) : (
                                <AlertTriangle className="h-6 w-6 text-red-600" />
                            )}
                        </div>
                    </div>
                    {!rateLimits?.allowed && (
                        <div className="mt-3 text-sm text-red-600">
                            {rateLimits?.reason}
                        </div>
                    )}
                </div>
            </div>

            {/* Usage Chart */}
            <div className="bg-white rounded-lg border p-5">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-blue-600" />
                        Usage History
                    </h3>
                    <div className="flex items-center gap-2">
                        {/* Chart Type Selector */}
                        <div className="flex bg-gray-100 rounded-lg p-1">
                            <button
                                onClick={() => setActiveChart('combined')}
                                className={`px-3 py-1 text-sm rounded-md transition ${
                                    activeChart === 'combined' 
                                        ? 'bg-white shadow text-gray-900' 
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                Combined
                            </button>
                            <button
                                onClick={() => setActiveChart('tokens')}
                                className={`px-3 py-1 text-sm rounded-md transition ${
                                    activeChart === 'tokens' 
                                        ? 'bg-white shadow text-gray-900' 
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                Tokens
                            </button>
                            <button
                                onClick={() => setActiveChart('cost')}
                                className={`px-3 py-1 text-sm rounded-md transition ${
                                    activeChart === 'cost' 
                                        ? 'bg-white shadow text-gray-900' 
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                Cost
                            </button>
                        </div>
                        
                        {/* Period Selector */}
                        <select
                            value={chartDays}
                            onChange={(e) => setChartDays(parseInt(e.target.value))}
                            className="px-3 py-1 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                        >
                            <option value={7}>7 days</option>
                            <option value={14}>14 days</option>
                            <option value={30}>30 days</option>
                        </select>
                    </div>
                </div>

                {/* Chart Summary */}
                <div className="grid grid-cols-3 gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
                    <div>
                        <p className="text-xs text-gray-500">Total Tokens ({chartDays}d)</p>
                        <p className="text-lg font-semibold text-purple-600">{formatNumber(chartTotals.tokens)}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-500">Total Requests ({chartDays}d)</p>
                        <p className="text-lg font-semibold text-blue-600">{chartTotals.requests}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-500">Total Cost ({chartDays}d)</p>
                        <p className="text-lg font-semibold text-green-600">{formatCost(chartTotals.cost)}</p>
                    </div>
                </div>

                {/* Chart */}
                {usageData.length > 0 ? (
                    <>
                        {activeChart === 'combined' && <CombinedUsageChart data={usageData} height={300} />}
                        {activeChart === 'tokens' && <TokenUsageChart data={usageData} height={300} />}
                        {activeChart === 'cost' && <CostTrendChart data={usageData} height={300} />}
                    </>
                ) : (
                    <div className="h-[300px] flex items-center justify-center text-gray-500">
                        No usage data yet. Start using the AI workstation to see your usage trends.
                    </div>
                )}
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Rate Limit Details */}
                {rateLimits && (
                    <div className="bg-white rounded-lg border p-5">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <Clock className="h-5 w-5 text-orange-600" />
                            Rate Limit Details
                        </h3>
                        <div className="space-y-4">
                            <div className="p-4 bg-gray-50 rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm text-gray-500">Per Minute</span>
                                    <span className="text-sm font-medium">
                                        {rateLimits.limits.minute.current} / {rateLimits.limits.minute.limit}
                                    </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                        className={`h-2 rounded-full ${getProgressColor(
                                            (rateLimits.limits.minute.current / rateLimits.limits.minute.limit) * 100
                                        )}`}
                                        style={{ 
                                            width: `${Math.min(
                                                (rateLimits.limits.minute.current / rateLimits.limits.minute.limit) * 100,
                                                100
                                            )}%` 
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="p-4 bg-gray-50 rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm text-gray-500">Per Day</span>
                                    <span className="text-sm font-medium">
                                        {rateLimits.limits.day.current} / {rateLimits.limits.day.limit}
                                    </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                        className={`h-2 rounded-full ${getProgressColor(
                                            (rateLimits.limits.day.current / rateLimits.limits.day.limit) * 100
                                        )}`}
                                        style={{ 
                                            width: `${Math.min(
                                                (rateLimits.limits.day.current / rateLimits.limits.day.limit) * 100,
                                                100
                                            )}%` 
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="p-4 bg-gray-50 rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm text-gray-500">Monthly Tokens</span>
                                    <span className="text-sm font-medium">
                                        {formatNumber(rateLimits.limits.month.current)} / {formatNumber(rateLimits.limits.month.limit)}
                                    </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                        className={`h-2 rounded-full ${getProgressColor(
                                            (rateLimits.limits.month.current / rateLimits.limits.month.limit) * 100
                                        )}`}
                                        style={{ 
                                            width: `${Math.min(
                                                (rateLimits.limits.month.current / rateLimits.limits.month.limit) * 100,
                                                100
                                            )}%` 
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Available Plans */}
                <div className="bg-white rounded-lg border p-5">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-purple-600" />
                        Available Plans
                    </h3>
                    <div className="space-y-3">
                        {tiers.map((t) => (
                            <div 
                                key={t.name} 
                                className={`p-4 rounded-lg border-2 transition-colors ${
                                    t.name === tier?.name 
                                        ? 'border-blue-500 bg-blue-50' 
                                        : 'border-gray-200 hover:border-gray-300'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-semibold text-gray-900">
                                                {t.displayName}
                                            </h4>
                                            {t.name === tier?.name && (
                                                <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">
                                                    Current
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-500 mt-1">
                                            {formatNumber(t.tokensPerMonth)} tokens • {t.requestsPerDay} req/day
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        {t.priceMonthly && t.priceMonthly > 0 ? (
                                            <div>
                                                <span className="text-2xl font-bold text-gray-900">
                                                    ${t.priceMonthly}
                                                </span>
                                                <span className="text-gray-500">/mo</span>
                                            </div>
                                        ) : (
                                            <span className="text-lg font-semibold text-green-600">
                                                Free
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {t.name !== tier?.name && (
                                    <Button 
                                        variant={t.priceMonthly && t.priceMonthly > 0 ? "default" : "outline"}
                                        size="sm" 
                                        className="mt-3 w-full"
                                        disabled={t.name === 'enterprise'}
                                    >
                                        {t.name === 'enterprise' ? 'Contact Sales' : (
                                            t.priceMonthly && t.priceMonthly > 0 
                                                ? 'Upgrade' 
                                                : 'Select'
                                        )}
                                        <ArrowUpRight className="h-4 w-4 ml-1" />
                                    </Button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Payment Info Notice */}
            <div className="bg-gray-50 rounded-lg border p-4 text-sm text-gray-600">
                <strong>💳 Payment Integration:</strong> Stripe integration for paid plans coming soon. 
                Currently operating in free tier mode with usage tracking enabled.
            </div>
        </div>
    );
}
