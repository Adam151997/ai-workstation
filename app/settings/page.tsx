// app/settings/page.tsx
// Settings home page with overview
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
    Settings, 
    Wrench, 
    FolderKanban, 
    Tags, 
    Database, 
    Activity,
    Zap,
    ArrowRight,
    Loader2
} from 'lucide-react';

interface Stats {
    tools: number;
    projects: number;
    tags: number;
    dataSources: number;
    runningJobs: number;
    recentActivity: number;
}

export default function SettingsPage() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            const [toolsRes, projectsRes, tagsRes, sourcesRes] = await Promise.all([
                fetch('/api/tools/user').catch(() => ({ json: async () => ({ tools: [] }) })),
                fetch('/api/projects').catch(() => ({ json: async () => ({ projects: [] }) })),
                fetch('/api/tags').catch(() => ({ json: async () => ({ tags: [] }) })),
                fetch('/api/data-sources').catch(() => ({ json: async () => ({ dataSources: [] }) })),
            ]);

            const [toolsData, projectsData, tagsData, sourcesData] = await Promise.all([
                toolsRes.json(),
                projectsRes.json(),
                tagsRes.json(),
                sourcesRes.json(),
            ]);

            setStats({
                tools: toolsData.tools?.length || 0,
                projects: projectsData.projects?.length || 0,
                tags: tagsData.tags?.length || 0,
                dataSources: sourcesData.dataSources?.length || 0,
                runningJobs: 0,
                recentActivity: 0,
            });
        } catch (error) {
            console.error('Failed to load stats:', error);
            setStats({
                tools: 0, projects: 0, tags: 0, dataSources: 0, runningJobs: 0, recentActivity: 0,
            });
        } finally {
            setLoading(false);
        }
    };

    const sections = [
        {
            title: 'Tools',
            description: 'Manage your AI toolkit - enable or disable tools',
            href: '/settings/tools',
            icon: Wrench,
            color: 'blue',
            stat: stats?.tools,
            statLabel: 'tools enabled',
        },
        {
            title: 'Projects',
            description: 'Organize documents into projects for better RAG',
            href: '/settings/projects',
            icon: FolderKanban,
            color: 'purple',
            stat: stats?.projects,
            statLabel: 'projects',
        },
        {
            title: 'Tags',
            description: 'Create tags to label and filter documents',
            href: '/settings/tags',
            icon: Tags,
            color: 'amber',
            stat: stats?.tags,
            statLabel: 'tags',
        },
        {
            title: 'Data Sources',
            description: 'Connect external sources like Google Drive, Notion',
            href: '/settings/data-sources',
            icon: Database,
            color: 'green',
            stat: stats?.dataSources,
            statLabel: 'sources',
        },
        {
            title: 'Background Jobs',
            description: 'Monitor long-running tasks and workflows',
            href: '/settings/jobs',
            icon: Zap,
            color: 'orange',
            stat: stats?.runningJobs,
            statLabel: 'running',
        },
        {
            title: 'Activity',
            description: 'View audit logs and workspace activity',
            href: '/settings/activity',
            icon: Activity,
            color: 'slate',
            stat: null,
            statLabel: null,
        },
    ];

    const colorClasses: Record<string, { bg: string; text: string; border: string }> = {
        blue: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
        purple: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200' },
        amber: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' },
        green: { bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200' },
        orange: { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200' },
        slate: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' },
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white rounded-lg border p-6">
                <div className="flex items-center gap-3 mb-4">
                    <Settings className="w-6 h-6 text-blue-600" />
                    <h2 className="text-xl font-semibold">Settings Overview</h2>
                </div>
                <p className="text-gray-600">
                    Configure your AI Workstation - manage tools, organize documents, connect data sources, and monitor activity.
                </p>
            </div>

            {/* Settings Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sections.map((section) => {
                    const Icon = section.icon;
                    const colors = colorClasses[section.color];

                    return (
                        <Link
                            key={section.href}
                            href={section.href}
                            className={`
                                block p-6 rounded-lg border-2 transition-all
                                hover:shadow-md hover:border-blue-400
                                ${colors.border} bg-white group
                            `}
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex items-start gap-4">
                                    <div className={`p-3 rounded-lg ${colors.bg}`}>
                                        <Icon className={`w-6 h-6 ${colors.text}`} />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                            {section.title}
                                            <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                                        </h3>
                                        <p className="text-sm text-gray-600 mt-1">
                                            {section.description}
                                        </p>
                                    </div>
                                </div>
                                {section.stat !== null && (
                                    <div className="text-right">
                                        <div className={`text-2xl font-bold ${colors.text}`}>
                                            {section.stat}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {section.statLabel}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Link>
                    );
                })}
            </div>

            {/* Quick Tips */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-3">💡 Quick Tips</h3>
                <ul className="space-y-2 text-sm text-gray-700">
                    <li className="flex items-start gap-2">
                        <span className="text-blue-500">•</span>
                        <span><strong>Projects</strong> help scope RAG queries - "Find contracts in Alpha Project"</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-purple-500">•</span>
                        <span><strong>Tags</strong> add flexible labels - "Show documents tagged urgent"</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-green-500">•</span>
                        <span><strong>Data Sources</strong> sync external content automatically</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-orange-500">•</span>
                        <span><strong>Background Jobs</strong> handle long-running tasks without timeouts</span>
                    </li>
                </ul>
            </div>
        </div>
    );
}
