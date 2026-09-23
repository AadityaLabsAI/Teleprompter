import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js');
    if (navigator.storage?.persist) void navigator.storage.persist().catch(() => {});
  });
}

class TeleqenErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state: { hasError: boolean } = { hasError: false };
  private readonly children: React.ReactNode;

  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.children = props.children;
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24, background: '#05070b', color: '#fff', fontFamily: 'system-ui' }}>
          <div style={{ maxWidth: 420, textAlign: 'center' }}>
            <h1 style={{ fontSize: 22, marginBottom: 8 }}>Teleqen needs a refresh</h1>
            <p style={{ opacity: .55, lineHeight: 1.6 }}>Your local script data is kept in this browser. Refresh the page to restore the studio.</p>
            <button style={{ marginTop: 18, border: 0, borderRadius: 12, padding: '11px 18px', fontWeight: 700 }} onClick={() => location.reload()}>Refresh Teleqen</button>
          </div>
        </div>
      );
    }
    return this.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TeleqenErrorBoundary>
      <App />
    </TeleqenErrorBoundary>
  </React.StrictMode>,
);
