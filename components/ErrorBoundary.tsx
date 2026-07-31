'use client';
import { Component, ErrorInfo, ReactNode } from 'react';

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { hasError: boolean; }

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          minHeight: '200px', padding: '40px 24px', textAlign: 'center',
        }}>
          <div>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>⚠️</div>
            <div style={{ color: '#FFFFFF', fontWeight: 700, fontSize: '16px', marginBottom: '8px' }}>Something went wrong</div>
            <div style={{ color: '#CBD5E1', fontSize: '14px', marginBottom: '20px' }}>Please refresh the page to continue.</div>
            <button onClick={() => window.location.reload()}
              style={{ padding: '10px 24px', background: 'linear-gradient(135deg,#F59E0B,#FBBF24)', border: 'none', borderRadius: '8px', color: '#1C1C1E', fontWeight: 700, cursor: 'pointer', fontSize: '14px' }}>
              Refresh Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
