import React from 'react';
import { RotateCcw } from 'lucide-react';

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || 'An unexpected error occurred.',
    };
  }

  componentDidCatch(error: Error) {
    console.error('Ludo Crown ErrorBoundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      let displayDetail = this.state.errorMessage;
      try {
        const parsed = JSON.parse(this.state.errorMessage);
        if (parsed.error) {
          displayDetail = `${parsed.operationType?.toUpperCase() || 'SYNC'} error on ${parsed.path || 'database'}: ${parsed.error}`;
        }
      } catch {
        // plain error string
      }

      return (
        <div className="min-h-screen bg-[#0B231B] text-[#F5F2EB] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-[#123026] border border-[#2B5343] rounded-xl p-8">
            <h1 className="font-display text-2xl font-semibold text-[#F5F2EB]">
              Table Session Interrupted
            </h1>
            <p className="mt-3 text-sm text-[#B8C9C1] leading-relaxed">
              We ran into a sync or runtime issue while updating your game state. Your saved profile
              and coins remain safe.
            </p>
            <div className="mt-4 p-3 rounded-lg bg-[#0A1E17] border border-[#234537] text-xs font-mono text-[#E2C275] break-words">
              {displayDetail}
            </div>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, errorMessage: '' });
                window.location.reload();
              }}
              className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#D4A446] text-[#0B231B] font-semibold text-sm hover:bg-[#E1B45B] transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Reload Table
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
