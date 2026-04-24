export default function LoadingSkeleton({ type = 'chart' }) {
    if (type === 'page') {
        return (
            <div className="animate-pulse p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="card h-32">
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-3" />
                            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-2" />
                            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20" />
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="card h-72">
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-4" />
                            <div className="h-52 bg-gray-200 dark:bg-gray-700 rounded" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (type === 'card') {
        return (
            <div className="animate-pulse">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-3" />
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-32" />
            </div>
        );
    }

    return (
        <div className="animate-pulse h-52 flex flex-col justify-end gap-2 p-2">
            <div className="flex items-end gap-2 h-full">
                {[...Array(12)].map((_, i) => (
                    <div
                        key={i}
                        className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-t"
                        style={{ height: `${20 + Math.random() * 80}%` }}
                    />
                ))}
            </div>
        </div>
    );
}
