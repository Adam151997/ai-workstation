// components/Skeleton.tsx
// Reusable skeleton loading components
'use client';

import React from 'react';

interface SkeletonProps {
    className?: string;
}

// Base skeleton with pulse animation
export function Skeleton({ className = '' }: SkeletonProps) {
    return (
        <div
            className={`animate-pulse bg-gray-200 rounded ${className}`}
        />
    );
}

// Text line skeleton
export function SkeletonText({ lines = 1, className = '' }: { lines?: number; className?: string }) {
    return (
        <div className={`space-y-2 ${className}`}>
            {Array.from({ length: lines }).map((_, i) => (
                <Skeleton 
                    key={i} 
                    className={`h-4 ${i === lines - 1 && lines > 1 ? 'w-3/4' : 'w-full'}`} 
                />
            ))}
        </div>
    );
}

// Avatar skeleton
export function SkeletonAvatar({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
    const sizes = {
        sm: 'w-8 h-8',
        md: 'w-10 h-10',
        lg: 'w-12 h-12',
    };
    return <Skeleton className={`${sizes[size]} rounded-full`} />;
}

// Button skeleton
export function SkeletonButton({ width = 'w-24' }: { width?: string }) {
    return <Skeleton className={`h-9 ${width} rounded-lg`} />;
}

// Card skeleton
export function SkeletonCard({ className = '' }: SkeletonProps) {
    return (
        <div className={`bg-white rounded-lg border p-4 ${className}`}>
            <div className="flex items-center gap-3 mb-4">
                <SkeletonAvatar />
                <div className="flex-1">
                    <Skeleton className="h-4 w-1/3 mb-2" />
                    <Skeleton className="h-3 w-1/2" />
                </div>
            </div>
            <SkeletonText lines={3} />
        </div>
    );
}

// Table row skeleton
export function SkeletonTableRow({ columns = 4 }: { columns?: number }) {
    return (
        <tr className="border-b">
            {Array.from({ length: columns }).map((_, i) => (
                <td key={i} className="px-4 py-3">
                    <Skeleton className="h-4 w-full" />
                </td>
            ))}
        </tr>
    );
}

// Table skeleton
export function SkeletonTable({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
    return (
        <div className="bg-white rounded-lg border overflow-hidden">
            <table className="w-full">
                <thead className="bg-gray-50 border-b">
                    <tr>
                        {Array.from({ length: columns }).map((_, i) => (
                            <th key={i} className="px-4 py-3 text-left">
                                <Skeleton className="h-4 w-20" />
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {Array.from({ length: rows }).map((_, i) => (
                        <SkeletonTableRow key={i} columns={columns} />
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// List item skeleton
export function SkeletonListItem() {
    return (
        <div className="flex items-center gap-4 p-4 border-b">
            <Skeleton className="w-10 h-10 rounded-lg" />
            <div className="flex-1">
                <Skeleton className="h-4 w-1/3 mb-2" />
                <Skeleton className="h-3 w-2/3" />
            </div>
            <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
    );
}

// List skeleton
export function SkeletonList({ items = 5 }: { items?: number }) {
    return (
        <div className="bg-white rounded-lg border">
            {Array.from({ length: items }).map((_, i) => (
                <SkeletonListItem key={i} />
            ))}
        </div>
    );
}

// Stats card skeleton
export function SkeletonStatsCard() {
    return (
        <div className="bg-white rounded-lg border p-4">
            <Skeleton className="h-8 w-16 mb-2" />
            <Skeleton className="h-4 w-24" />
        </div>
    );
}

// Stats grid skeleton
export function SkeletonStatsGrid({ count = 4 }: { count?: number }) {
    return (
        <div className={`grid grid-cols-${count} gap-4`}>
            {Array.from({ length: count }).map((_, i) => (
                <SkeletonStatsCard key={i} />
            ))}
        </div>
    );
}

// Chat message skeleton
export function SkeletonChatMessage({ isUser = false }: { isUser?: boolean }) {
    return (
        <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
            <SkeletonAvatar size="sm" />
            <div className={`max-w-[70%] ${isUser ? 'items-end' : ''}`}>
                <Skeleton className={`h-20 w-64 rounded-lg ${isUser ? 'bg-blue-100' : 'bg-gray-200'}`} />
                <Skeleton className="h-3 w-16 mt-1" />
            </div>
        </div>
    );
}

// Chat skeleton
export function SkeletonChat({ messages = 4 }: { messages?: number }) {
    return (
        <div className="space-y-4 p-4">
            {Array.from({ length: messages }).map((_, i) => (
                <SkeletonChatMessage key={i} isUser={i % 2 === 1} />
            ))}
        </div>
    );
}

// Document card skeleton
export function SkeletonDocumentCard() {
    return (
        <div className="bg-white rounded-lg border p-4">
            <div className="flex items-start gap-3">
                <Skeleton className="w-10 h-10 rounded-lg" />
                <div className="flex-1">
                    <Skeleton className="h-4 w-3/4 mb-2" />
                    <Skeleton className="h-3 w-1/2 mb-3" />
                    <div className="flex gap-2">
                        <Skeleton className="h-5 w-16 rounded-full" />
                        <Skeleton className="h-5 w-20 rounded-full" />
                    </div>
                </div>
            </div>
        </div>
    );
}

// Document grid skeleton
export function SkeletonDocumentGrid({ count = 6 }: { count?: number }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: count }).map((_, i) => (
                <SkeletonDocumentCard key={i} />
            ))}
        </div>
    );
}

// Workflow node skeleton
export function SkeletonWorkflowNode() {
    return (
        <div className="bg-white rounded-lg border-2 border-gray-200 p-4 max-w-md">
            <div className="flex items-center gap-3">
                <Skeleton className="w-4 h-8" />
                <Skeleton className="w-10 h-10 rounded-lg" />
                <div className="flex-1">
                    <Skeleton className="h-4 w-1/2 mb-2" />
                    <Skeleton className="h-3 w-1/3" />
                </div>
                <Skeleton className="w-8 h-8 rounded" />
            </div>
        </div>
    );
}

// Form skeleton
export function SkeletonForm({ fields = 4 }: { fields?: number }) {
    return (
        <div className="space-y-4">
            {Array.from({ length: fields }).map((_, i) => (
                <div key={i}>
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-10 w-full rounded-lg" />
                </div>
            ))}
            <Skeleton className="h-10 w-32 rounded-lg mt-6" />
        </div>
    );
}

// Page header skeleton
export function SkeletonPageHeader() {
    return (
        <div className="bg-white rounded-lg border p-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Skeleton className="w-8 h-8 rounded-lg" />
                    <div>
                        <Skeleton className="h-6 w-48 mb-2" />
                        <Skeleton className="h-4 w-64" />
                    </div>
                </div>
                <div className="flex gap-2">
                    <SkeletonButton width="w-24" />
                    <SkeletonButton width="w-32" />
                </div>
            </div>
        </div>
    );
}

// Full page loading skeleton
export function SkeletonPage() {
    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <SkeletonPageHeader />
            <div className="grid grid-cols-4 gap-4">
                <SkeletonStatsCard />
                <SkeletonStatsCard />
                <SkeletonStatsCard />
                <SkeletonStatsCard />
            </div>
            <SkeletonTable rows={5} columns={5} />
        </div>
    );
}
