// config/notebooks.ts
// Type definitions and configuration for Business Notebooks

// ============================================
// CELL TYPES
// ============================================

export type CellType = 
    | 'command'      // Natural language command to execute
    | 'query'        // Data retrieval / RAG query
    | 'transform'    // Data transformation
    | 'visualize'    // Generate chart/table/artifact
    | 'approve'      // Human-in-the-loop gate
    | 'condition'    // Branching logic
    | 'note';        // Markdown notes (no execution)

export type CellStatus = 
    | 'idle'         // Not yet run
    | 'queued'       // Waiting for dependencies
    | 'running'      // Currently executing
    | 'paused'       // Paused by user (approve cells)
    | 'completed'    // Successfully finished
    | 'error'        // Failed
    | 'skipped';     // Skipped due to condition

export type NotebookStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error';

export type OutputType = 'text' | 'json' | 'table' | 'chart' | 'artifact' | 'error';

// ============================================
// INTERFACES
// ============================================

export interface NotebookCell {
    id: string;
    notebook_id: string;
    user_id: string;
    cell_index: number;
    cell_type: CellType;
    title?: string;
    content: string;
    dependencies: string[];
    agent_preference?: string;
    timeout_ms: number;
    retry_on_error: boolean;
    max_retries: number;
    status: CellStatus;
    output?: any;
    output_type?: OutputType;
    artifact_id?: string;
    agent_used?: string;
    tools_used: string[];
    execution_log: any[];
    reasoning?: string;
    tokens_input: number;
    tokens_output: number;
    cost: number;
    duration_ms?: number;
    started_at?: string;
    completed_at?: string;
    error_message?: string;
    error_details?: any;
    created_at: string;
    updated_at: string;
}

export interface Notebook {
    id: string;
    user_id: string;
    title: string;
    description?: string;
    icon: string;
    project_id?: string;
    tags: string[];
    is_template: boolean;
    is_public: boolean;
    shared_with: string[];
    status: NotebookStatus;
    last_run_at?: string;
    last_run_duration_ms?: number;
    created_at: string;
    updated_at: string;
    cells?: NotebookCell[];
    cell_count?: number;
    run_count?: number;
}

export interface NotebookRun {
    id: string;
    notebook_id: string;
    user_id: string;
    run_number: number;
    trigger_type: 'manual' | 'scheduled' | 'webhook' | 'api';
    status: 'running' | 'completed' | 'failed' | 'cancelled';
    cells_total: number;
    cells_completed: number;
    cells_failed: number;
    cells_skipped: number;
    cell_results: Record<string, any>;
    total_tokens: number;
    total_cost: number;
    duration_ms?: number;
    started_at: string;
    completed_at?: string;
    error_cell_id?: string;
    error_message?: string;
}

export interface NotebookTemplate {
    id: string;
    name: string;
    description?: string;
    icon: string;
    category?: string;
    cells_template: Array<{
        type: CellType;
        title?: string;
        content: string;
    }>;
    variables: Array<{
        name: string;
        type: 'text' | 'number' | 'select' | 'date';
        required?: boolean;
        default?: any;
        options?: string[];
    }>;
    author_id?: string;
    author_name?: string;
    is_official: boolean;
    is_public: boolean;
    usage_count: number;
    rating?: number;
    created_at: string;
    updated_at: string;
}

// ============================================
// CELL TYPE CONFIGURATION
// ============================================

export const CELL_TYPE_CONFIG: Record<CellType, {
    label: string;
    icon: string;
    description: string;
    color: string;
    canHaveDependencies: boolean;
    hasOutput: boolean;
}> = {
    command: {
        label: 'Command',
        icon: '⚡',
        description: 'Execute a natural language command',
        color: 'blue',
        canHaveDependencies: true,
        hasOutput: true,
    },
    query: {
        label: 'Query',
        icon: '🔍',
        description: 'Retrieve data from connected sources',
        color: 'purple',
        canHaveDependencies: true,
        hasOutput: true,
    },
    transform: {
        label: 'Transform',
        icon: '🔄',
        description: 'Transform data from previous cells',
        color: 'orange',
        canHaveDependencies: true,
        hasOutput: true,
    },
    visualize: {
        label: 'Visualize',
        icon: '📊',
        description: 'Create charts, tables, or documents',
        color: 'green',
        canHaveDependencies: true,
        hasOutput: true,
    },
    approve: {
        label: 'Approve',
        icon: '✋',
        description: 'Pause for human approval before continuing',
        color: 'yellow',
        canHaveDependencies: true,
        hasOutput: false,
    },
    condition: {
        label: 'Condition',
        icon: '🔀',
        description: 'Branch based on a condition',
        color: 'pink',
        canHaveDependencies: true,
        hasOutput: true,
    },
    note: {
        label: 'Note',
        icon: '📝',
        description: 'Add markdown notes (not executed)',
        color: 'gray',
        canHaveDependencies: false,
        hasOutput: false,
    },
};

// ============================================
// STATUS CONFIGURATION
// ============================================

export const CELL_STATUS_CONFIG: Record<CellStatus, {
    label: string;
    icon: string;
    color: string;
}> = {
    idle: { label: 'Idle', icon: '⚪', color: 'gray' },
    queued: { label: 'Queued', icon: '🔵', color: 'blue' },
    running: { label: 'Running', icon: '🟡', color: 'yellow' },
    paused: { label: 'Paused', icon: '🟠', color: 'orange' },
    completed: { label: 'Completed', icon: '🟢', color: 'green' },
    error: { label: 'Error', icon: '🔴', color: 'red' },
    skipped: { label: 'Skipped', icon: '⚫', color: 'gray' },
};

// ============================================
// TEMPLATE CATEGORIES
// ============================================

export const TEMPLATE_CATEGORIES = [
    { id: 'sales', label: 'Sales', icon: '💰' },
    { id: 'marketing', label: 'Marketing', icon: '📈' },
    { id: 'ops', label: 'Operations', icon: '⚙️' },
    { id: 'finance', label: 'Finance', icon: '💵' },
    { id: 'hr', label: 'HR', icon: '👥' },
    { id: 'product', label: 'Product', icon: '🚀' },
    { id: 'research', label: 'Research', icon: '🔬' },
    { id: 'custom', label: 'Custom', icon: '🎨' },
];
