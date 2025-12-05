// app/settings/observability/page.tsx
// Comprehensive Observability Dashboard with Charts
'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { 
  BarChart3, 
  Activity, 
  DollarSign, 
  Zap, 
  FileText, 
  Clock,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Loader2,
  RefreshCw,
  Database,
  MessageSquare,
  FolderKanban,
  Tag,
  Search,
  User
} from 'lucide-react';

// Dynamic import to avoid SSR issues with Recharts
const TokenUsageChart = dynamic(
  () => import('@/components/charts/UsageCharts').then(mod => mod.TokenUsageChart),
  { ssr: false, loading: () => <ChartSkeleton /> }
);
const RequestChart = dynamic(
  () => import('@/components/charts/UsageCharts').then(mod => mod.RequestChart),
  { ssr: false, loading: () => <ChartSkeleton /> }
);
const CostTrendChart = dynamic(
  () => import('@/components/charts/UsageCharts').then(mod => mod.CostTrendChart),
  { ssr: false, loading: () => <ChartSkeleton /> }
);
const SuccessRateChart = dynamic(
  () => import('@/components/charts/UsageCharts').then(mod => mod.SuccessRateChart),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

const ChartSkeleton = () => (
  <div className="h-[250px] bg-gray-100 animate-pulse rounded-lg" />
);

interface Stats {
  totalExecutions: number;
  runningExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  totalCost: number;
  totalTokens: number;
  totalAuditLogs: number;
  averageExecutionTime: number;
}

interface CostByMode {
  mode: string;
  totalCost: number;
  totalTokens: number;
  executionCount: number;
}

interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  metadata: Record<string, any>;
  createdAt: string;
}

interface DocumentStats {
  totalDocuments: number;
  totalChunks: number;
  byMode: { mode: string; count: number }[];
  byType: { type: string; count: number }[];
  recentUploads: number;
}

interface TimeSeriesData {
  date: string;
  displayDate: string;
  tokens: number;
  requests: number;
  cost: number;
  successRate?: number;
}

export default function ObservabilityPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [costByMode, setCostByMode] = useState<CostByMode[]>([]);
  const [recentLogs, setRecentLogs] = useState<AuditLog[]>([]);
  const [documentStats, setDocumentStats] = useState<DocumentStats | null>(null);
  const [usageData, setUsageData] = useState<TimeSeriesData[]>([]);
  const [workflowData, setWorkflowData] = useState<TimeSeriesData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [chartDays, setChartDays] = useState(14);

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      // Fetch workflow stats
      const statsRes = await fetch('/api/workflow?type=stats');
      const statsData = await statsRes.json();
      if (statsData.success) {
        setStats(statsData.stats);
      }

      // Fetch cost by mode
      const costRes = await fetch('/api/workflow?type=cost-by-mode');
      const costData = await costRes.json();
      if (costData.success) {
        setCostByMode(costData.costByMode || []);
      }

      // Fetch recent audit logs
      const logsRes = await fetch('/api/audit?limit=10');
      const logsData = await logsRes.json();
      if (logsData.success) {
        setRecentLogs(logsData.logs || []);
      }

      // Fetch document stats
      const docRes = await fetch('/api/observability/documents');
      const docData = await docRes.json();
      if (docData.success) {
        setDocumentStats(docData.stats);
      }

      // Fetch time-series usage data
      const usageRes = await fetch(`/api/analytics?type=usage&days=${chartDays}`);
      const usageResult = await usageRes.json();
      if (usageResult.success) {
        setUsageData(usageResult.data || []);
      }

      // Fetch workflow time-series
      const workflowRes = await fetch(`/api/analytics?type=workflows&days=${chartDays}`);
      const workflowResult = await workflowRes.json();
      if (workflowResult.success) {
        setWorkflowData(workflowResult.data || []);
      }

      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to fetch observability data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(interval);
  }, [chartDays]);

  const formatCost = (cost: number) => {
    if (cost >= 1) return `$${cost.toFixed(2)}`;
    if (cost >= 0.01) return `$${cost.toFixed(4)}`;
    return `$${cost.toFixed(6)}`;
  };

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
    return tokens.toString();
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const formatTimeAgo = (date: string) => {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 0) return 'Just now';
    if (diffMins < 1) return 'Just now';
    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMins > 0) return `${diffMins}m ago`;
    return 'Just now';
  };

  const getActionIcon = (action: string) => {
    if (action?.startsWith('document')) return <FileText className="h-4 w-4 text-blue-500" />;
    if (action?.startsWith('project')) return <FolderKanban className="h-4 w-4 text-purple-500" />;
    if (action?.startsWith('tag')) return <Tag className="h-4 w-4 text-green-500" />;
    if (action?.startsWith('search')) return <Search className="h-4 w-4 text-orange-500" />;
    if (action?.startsWith('chat')) return <MessageSquare className="h-4 w-4 text-indigo-500" />;
    if (action?.startsWith('workflow')) return <Activity className="h-4 w-4 text-pink-500" />;
    if (action?.startsWith('settings')) return <Database className="h-4 w-4 text-gray-500" />;
    return <Activity className="h-4 w-4 text-gray-400" />;
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      'document.upload': 'Document Uploaded',
      'document.update': 'Document Updated',
      'document.delete': 'Document Deleted',
      'document.download': 'Document Downloaded',
      'project.create': 'Project Created',
      'project.update': 'Project Updated',
      'project.delete': 'Project Deleted',
      'tag.create': 'Tag Created',
      'tag.update': 'Tag Updated',
      'tag.delete': 'Tag Deleted',
      'search.query': 'Search Performed',
      'settings.tools_update': 'Tools Updated',
      'chat.message': 'Chat Message',
      'workflow.run': 'Workflow Executed',
    };
    return labels[action] || action;
  };

  const successRate = stats 
    ? stats.totalExecutions > 0 
      ? ((stats.successfulExecutions / stats.totalExecutions) * 100).toFixed(1)
      : '100'
    : '0';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-blue-600" />
            Observability Dashboard
          </h1>
          <p className="text-gray-600 mt-1">
            Monitor your AI workstation usage, costs, and activity
          </p>
        </div>
        <div className="flex items-center gap-4">
          <select 
            value={chartDays}
            onChange={(e) => setChartDays(parseInt(e.target.value))}
            className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
          </select>
          <span className="text-sm text-gray-500">
            Updated: {lastRefresh.toLocaleTimeString()}
          </span>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-white border rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Workflows</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {stats?.totalExecutions || 0}
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Activity className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1 text-green-600">
              <CheckCircle className="h-4 w-4" />
              {stats?.successfulExecutions || 0}
            </span>
            <span className="flex items-center gap-1 text-red-600">
              <AlertCircle className="h-4 w-4" />
              {stats?.failedExecutions || 0}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Cost</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatCost(stats?.totalCost || 0)}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Tokens</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatTokens(stats?.totalTokens || 0)}
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <Zap className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Success Rate</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {successRate}%
              </p>
            </div>
            <div className={`p-3 rounded-lg ${
              parseFloat(successRate) >= 90 ? 'bg-green-100' : 
              parseFloat(successRate) >= 70 ? 'bg-yellow-100' : 'bg-red-100'
            }`}>
              {parseFloat(successRate) >= 90 ? (
                <TrendingUp className="h-6 w-6 text-green-600" />
              ) : (
                <TrendingDown className="h-6 w-6 text-red-600" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Token Usage Chart */}
        <div className="bg-white rounded-lg border p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-purple-600" />
            Token Usage
          </h3>
          {usageData.length > 0 ? (
            <TokenUsageChart data={usageData} height={250} />
          ) : (
            <div className="h-[250px] flex items-center justify-center text-gray-500">
              No usage data yet
            </div>
          )}
        </div>

        {/* Request Chart */}
        <div className="bg-white rounded-lg border p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600" />
            Daily Requests
          </h3>
          {usageData.length > 0 ? (
            <RequestChart data={usageData} height={250} />
          ) : (
            <div className="h-[250px] flex items-center justify-center text-gray-500">
              No request data yet
            </div>
          )}
        </div>
      </div>

      {/* Second Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cost Trend Chart */}
        <div className="bg-white rounded-lg border p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            Cost Trend
          </h3>
          {usageData.length > 0 ? (
            <CostTrendChart data={usageData} height={250} />
          ) : (
            <div className="h-[250px] flex items-center justify-center text-gray-500">
              No cost data yet
            </div>
          )}
        </div>

        {/* Success Rate Chart */}
        <div className="bg-white rounded-lg border p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Workflow Success Rate
          </h3>
          {workflowData.length > 0 ? (
            <SuccessRateChart data={workflowData} height={250} />
          ) : (
            <div className="h-[250px] flex items-center justify-center text-gray-500">
              No workflow data yet
            </div>
          )}
        </div>
      </div>

      {/* Document Stats */}
      {documentStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Documents</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {documentStats.totalDocuments}
                </p>
              </div>
              <div className="p-3 bg-indigo-100 rounded-lg">
                <FileText className="h-6 w-6 text-indigo-600" />
              </div>
            </div>
            <div className="mt-3 text-sm text-gray-500">
              {documentStats.recentUploads} uploaded this week
            </div>
          </div>

          <div className="bg-white rounded-lg border p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Chunks</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {documentStats.totalChunks}
                </p>
              </div>
              <div className="p-3 bg-orange-100 rounded-lg">
                <Database className="h-6 w-6 text-orange-600" />
              </div>
            </div>
            <div className="mt-3 text-sm text-gray-500">
              Indexed in vector store
            </div>
          </div>

          <div className="bg-white rounded-lg border p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Audit Logs</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {stats?.totalAuditLogs || 0}
                </p>
              </div>
              <div className="p-3 bg-gray-100 rounded-lg">
                <Clock className="h-6 w-6 text-gray-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Running Workflows</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {stats?.runningExecutions || 0}
                </p>
              </div>
              <div className={`p-3 rounded-lg ${
                (stats?.runningExecutions || 0) > 0 ? 'bg-yellow-100' : 'bg-gray-100'
              }`}>
                <Loader2 className={`h-6 w-6 ${
                  (stats?.runningExecutions || 0) > 0 
                    ? 'text-yellow-600 animate-spin' 
                    : 'text-gray-400'
                }`} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cost by Mode */}
        <div className="bg-white rounded-lg border p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Usage by Mode
          </h2>
          {costByMode.length > 0 ? (
            <div className="space-y-4">
              {costByMode.map((item) => (
                <div key={item.mode} className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${
                    item.mode === 'Sales' ? 'bg-blue-500' :
                    item.mode === 'Marketing' ? 'bg-purple-500' :
                    'bg-green-500'
                  }`} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-gray-900">{item.mode}</span>
                      <span className="text-sm text-gray-500">
                        {item.executionCount} runs
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">
                        {formatTokens(item.totalTokens)} tokens
                      </span>
                      <span className="font-medium text-gray-900">
                        {formatCost(item.totalCost)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No usage data yet
            </div>
          )}
        </div>

        {/* Documents by Mode */}
        {documentStats && (
          <div className="bg-white rounded-lg border p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Documents by Mode
            </h2>
            {documentStats.byMode.length > 0 ? (
              <div className="space-y-4">
                {documentStats.byMode.map((item) => {
                  const percentage = documentStats.totalDocuments > 0
                    ? (item.count / documentStats.totalDocuments) * 100
                    : 0;
                  return (
                    <div key={item.mode}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-gray-900">{item.mode}</span>
                        <span className="text-sm text-gray-500">
                          {item.count} documents
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            item.mode === 'Sales' ? 'bg-blue-500' :
                            item.mode === 'Marketing' ? 'bg-purple-500' :
                            'bg-green-500'
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No documents yet
              </div>
            )}
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg border">
        <div className="p-5 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            Recent Activity
          </h2>
        </div>
        <div className="divide-y">
          {recentLogs.length > 0 ? (
            recentLogs.map((log) => (
              <div key={log.id} className="p-4 flex items-center gap-4 hover:bg-gray-50">
                <div className="p-2 bg-gray-100 rounded-lg">
                  {getActionIcon(log.action)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">
                    {getActionLabel(log.action)}
                  </p>
                  <p className="text-sm text-gray-500 truncate">
                    {log.metadata?.filename || log.metadata?.name || log.metadata?.workflowName || log.resourceId || 'N/A'}
                  </p>
                  <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                    <User className="h-3 w-3" />
                    {log.userId?.substring(0, 12)}...
                  </p>
                </div>
                <div className="text-sm text-gray-500">
                  {formatTimeAgo(log.createdAt)}
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-gray-500">
              No recent activity
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
