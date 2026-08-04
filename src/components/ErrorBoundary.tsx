import React, { Component } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallbackMessage?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary — catches runtime errors in child components and renders a
 * friendly fallback instead of unmounting the whole app (blank page).
 * Wrap each major view individually so failures stay isolated.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const { fallbackMessage } = this.props;
      return (
        <div className="glass rounded-2xl p-8 text-center max-w-md mx-auto my-10">
          <div className="mx-auto w-14 h-14 rounded-full bg-blood-500/10 flex items-center justify-center mb-4">
            <AlertCircle className="w-7 h-7 text-blood-500" />
          </div>
          <h2 className="text-lg font-semibold text-ink-900 mb-2">Something went wrong</h2>
          <p className="text-sm text-ink-500 mb-4">
            {fallbackMessage ?? 'An unexpected error occurred in this section. Your other data is safe.'}
          </p>
          {this.state.error && (
            <pre className="text-left text-xs bg-ink-900/5 dark:bg-white/5 rounded-lg p-3 mb-4 overflow-x-auto text-ink-600 dark:text-ink-300 whitespace-pre-wrap break-words">
              {this.state.error.message}
            </pre>
          )}
          <button
            type="button"
            onClick={this.handleReset}
            className="inline-flex items-center gap-2 rounded-full bg-blood-500 text-white px-5 py-2.5 text-sm font-medium hover:bg-blood-600 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
