import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[OmniVis] Uncaught error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="flex h-screen items-center justify-center bg-surface">
          <div className="max-w-sm rounded-lg border border-border-strong bg-surface-raised p-ds-6 text-center">
            <div className="mx-auto mb-ds-4 flex h-9 w-9 items-center justify-center rounded-full border border-rose-500/40 text-sm font-semibold text-rose-300">!</div>
            <div className="mb-ds-2 text-ds-lg font-semibold text-content">Something went wrong</div>
            <div className="mb-ds-4 text-ds-sm text-content-muted">
              {this.state.error?.message}
            </div>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="rounded-ds-md bg-primary-600 px-ds-4 py-ds-2 text-ds-sm font-medium text-white transition-colors hover:bg-primary-500"
            >
              Try Again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
