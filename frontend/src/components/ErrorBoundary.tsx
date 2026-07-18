import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional fallback UI to render instead of default error message */
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary component that catches rendering errors in child components.
 * Displays a user-friendly error message with a "Try Again" retry button.
 * Logs error details to console for debugging.
 * All interactive elements have visible focus indicators and keyboard navigation.
 * Validates: Requirements 12.1, 12.3
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.handleRetry();
    }
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
          className="flex flex-col items-center justify-center min-h-[200px] p-8 text-center"
        >
          <div className="w-16 h-16 mb-4 rounded-full bg-danger-50 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-danger-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-neutral-800 mb-2">
            Something went wrong
          </h2>
          <p className="text-neutral-600 mb-6 max-w-md">
            {this.state.error?.message ||
              'An unexpected error occurred. Please try again. If the problem persists, refresh the page.'}
          </p>
          <button
            onClick={this.handleRetry}
            onKeyDown={this.handleKeyDown}
            className="px-6 py-2 rounded-lg bg-primary-600 text-white font-medium text-sm hover:bg-primary-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 transition-colors"
            aria-label="Try again to recover from error"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
