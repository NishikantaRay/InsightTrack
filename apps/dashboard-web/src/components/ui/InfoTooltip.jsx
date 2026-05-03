import { useState, useRef, useEffect } from 'react';
import { Info } from 'lucide-react';

/**
 * InfoTooltip — small (i) icon that shows a rich tooltip on hover.
 *
 * Props:
 *   content   – string | JSX for the tooltip body
 *   title     – optional bold heading inside the tooltip
 *   size      – icon size class, default 'w-3.5 h-3.5'
 *   position  – 'top' | 'bottom' | 'left' | 'right'  (default 'top')
 *   className – extra classes on the wrapper span
 */
export default function InfoTooltip({
    content,
    title,
    size = 'w-3.5 h-3.5',
    position = 'top',
    className = '',
}) {
    const [visible, setVisible] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0 });
    const iconRef = useRef(null);
    const tooltipRef = useRef(null);

    useEffect(() => {
        if (!visible || !iconRef.current) return;
        const rect = iconRef.current.getBoundingClientRect();
        const scroll = { x: window.scrollX, y: window.scrollY };
        const TW = tooltipRef.current?.offsetWidth || 240;
        const TH = tooltipRef.current?.offsetHeight || 80;

        let top, left;
        if (position === 'top') {
            top = rect.top + scroll.y - TH - 8;
            left = rect.left + scroll.x + rect.width / 2 - TW / 2;
        } else if (position === 'bottom') {
            top = rect.bottom + scroll.y + 8;
            left = rect.left + scroll.x + rect.width / 2 - TW / 2;
        } else if (position === 'left') {
            top = rect.top + scroll.y + rect.height / 2 - TH / 2;
            left = rect.left + scroll.x - TW - 8;
        } else {
            top = rect.top + scroll.y + rect.height / 2 - TH / 2;
            left = rect.right + scroll.x + 8;
        }
        // clamp to viewport
        left = Math.max(8, Math.min(left, window.innerWidth + scroll.x - TW - 8));
        top = Math.max(8, top);
        setCoords({ top, left });
    }, [visible, position]);

    return (
        <>
            <span
                ref={iconRef}
                className={`inline-flex items-center justify-center cursor-help text-gray-400 dark:text-gray-500 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors ${className}`}
                onMouseEnter={() => setVisible(true)}
                onMouseLeave={() => setVisible(false)}
                onFocus={() => setVisible(true)}
                onBlur={() => setVisible(false)}
                tabIndex={0}
                role="button"
                aria-label="More information"
            >
                <Info className={size} />
            </span>

            {visible && (
                <div
                    ref={tooltipRef}
                    style={{ position: 'fixed', top: coords.top, left: coords.left, zIndex: 9999 }}
                    className="w-64 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl p-3 pointer-events-none"
                >
                    {title && (
                        <p className="text-xs font-semibold text-gray-900 dark:text-white mb-1">{title}</p>
                    )}
                    <div className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                        {content}
                    </div>
                </div>
            )}
        </>
    );
}
