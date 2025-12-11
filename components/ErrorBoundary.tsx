// components/ErrorBoundary.tsx
// Global error boundary for catching React errors
'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import { Button } from './ui/button';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        console.error('[ErrorBoundary] Caught error:', error);
        console.error('[ErrorBoundary] Error info:', errorInfo);
        
        this.setState({ errorInfo });
        
        // Call optional error handler
        this.props.onError?.(error, errorInfo);

        // Log to server (you could send to an error tracking service)
        this.logErrorToServer(error, errorInfo);
    }

    logErrorToServer = async (error: Error, errorInfo: ErrorInfo) => {
        try {
            await fetch('/api/errors/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: error.message,
                    stack: error.stack,
                    componentStack: errorInfo.componentStack,
                    url: window.location.href,
                    userAgent: navigator.userAgent,
                    timestamp: new Date().toISOString(),
                }),
            });
        } catch (e) {
            // Silently fail - don't want error logging to cause more errors
            console.error('[ErrorBoundary] Failed to log error:', e);
        }
    };

    handleReset = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    handleReload = () => {
        window.location.reload();
    };

    handleGoHome = () => {
        window.location.href = '/workstation';
    };

    render() {
        if (this.state.hasError) {
            // Custom fallback provided
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default error UI
            return (
                <div className="min-h-[400px] flex items-center justify-center p-8">
                    <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-red-100 p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-red-100 rounded-full">
                                <AlertTriangle className="w-6 h-6 text-red-600" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900">Something went wrong</h2>
                                <p className="text-sm text-gray-500">An unexpected error occurred</p>
                            </div>
                        </div>

                        {/* Error Details (collapsible) */}
                        {this.state.error && (
                            <details className="mb-4">
                                <summary className="text-sm text-gray-600 cursor-pointer hover:text-gray-900 flex items-center gap-2">
                                    <Bug className="w-4 h-4" />
                                    Technical Details
                                </summary>
                                <div className="mt-2 p-3 bg-gray-50 rounded-lg overflow-auto max-h-40">
                                    <p className="text-xs font-mono text-red-600 break-all">
                                        {this.state.error.message}
                                    </p>
                                    {this.state.error.stack && (
                                        <pre className="text-xs text-gray-500 mt-2 whitespace-pre-wrap">
                                            {this.state.error.stack.split('\n').slice(0, 5).join('\n')}
                                        </pre>
                                    )}
                                </div>
                            </details>
                        )}

                        {/* Actions */}
                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={this.handleReset}
                            >
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Try Again
                            </Button>
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={this.handleGoHome}
                            >
                                <Home className="w-4 h-4 mr-2" />
                                Go Home
                            </Button>
                        </div>

                        {/* Help Text */}
                        <p className="text-xs text-gray-400 mt-4 text-center">
                            If this keeps happening, try refreshing the page or contact support.
                        </p>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

// Hook for functional components to trigger errors (for testing)
export function useErrorHandler() {
    const [, setError] = React.useState();

    return React.useCallback((error: Error) => {
        setError(() => {
            throw error;
        });
    }, []);
}

// HOC for wrapping components with error boundary
export function withErrorBoundary<P extends object>(
    Component: React.ComponentType<P>,
    fallback?: ReactNode
) {
    return function WrappedComponent(props: P) {
        return (
            <ErrorBoundary fallback={fallback}>
                <Component {...props} />
            </ErrorBoundary>
        );
    };
}
