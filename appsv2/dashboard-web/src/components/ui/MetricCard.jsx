import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import InfoTooltip from './InfoTooltip';

export default function MetricCard({ title, value, trend, trendLabel, icon: Icon, sparklineData, color = '#6366F1', info }) {
    const trendDirection = trend > 0 ? 'up' : trend < 0 ? 'down' : 'neutral';
    const TrendIcon = trendDirection === 'up' ? TrendingUp : trendDirection === 'down' ? TrendingDown : Minus;
    const trendColor =
        trendDirection === 'up'
            ? 'text-success'
            : trendDirection === 'down'
                ? 'text-error'
                : 'text-text-muted dark:text-text-muted-dark';

    return (
        <div className="card card-hover group">
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                    {Icon && (
                        <div className="p-2 rounded-lg bg-accent/10 dark:bg-accent/20">
                            <Icon className="w-4 h-4 text-accent" />
                        </div>
                    )}
                    <span className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark">
                        {title}
                    </span>
                    {info && <InfoTooltip content={info} position="top" />}
                </div>
                {trend != null && (
                    <div className={`flex items-center gap-1 text-xs font-medium ${trendColor}`}>
                        <TrendIcon className="w-3 h-3" />
                        <span>{Math.abs(trend)}%</span>
                    </div>
                )}
            </div>

            <div className="text-2xl font-bold tracking-tight mb-1">
                {value}
            </div>

            {trendLabel && (
                <p className="text-xs text-text-muted dark:text-text-muted-dark mb-3">
                    {trendLabel}
                </p>
            )}

            {sparklineData && sparklineData.length > 1 && (
                <div className="h-10 -mx-1">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={sparklineData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id={`sparkGrad-${title}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={color} stopOpacity={0.2} />
                                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <Area
                                type="monotone"
                                dataKey="value"
                                stroke={color}
                                strokeWidth={1.5}
                                fill={`url(#sparkGrad-${title})`}
                                dot={false}
                                isAnimationActive={false}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
}
