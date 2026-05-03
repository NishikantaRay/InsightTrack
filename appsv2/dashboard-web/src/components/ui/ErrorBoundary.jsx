import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('ErrorBoundary caught:', error, errorInfo);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center min-h-[300px] p-8">
                    <div className="p-3 rounded-full bg-error/10 mb-4">
                        <AlertTriangle className="w-8 h-8 text-error" />
                    </div>
                    <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
                    <p className="text-sm text-text-secondary dark:text-text-secondary-dark mb-4 text-center max-w-md">
                        {this.props.fallbackMessage || 'An unexpected error occurred while loading this section.'}
                    </p>
                    <button
                        onClick={this.handleReset}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg
              bg-accent text-white hover:bg-accent/90 transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Try Again
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
