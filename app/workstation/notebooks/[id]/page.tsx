// app/workstation/notebooks/[id]/page.tsx
'use client';

import { use } from 'react';
import { NotebookEditor } from '@/components/notebooks/NotebookEditor';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface NotebookPageProps {
    params: Promise<{ id: string }>;
}

export default function NotebookPage({ params }: NotebookPageProps) {
    const { id } = use(params);

    return (
        <div className="h-screen flex flex-col bg-gray-50">
            {/* Top Navigation */}
            <div className="bg-white border-b px-4 py-2">
                <Link 
                    href="/workstation/notebooks"
                    className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Notebooks
                </Link>
            </div>

            {/* Notebook Editor */}
            <div className="flex-1 overflow-hidden">
                <NotebookEditor notebookId={id} />
            </div>
        </div>
    );
}
