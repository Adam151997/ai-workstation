// components/ArtifactRenderer.tsx
'use client';

import { useMemo } from 'react';
import { LeadsArtifact, LeadsSchema } from '@/config/schemas/leads';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table'; // Placeholder for shadcn table

interface ArtifactRendererProps {
    artifact: LeadsArtifact | null;
    status: 'idle' | 'running' | 'complete' | 'error';
}

// Dummy shadcn components for demonstration (assuming they are set up)
const LeadsTable = ({ leads }: { leads: LeadsArtifact['leads'] }) => (
    <Table>
        <TableHeader>
            <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Source</TableHead>
            </TableRow>
        </TableHeader>
        <TableBody>
            {leads.map((lead) => (
                <TableRow key={lead.id}>
                    <TableCell>{lead.id}</TableCell>
                    <TableCell className="font-medium">{lead.name}</TableCell>
                    <TableCell>{lead.score}</TableCell>
                    <TableCell>{lead.status}</TableCell>
                    <TableCell>{lead.source}</TableCell>
                </TableRow>
            ))}
        </TableBody>
    </Table>
);


export function ArtifactRenderer({ artifact, status }: ArtifactRendererProps) {
    // You would use Zod to identify the artifact type here (e.g., Leads, Form, Chart)
    const artifactType = useMemo(() => {
        // For now, we only handle Leads
        try {
            if (artifact && LeadsSchema.safeParse(artifact).success) {
                return 'LeadsTable';
            }
        } catch (e) {
            // Ignore parsing errors for partial streams
        }
        return null;
    }, [artifact]);

    if (status === 'running') {
        return <div className="p-4 text-center text-gray-500">Generating Artifact...</div>;
    }

    if (!artifactType) {
        return <div className="p-4 text-center text-gray-400">Artifact Workspace: No active data to display.</div>;
    }

    // Render the specific artifact component
    if (artifactType === 'LeadsTable' && artifact && artifact.leads) {
        return (
            <div className="p-4 border rounded-lg shadow-lg bg-white">
                <h2 className="text-xl font-bold mb-4">Generated Leads Report</h2>
                <LeadsTable leads={artifact.leads} />
            </div>
        );
    }

    return null;
}