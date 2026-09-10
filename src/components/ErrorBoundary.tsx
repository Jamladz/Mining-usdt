import React, { ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  declare props: Props;
  state: State = {
    hasError: false
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in React component tree:', error, errorInfo);
  }

  handleReload = () => {
    try {
      localStorage.removeItem('usdt_miner_user_data');
    } catch (e) {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F5F7F9] flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-white rounded-3xl p-6 border border-slate-150 shadow-xl max-w-sm w-full space-y-4">
            <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 mx-auto">
              <AlertCircle className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-black text-slate-900">Application Notice</h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                A temporary display glitch occurred. Tap below to refresh and restore your active session.
              </p>
            </div>
            <button
              onClick={this.handleReload}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reload Application</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
