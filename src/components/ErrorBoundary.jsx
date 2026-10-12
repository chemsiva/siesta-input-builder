import { Component } from 'react';

/**
 * React Error Boundary component to prevent uncaught runtime errors
 * from crashing and blacking out the entire page.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '1.5rem',
          margin: '1rem',
          borderRadius: '8px',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid var(--error, #ef4444)',
          color: 'var(--fg, #f8fafc)',
        }}>
          <h3 style={{ color: 'var(--error, #ef4444)', margin: '0 0 0.5rem 0' }}>
            ⚠️ Something went wrong in this component
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--muted, #94a3b8)', margin: '0 0 0.8rem 0' }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => this.setState({ hasError: false, error: null })}>
            ↺ Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
