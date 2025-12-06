// config/toolkits.ts
// Type definitions and configuration for Toolkit Marketplace

// ============================================
// TYPES
// ============================================

export interface ToolkitCatalog {
    id: string;
    composio_app_id: string;
    name: string;
    slug: string;
    description: string;
    icon_url: string;
    banner_url?: string;
    category: ToolkitCategory;
    tags: string[];
    tool_count: number;
    available_actions: string[];
    available_triggers: string[];
    auth_type: AuthType;
    auth_config: Record<string, any>;
    is_active: boolean;
    is_featured: boolean;
    is_official: boolean;
    install_count: number;
    rating?: number;
    documentation_url?: string;
    support_url?: string;
    pricing_info?: string;
    last_synced_at?: string;
    created_at: string;
    updated_at: string;
}

export interface UserToolkit {
    id: string;
    user_id: string;
    toolkit_id?: string;
    custom_name?: string;
    custom_mcp_url?: string;
    custom_config: Record<string, any>;
    is_connected: boolean;
    connection_id?: string;
    connected_account?: Record<string, any>;
    enabled_actions: string[];
    disabled_actions: string[];
    last_used_at?: string;
    usage_count: number;
    status: ToolkitStatus;
    error_message?: string;
    installed_at: string;
    updated_at: string;
    
    // Joined from catalog
    name?: string;
    slug?: string;
    description?: string;
    icon_url?: string;
    category?: string;
    auth_type?: string;
    tool_count?: number;
}

export type ToolkitCategory = 
    | 'crm'
    | 'email'
    | 'productivity'
    | 'social'
    | 'analytics'
    | 'storage'
    | 'development'
    | 'finance'
    | 'marketing'
    | 'support'
    | 'hr'
    | 'custom';

export type AuthType = 'oauth2' | 'api_key' | 'basic' | 'none';

export type ToolkitStatus = 'pending' | 'connected' | 'error' | 'disabled';

// ============================================
// CATEGORY CONFIGURATION
// ============================================

export const TOOLKIT_CATEGORIES: Record<ToolkitCategory, {
    name: string;
    description: string;
    icon: string;
}> = {
    crm: { name: 'CRM & Sales', description: 'Customer relationship management tools', icon: '💼' },
    email: { name: 'Email & Communication', description: 'Email and messaging platforms', icon: '📧' },
    productivity: { name: 'Productivity', description: 'Task management and collaboration', icon: '✅' },
    social: { name: 'Social Media', description: 'Social media management tools', icon: '📱' },
    analytics: { name: 'Analytics', description: 'Data and analytics platforms', icon: '📊' },
    storage: { name: 'Storage & Files', description: 'Cloud storage and file management', icon: '📁' },
    development: { name: 'Development', description: 'Developer tools and APIs', icon: '💻' },
    finance: { name: 'Finance', description: 'Accounting and payment tools', icon: '💰' },
    marketing: { name: 'Marketing', description: 'Marketing automation tools', icon: '📈' },
    support: { name: 'Customer Support', description: 'Help desk and support tools', icon: '🎧' },
    hr: { name: 'HR & Recruiting', description: 'Human resources tools', icon: '👥' },
    custom: { name: 'Custom', description: 'Custom MCP integrations', icon: '🔧' },
};

// ============================================
// AUTH TYPE CONFIGURATION
// ============================================

export const AUTH_TYPE_CONFIG: Record<AuthType, {
    label: string;
    description: string;
    icon: string;
}> = {
    oauth2: { 
        label: 'OAuth 2.0', 
        description: 'Sign in with your account', 
        icon: '🔐' 
    },
    api_key: { 
        label: 'API Key', 
        description: 'Provide your API key', 
        icon: '🔑' 
    },
    basic: { 
        label: 'Basic Auth', 
        description: 'Username and password', 
        icon: '👤' 
    },
    none: { 
        label: 'No Auth', 
        description: 'No authentication required', 
        icon: '✅' 
    },
};

// ============================================
// STATUS CONFIGURATION
// ============================================

export const TOOLKIT_STATUS_CONFIG: Record<ToolkitStatus, {
    label: string;
    color: string;
    icon: string;
}> = {
    pending: { label: 'Pending', color: 'yellow', icon: '🟡' },
    connected: { label: 'Connected', color: 'green', icon: '🟢' },
    error: { label: 'Error', color: 'red', icon: '🔴' },
    disabled: { label: 'Disabled', color: 'gray', icon: '⚫' },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getToolkitDisplayName(toolkit: UserToolkit): string {
    return toolkit.name || toolkit.custom_name || 'Unknown Toolkit';
}

export function isToolkitReady(toolkit: UserToolkit): boolean {
    return toolkit.status === 'connected' && toolkit.is_connected;
}
