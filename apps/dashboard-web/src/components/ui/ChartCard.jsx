import { useRef, memo } from 'react';
import { Download, Image } from 'lucide-react';
import { exportChartToPNG } from '../../utils/exportUtils';
import LoadingSkeleton from './LoadingSkeleton';
import EmptyState from './EmptyState';
import InfoTooltip from './InfoTooltip';

function ChartCard({ title, subtitle, children, loading, error, empty, onExport, className = '', info, headerActions }) {
    const chartRef = useRef(null);

    const handleExportPNG = () => {
        exportChartToPNG(chartRef, `${title.toLowerCase().replace(/\s+/g, '-')}.png`);
    };

    return (
        <div className={`card ${className}`}>
            <div className="flex items-center justify-between mb-4">
                <div>
                    <div className="flex items-center gap-1.5">
                        <h3 className="text-sm font-semibold text-text-primary dark:text-text-primary-dark">
                            {title}
                        </h3>
                        {info && <InfoTooltip content={info} position="top" />}
                    </div>
                    {subtitle && (
                        <p className="text-xs text-text-muted dark:text-text-muted-dark mt-0.5">{subtitle}</p>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    {headerActions}
                    {onExport && (
                        <button
                            onClick={onExport}
                            className="p-1.5 rounded-md text-text-muted dark:text-text-muted-dark
                hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                            title="Export CSV"
                        >
                            <Download className="w-3.5 h-3.5" />
                        </button>
                    )}
                    <button
                        onClick={handleExportPNG}
                        className="p-1.5 rounded-md text-text-muted dark:text-text-muted-dark
              hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                        title="Export PNG"
                    >
                        <Image className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            <div ref={chartRef}>
                {loading ? (
                    <LoadingSkeleton type="chart" />
                ) : error ? (
                    <EmptyState type="error" message={error} />
                ) : empty ? (
                    <EmptyState type="empty" />
                ) : (
                    children
                )}
            </div>
        </div>
    );
}

export default memo(ChartCard);
