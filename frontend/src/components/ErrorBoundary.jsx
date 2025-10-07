import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false,
      error: null, // Dodano stan na błąd
      errorInfo: null // Dodano stan na informacje o błędzie
    };
  }

  static getDerivedStateFromError(error) {
    // Aktualizuje stan, aby następny render pokazał UI fallback
    return { hasError: true, error: error };
  }

  componentDidCatch(error, errorInfo) {
    // Loguje błąd w konsoli dla dewelopera
    this.setState({ errorInfo: errorInfo });
    console.error('Błąd komponentu:', error, errorInfo);
  }

  // Funkcja do zresetowania stanu błędu
  handleReset = () => {
    // Jeśli przekazano funkcję onReset, użyj jej. W przeciwnym razie, zresetuj stan lokalny.
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
      });
    }
  };

  render() {
    if (this.state.hasError) {
      // Wyświetla alternatywny interfejs, gdy wystąpi błąd
      return (
        <div className="card" style={{ textAlign: 'center' }}>
          <h2>Something went wrong! 🙁</h2>
          <p>We apologize for the inconvenience. Below are the technical details that may help resolve the issue:</p>
          <details style={{ whiteSpace: 'pre-wrap', textAlign: 'left', background: '#f8d7da', border: '1px solid #f5c6cb', padding: '1rem', borderRadius: '8px' }}>
            <summary>Error Details</summary>
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </details>
          <button 
            onClick={this.handleReset} 
            className="btn-primary" 
            style={{ marginTop: '1rem' }}
          >
            Try Again
          </button>
        </div>
      );
    }
    // Normalne renderowanie dzieci
    return this.props.children;
  }
}

export default ErrorBoundary;