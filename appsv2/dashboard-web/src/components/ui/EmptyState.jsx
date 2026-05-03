import { BarChart3, AlertCircle, Inbox } from 'lucide-react';

export default function EmptyState({ type = 'empty', message }) {
    const config = {
        empty: {
            icon: Inbox,
            title: 'No data yet',
            description: 'Data will appear here once visitors start coming in.',
        },
        error: {
            icon: AlertCircle,
            title: 'Failed to load',
            description: message || 'Something went wrong. Please try again.',
        },
        noResults: {
            icon: BarChart3,
            title: 'No results',
            description: 'Try adjusting your filters to see data.',
        },
    };

    const { icon: Icon, title, description } = config[type] || config.empty;

    return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-3 rounded-xl bg-gray-100 dark:bg-white/5 mb-4">
                <Icon className="w-6 h-6 text-text-muted dark:text-text-muted-dark" />
            </div>
            <h4 className="text-sm font-medium text-text-primary dark:text-text-primary-dark mb-1">
                {title}
            </h4>
            <p className="text-xs text-text-muted dark:text-text-muted-dark max-w-xs">
                {description}
            </p>
        </div>
    );
}
