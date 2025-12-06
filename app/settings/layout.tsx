// app/settings/layout.tsx
// Settings layout with navigation sidebar - Advanced Theme
'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
    Settings, 
    Wrench, 
    FolderKanban, 
    Tags, 
    Database, 
    Activity,
    ChevronLeft,
    Zap,
    BarChart3,
    CreditCard,
    Store
} from 'lucide-react';

const settingsNav = [
    {
        name: 'Toolkit Store',
        href: '/settings/toolkit-store',
        icon: Store,
        description: 'Install app integrations',
    },
    {
        name: 'Observability',
        href: '/settings/observability',
        icon: BarChart3,
        description: 'Usage metrics & analytics',
    },
    {
        name: 'Billing',
        href: '/settings/billing',
        icon: CreditCard,
        description: 'Subscription & usage',
    },
    {
        name: 'Tools',
        href: '/settings/tools',
        icon: Wrench,
        description: 'Manage your AI toolkit',
    },
    {
        name: 'Projects',
        href: '/settings/projects',
        icon: FolderKanban,
        description: 'Organize documents by project',
    },
    {
        name: 'Tags',
        href: '/settings/tags',
        icon: Tags,
        description: 'Create and manage tags',
    },
    {
        name: 'Data Sources',
        href: '/settings/data-sources',
        icon: Database,
        description: 'Connect external data',
    },
    {
        name: 'Background Jobs',
        href: '/settings/jobs',
        icon: Zap,
        description: 'View running tasks',
    },
    {
        name: 'Activity',
        href: '/settings/activity',
        icon: Activity,
        description: 'View audit logs',
    },
];

export default function SettingsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();

    return (
        <div style={{ minHeight: 'calc(100vh - 64px)', background: 'var(--bg-primary)' }}>
            {/* Top Navigation Bar */}
            <div className="border-b" style={{ background: 'var(--surface-primary)', borderColor: 'var(--border-primary)' }}>
                <div className="flex items-center gap-4 max-w-[1400px] mx-auto px-6 py-4">
                    <Link href="/workstation" 
                        className="flex items-center gap-2 px-3 py-2 rounded-lg font-display text-sm font-medium transition-all hover:bg-[var(--surface-hover)]"
                        style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>
                        <ChevronLeft className="w-4 h-4" />
                        <span>Workstation</span>
                    </Link>
                    <div className="w-px h-6" style={{ background: 'var(--border-primary)' }} />
                    <div className="flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                        <Settings className="w-5 h-5" />
                        <h1 className="font-display text-sm font-semibold tracking-widest m-0">SETTINGS</h1>
                    </div>
                </div>
            </div>

            <div className="flex max-w-[1400px] mx-auto px-6 py-8 gap-8">
                {/* Sidebar Navigation */}
                <nav className="w-[280px] flex-shrink-0">
                    <div className="sticky top-20 rounded-xl border overflow-hidden" style={{ background: 'var(--surface-primary)', borderColor: 'var(--border-primary)' }}>
                        <div className="px-5 py-4 border-b font-display text-[11px] font-semibold tracking-widest" 
                            style={{ borderColor: 'var(--border-primary)', color: 'var(--text-tertiary)' }}>
                            CONFIGURATION
                        </div>
                        <ul className="p-2 list-none m-0">
                            {settingsNav.map((item) => {
                                const isActive = pathname === item.href;
                                const Icon = item.icon;
                                
                                return (
                                    <li key={item.href} className="mb-1">
                                        <Link
                                            href={item.href}
                                            className="flex items-center gap-3 px-4 py-3 rounded-lg transition-all relative"
                                            style={{ 
                                                textDecoration: 'none',
                                                background: isActive ? 'var(--accent-muted)' : 'transparent',
                                            }}
                                        >
                                            <Icon className="w-5 h-5 flex-shrink-0" style={{ color: isActive ? 'var(--accent-primary)' : 'var(--text-tertiary)' }} />
                                            <div className="flex flex-col min-w-0">
                                                <span className="font-display text-sm font-medium" style={{ color: isActive ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                                                    {item.name}
                                                </span>
                                                <span className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                                                    {item.description}
                                                </span>
                                            </div>
                                            {isActive && (
                                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[60%] rounded-r"
                                                    style={{ background: 'var(--accent-primary)', boxShadow: '0 0 8px var(--accent-glow)' }} />
                                            )}
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                </nav>

                {/* Main Content */}
                <main className="flex-1 min-w-0">
                    {children}
                </main>
            </div>
        </div>
    );
}
