import React from "react";

type State = {
  error: Error | null;
  info: React.ErrorInfo | null;
};

export default class ErrorBoundary extends React.Component<{ children?: React.ReactNode }, State> {
  constructor(props: any) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error, info: null } as State;
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
    this.setState({ error, info });
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 18 }}>
          <h2 style={{ color: '#b91c1c' }}>Error en la aplicación</h2>
          <div style={{ background: '#fff', padding: 12, borderRadius: 6, border: '1px solid #fee2e2' }}>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{String(this.state.error)}
{this.state.info?.componentStack}</pre>
            <div style={{ marginTop: 12 }}>
              <button onClick={() => window.location.reload()} className="btn-primary">Recargar</button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children as React.ReactElement;
  }
}
