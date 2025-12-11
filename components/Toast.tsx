// components/Toast.tsx
// Toast notification system with context provider
'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { X, CheckCircle, XCircle, AlertTriangle, Info, Loader2 } from 'lucide-react';

// Types
type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';

interface Toast {
    id: string;
    type: ToastType;
    title: string;
    message?: string;
    duration?: number;
    action?: {
        label: string;
        onClick: () => void;
    };
}

interface ToastContextValue {
    toasts: Toast[];
    toast: (options: Omit<Toast, 'id'>) => string;
    success: (title: string, message?: string) => string;
    error: (title: string, message?: string) => string;
    warning: (title: string, message?: string) => string;
    info: (title: string, message?: string) => string;
    loading: (title: string, message?: string) => string;
    dismiss: (id: string) => void;
    dismissAll: () => void;
    update: (id: string, options: Partial<Omit<Toast, 'id'>>) => void;
}

// Context
const ToastContext = createContext<ToastContextValue | undefined>(undefined);

// Icons
const TOAST_ICONS: Record<ToastType, ReactNode> = {
    success: <CheckCircle className="w-5 h-5 text-green-500" />,
    error: <XCircle className="w-5 h-5 text-red-500" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-500" />,
    info: <Info className="w-5 h-5 text-blue-500" />,
    loading: <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />,
};

// Styles
const TOAST_STYLES: Record<ToastType, string> = {
    success: 'bg-green-50 border-green-200',
    error: 'bg-red-50 border-red-200',
    warning: 'bg-amber-50 border-amber-200',
    info: 'bg-blue-50 border-blue-200',
    loading: 'bg-blue-50 border-blue-200',
};

// Default durations
const DEFAULT_DURATIONS: Record<ToastType, number> = {
    success: 3000,
    error: 5000,
    warning: 4000,
    info: 3000,
    loading: Infinity, // Loading toasts don't auto-dismiss
};

// Provider
export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const generateId = () => `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const dismiss = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const dismissAll = useCallback(() => {
        setToasts([]);
    }, []);

    const toast = useCallback((options: Omit<Toast, 'id'>): string => {
        const id = generateId();
        const duration = options.duration ?? DEFAULT_DURATIONS[options.type];

        const newToast: Toast = {
            id,
            ...options,
            duration,
        };

        setToasts((prev) => [...prev, newToast]);

        // Auto-dismiss
        if (duration !== Infinity) {
            setTimeout(() => dismiss(id), duration);
        }

        return id;
    }, [dismiss]);

    const update = useCallback((id: string, options: Partial<Omit<Toast, 'id'>>) => {
        setToasts((prev) =>
            prev.map((t) => (t.id === id ? { ...t, ...options } : t))
        );

        // If updating to a non-loading type, set auto-dismiss
        if (options.type && options.type !== 'loading') {
            const duration = options.duration ?? DEFAULT_DURATIONS[options.type];
            if (duration !== Infinity) {
                setTimeout(() => dismiss(id), duration);
            }
        }
    }, [dismiss]);

    const success = useCallback((title: string, message?: string) => {
        return toast({ type: 'success', title, message });
    }, [toast]);

    const error = useCallback((title: string, message?: string) => {
        return toast({ type: 'error', title, message });
    }, [toast]);

    const warning = useCallback((title: string, message?: string) => {
        return toast({ type: 'warning', title, message });
    }, [toast]);

    const info = useCallback((title: string, message?: string) => {
        return toast({ type: 'info', title, message });
    }, [toast]);

    const loading = useCallback((title: string, message?: string) => {
        return toast({ type: 'loading', title, message });
    }, [toast]);

    const value: ToastContextValue = {
        toasts,
        toast,
        success,
        error,
        warning,
        info,
        loading,
        dismiss,
        dismissAll,
        update,
    };

    return (
        <ToastContext.Provider value={value}>
            {children}
            <ToastContainer toasts={toasts} dismiss={dismiss} />
        </ToastContext.Provider>
    );
}

// Hook
export function useToast(): ToastContextValue {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}

// Toast Container
function ToastContainer({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: string) => void }) {
    if (toasts.length === 0) return null;

    return (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
            {toasts.map((toast) => (
                <ToastItem key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
            ))}
        </div>
    );
}

// Individual Toast
function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
    return (
        <div
            className={`
                pointer-events-auto
                flex items-start gap-3 p-4 rounded-lg border shadow-lg
                animate-in slide-in-from-right-full fade-in duration-300
                ${TOAST_STYLES[toast.type]}
            `}
            role="alert"
        >
            <div className="flex-shrink-0 mt-0.5">
                {TOAST_ICONS[toast.type]}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{toast.title}</p>
                {toast.message && (
                    <p className="text-sm text-gray-600 mt-0.5">{toast.message}</p>
                )}
                {toast.action && (
                    <button
                        onClick={() => {
                            toast.action!.onClick();
                            onDismiss();
                        }}
                        className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-700"
                    >
                        {toast.action.label}
                    </button>
                )}
            </div>
            {toast.type !== 'loading' && (
                <button
                    onClick={onDismiss}
                    className="flex-shrink-0 p-1 hover:bg-black/5 rounded transition-colors"
                >
                    <X className="w-4 h-4 text-gray-400" />
                </button>
            )}
        </div>
    );
}

// Simple standalone toast function (for use outside React context)
let toastRef: ToastContextValue | null = null;

export function setToastRef(ref: ToastContextValue) {
    toastRef = ref;
}

export const standaloneToast = {
    success: (title: string, message?: string) => toastRef?.success(title, message),
    error: (title: string, message?: string) => toastRef?.error(title, message),
    warning: (title: string, message?: string) => toastRef?.warning(title, message),
    info: (title: string, message?: string) => toastRef?.info(title, message),
    loading: (title: string, message?: string) => toastRef?.loading(title, message),
    dismiss: (id: string) => toastRef?.dismiss(id),
    dismissAll: () => toastRef?.dismissAll(),
};
