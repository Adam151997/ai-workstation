// components/Header.tsx
'use client';

import Link from 'next/link';
import { useTheme } from './theme-context';
import { UserButton, SignedIn, SignedOut, SignInButton } from '@clerk/nextjs';
import { Sun, Moon, Terminal, Cpu } from 'lucide-react';

export function Header() {
    const { theme, toggleTheme } = useTheme();

    return (
        <header className="sticky top-0 z-50 border-b"
            style={{
                background: 'var(--glass-bg)',
                backdropFilter: 'blur(var(--glass-blur))',
                WebkitBackdropFilter: 'blur(var(--glass-blur))',
                borderColor: 'var(--border-primary)',
            }}>
            <div className="flex items-center justify-between h-16 px-6 max-w-[1920px] mx-auto">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                    <div className="flex items-center justify-center w-9 h-9 rounded-lg text-white"
                        style={{
                            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-intense))',
                            boxShadow: 'var(--shadow-glow)',
                        }}>
                        <Cpu className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-display text-sm font-semibold tracking-widest"
                            style={{ color: 'var(--text-primary)' }}>
                            AI WORKSTATION
                        </span>
                        <span className="font-mono text-[10px] tracking-wide"
                            style={{ color: 'var(--accent-primary)' }}>
                            v2.0
                        </span>
                    </div>
                </Link>

                {/* Navigation */}
                <nav className="hidden md:flex items-center gap-2">
                    <Link href="/workstation" 
                        className="flex items-center gap-2 px-4 py-2 rounded-lg font-display text-sm font-medium transition-all hover:bg-[var(--surface-hover)]"
                        style={{ color: 'var(--text-secondary)' }}>
                        <Terminal className="w-4 h-4" />
                        <span>Workstation</span>
                    </Link>
                    <Link href="/settings"
                        className="flex items-center gap-2 px-4 py-2 rounded-lg font-display text-sm font-medium transition-all hover:bg-[var(--surface-hover)]"
                        style={{ color: 'var(--text-secondary)' }}>
                        <span>Settings</span>
                    </Link>
                </nav>

                {/* Right Section */}
                <div className="flex items-center gap-4">
                    {/* Theme Toggle */}
                    <button
                        onClick={toggleTheme}
                        className="relative flex items-center w-14 h-7 rounded-full border transition-all hover:border-[var(--accent-primary)]"
                        style={{
                            background: 'var(--surface-secondary)',
                            borderColor: 'var(--border-primary)',
                        }}
                        aria-label="Toggle theme"
                    >
                        <Sun className="absolute left-1.5 w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
                        <Moon className="absolute right-1.5 w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
                        <div 
                            className="absolute w-5 h-5 rounded-full transition-transform duration-200"
                            style={{
                                background: 'var(--accent-primary)',
                                boxShadow: '0 0 8px var(--accent-glow)',
                                left: '3px',
                                transform: theme === 'dark' ? 'translateX(28px)' : 'translateX(0)',
                            }}
                        />
                    </button>

                    {/* User */}
                    <SignedIn>
                        <UserButton 
                            afterSignOutUrl="/"
                            appearance={{
                                elements: {
                                    avatarBox: "w-9 h-9 ring-2 ring-[var(--border-primary)] hover:ring-[var(--accent-primary)] transition-all"
                                }
                            }}
                        />
                    </SignedIn>
                    <SignedOut>
                        <SignInButton mode="modal">
                            <button className="btn-accent text-sm">
                                Sign In
                            </button>
                        </SignInButton>
                    </SignedOut>
                </div>
            </div>
        </header>
    );
}
