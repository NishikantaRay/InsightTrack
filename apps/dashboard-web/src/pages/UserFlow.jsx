import UserFlowChart from '../components/charts/UserFlowChart';
import ErrorBoundary from '../components/ui/ErrorBoundary';

export default function UserFlow() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">User Flow</h1>
                <p className="text-sm text-text-secondary dark:text-text-secondary-dark mt-1">
                    How visitors navigate through your website
                </p>
            </div>

            <ErrorBoundary fallbackMessage="Failed to load user flow data.">
                <UserFlowChart />
            </ErrorBoundary>
        </div>
    );
}
