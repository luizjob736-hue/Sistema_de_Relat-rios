import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children?: ReactNode;
  key?: string | number;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  props: Props;
  state: State;

  constructor(props: Props) {
    super(props);
    this.props = props;
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error in application:", error, errorInfo);
  }

  handleReset = () => {
    (this as any).setState({ hasError: false, error: undefined });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F2F1EB] flex flex-col items-center justify-center p-6 text-[#141414] font-sans">
          <div className="bg-white border-4 border-[#141414] shadow-[8px_8px_0px_rgba(0,0,0,1)] p-8 max-w-lg w-full text-center">
            <div className="w-12 h-12 bg-red-100 border-2 border-[#141414] text-red-700 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={24} />
            </div>
            <h2 className="text-xl font-black uppercase tracking-tight mb-2">Ops! Algo deu errado nesta guia.</h2>
            <p className="text-xs font-mono text-slate-600 mb-6">
              Ocorreu um erro inesperado ao exibir os dados.
            </p>
            {this.state.error && (
              <div className="bg-[#E4E3E0] border border-[#141414] p-3 text-[10px] font-mono text-left mb-6 overflow-auto max-h-32">
                {this.state.error.message}
              </div>
            )}
            <button
              onClick={this.handleReset}
              className="bg-[#141414] text-white border-2 border-[#141414] px-6 py-3 text-xs font-bold uppercase hover:bg-black transition-all shadow-[4px_4px_0px_#C5C4C0] flex items-center gap-2 mx-auto"
            >
              <RefreshCw size={16} /> Recarregar Sistema
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
