import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
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

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full flex items-center justify-center bg-slate-950 p-8">
          <div className="glass-card p-8 max-w-lg text-center">
            <h2 className="text-lg font-semibold text-red-400 mb-2">Something went wrong</h2>
            <p className="text-sm text-slate-400 mb-4 font-mono">{this.state.error?.message}</p>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-xl cursor-pointer"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
