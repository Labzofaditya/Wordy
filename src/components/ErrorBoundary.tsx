import { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackNavigate?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    if (this.props.fallbackNavigate) {
      this.setState({ hasError: false, error: null });
      this.props.fallbackNavigate();
    } else {
      window.location.href = '/';
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="text-xl font-semibold text-slate-800 mb-2">
              Something went wrong
            </h2>
            <p className="text-slate-600 mb-6">
              An unexpected error occurred. You can try reloading the page or go back to the dashboard.
            </p>
            {this.state.error && (
              <p className="text-sm text-slate-500 bg-slate-50 rounded-lg p-3 mb-6 font-mono break-all">
                {this.state.error.message}
              </p>
            )}
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleGoHome}
                className="flex items-center gap-2 px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <Home className="w-4 h-4" />
                Dashboard
              </button>
              <button
                onClick={this.handleReload}
                className="flex items-center gap-2 px-4 py-2 text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
