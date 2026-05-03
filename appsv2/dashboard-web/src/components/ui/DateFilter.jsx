import { Calendar, ChevronDown, ChevronLeft, ChevronRight, GitCompareArrows } from 'lucide-react';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useDateFilterStore } from '../../store/useDateFilterStore';
import { DATE_RANGES } from '../../utils/formatters';

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const toStr = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

const formatDisplay = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T00:00:00');
    return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

function RangeCalendar({ startDate, endDate, onSelectDate, pickingField }) {
    const today = new Date();
    const todayStr = toStr(today.getFullYear(), today.getMonth(), today.getDate());
    const [viewYear, setViewYear] = useState(today.getFullYear());
    const [viewMonth, setViewMonth] = useState(today.getMonth());

    const days = useMemo(() => {
        const firstDay = new Date(viewYear, viewMonth, 1).getDay();
        const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
        const daysInPrev = new Date(viewYear, viewMonth, 0).getDate();
        const cells = [];
        for (let i = firstDay - 1; i >= 0; i--)
            cells.push({ day: daysInPrev - i, current: false });
        for (let d = 1; d <= daysInMonth; d++)
            cells.push({ day: d, current: true });
        const remaining = 42 - cells.length;
        for (let d = 1; d <= remaining; d++)
            cells.push({ day: d, current: false });
        return cells;
    }, [viewYear, viewMonth]);

    const prevMonth = () => {
        if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
        else setViewMonth(m => m - 1);
    };
    const nextMonth = () => {
        const next = new Date(viewYear, viewMonth + 1, 1);
        if (next <= today) {
            if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
            else setViewMonth(m => m + 1);
        }
    };
    const canGoNext = new Date(viewYear, viewMonth + 1, 1) <= today;

    return (
        <div className="select-none">
            <div className="flex items-center justify-between mb-3">
                <button onClick={prevMonth}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                    <ChevronLeft className="w-4 h-4 text-text-secondary dark:text-text-secondary-dark" />
                </button>
                <span className="text-sm font-semibold text-text-primary dark:text-text-primary-dark">
                    {MONTHS[viewMonth]} {viewYear}
                </span>
                <button onClick={nextMonth} disabled={!canGoNext}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors disabled:opacity-20">
                    <ChevronRight className="w-4 h-4 text-text-secondary dark:text-text-secondary-dark" />
                </button>
            </div>

            <div className="grid grid-cols-7 mb-1">
                {DAYS.map(d => (
                    <div key={d} className="h-8 flex items-center justify-center text-[11px] font-semibold
                        text-text-muted dark:text-text-muted-dark uppercase tracking-wider">
                        {d}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-7">
                {days.map((cell, i) => {
                    const dateStr = cell.current ? toStr(viewYear, viewMonth, cell.day) : null;
                    const isFuture = dateStr && dateStr > todayStr;
                    const isDisabled = !cell.current || isFuture;
                    const isStart = dateStr === startDate;
                    const isEnd = dateStr === endDate;
                    const isInRange = dateStr && startDate && endDate && dateStr > startDate && dateStr < endDate;
                    const isToday = dateStr === todayStr;

                    return (
                        <div key={i} className={`relative flex items-center justify-center
                            ${isInRange ? 'bg-accent/10 dark:bg-accent/15' : ''}
                            ${isStart && endDate ? 'rounded-l-lg bg-accent/10 dark:bg-accent/15' : ''}
                            ${isEnd && startDate ? 'rounded-r-lg bg-accent/10 dark:bg-accent/15' : ''}`}>
                            <button
                                disabled={isDisabled}
                                onClick={() => dateStr && !isFuture && onSelectDate(dateStr)}
                                className={`w-8 h-8 text-xs rounded-lg transition-all relative z-10
                                    ${isDisabled ? 'text-text-muted/25 dark:text-text-muted-dark/25 cursor-default' : 'hover:bg-accent/20'}
                                    ${isStart || isEnd ? 'bg-accent text-white font-bold shadow-sm hover:bg-accent/90' : ''}
                                    ${isToday && !isStart && !isEnd ? 'font-bold text-accent ring-1.5 ring-accent/50' : ''}
                                    ${!isDisabled && !isStart && !isEnd && !isToday ? 'text-text-primary dark:text-text-primary-dark' : ''}`}
                            >
                                {cell.day}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default function DateFilter() {
    const { dateRange, customStart, customEnd, compareMode, setDateRange, setCustomRange, toggleCompareMode } = useDateFilterStore();
    const [open, setOpen] = useState(false);
    const [showCustom, setShowCustom] = useState(false);
    const [startDate, setStartDate] = useState(customStart || '');
    const [endDate, setEndDate] = useState(customEnd || '');
    const [pickingField, setPickingField] = useState('start'); // 'start' | 'end'
    const ref = useRef(null);

    const current = dateRange === 'custom' && customStart && customEnd
        ? { label: `${formatDisplay(customStart)} – ${formatDisplay(customEnd)}`, value: 'custom' }
        : DATE_RANGES.find((r) => r.value === dateRange) || DATE_RANGES[2];

    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) {
                setOpen(false);
                setShowCustom(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleSelectDate = useCallback((dateStr) => {
        if (pickingField === 'start') {
            setStartDate(dateStr);
            if (endDate && dateStr > endDate) setEndDate('');
            setPickingField('end');
        } else {
            if (dateStr < startDate) {
                setStartDate(dateStr);
                setPickingField('end');
            } else {
                setEndDate(dateStr);
                setPickingField('start');
            }
        }
    }, [pickingField, startDate, endDate]);

    const handleCustomApply = () => {
        if (startDate && endDate && startDate <= endDate) {
            setCustomRange(startDate, endDate);
            setOpen(false);
            setShowCustom(false);
        }
    };

    const handlePresetClick = (value) => {
        setDateRange(value);
        setOpen(false);
        setShowCustom(false);
    };

    return (
        <div className="flex items-center gap-2">
            <div ref={ref} className="relative">
                <button
                    onClick={() => { setOpen(!open); setShowCustom(false); }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border
                        border-border dark:border-border-dark
                        bg-card dark:bg-card-dark
                        text-sm font-medium text-text-primary dark:text-text-primary-dark
                        hover:border-accent/50 transition-colors"
                >
                    <Calendar className="w-4 h-4 text-text-muted dark:text-text-muted-dark" />
                    <span className="max-w-[200px] truncate">{current.label}</span>
                    <ChevronDown className={`w-4 h-4 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>

                {open && !showCustom && (
                    <div className="absolute top-full left-0 mt-1.5 w-52 py-1.5 rounded-xl border
                        border-border dark:border-border-dark
                        bg-card dark:bg-card-dark shadow-xl shadow-black/5 dark:shadow-black/20 z-50
                        animate-in fade-in slide-in-from-top-1 duration-150">
                        {DATE_RANGES.filter(r => r.value !== 'custom').map((range) => (
                            <button
                                key={range.value}
                                onClick={() => handlePresetClick(range.value)}
                                className={`w-full px-4 py-2 text-left text-sm transition-colors rounded-lg mx-0
                                    ${range.value === dateRange
                                        ? 'bg-accent/10 text-accent font-medium'
                                        : 'text-text-secondary dark:text-text-secondary-dark hover:bg-gray-50 dark:hover:bg-white/5'
                                    }`}
                            >
                                {range.label}
                            </button>
                        ))}

                        <div className="border-t border-border dark:border-border-dark mx-3 my-1.5" />

                        <button
                            onClick={() => { setShowCustom(true); setPickingField('start'); }}
                            className={`w-full px-4 py-2 text-left text-sm transition-colors flex items-center gap-2
                                ${dateRange === 'custom'
                                    ? 'bg-accent/10 text-accent font-medium'
                                    : 'text-text-secondary dark:text-text-secondary-dark hover:bg-gray-50 dark:hover:bg-white/5'
                                }`}
                        >
                            <Calendar className="w-3.5 h-3.5" />
                            Custom Range
                        </button>
                    </div>
                )}

                {open && showCustom && (
                    <div className="absolute top-full left-0 mt-1.5 rounded-xl border
                        border-border dark:border-border-dark
                        bg-card dark:bg-card-dark shadow-xl shadow-black/5 dark:shadow-black/20 z-50
                        animate-in fade-in slide-in-from-top-1 duration-150">

                        {/* Date range pills */}
                        <div className="flex items-center gap-2 px-4 pt-4 pb-3">
                            <button
                                onClick={() => setPickingField('start')}
                                className={`flex-1 px-3 py-2 rounded-lg border text-xs font-medium text-center transition-all
                                    ${pickingField === 'start'
                                        ? 'border-accent bg-accent/5 text-accent ring-1 ring-accent/30'
                                        : 'border-border dark:border-border-dark text-text-secondary dark:text-text-secondary-dark'}`}
                            >
                                <div className="text-[10px] uppercase tracking-wider text-text-muted dark:text-text-muted-dark mb-0.5">From</div>
                                {startDate ? formatDisplay(startDate) : 'Select date'}
                            </button>
                            <div className="text-text-muted dark:text-text-muted-dark text-xs">→</div>
                            <button
                                onClick={() => setPickingField('end')}
                                className={`flex-1 px-3 py-2 rounded-lg border text-xs font-medium text-center transition-all
                                    ${pickingField === 'end'
                                        ? 'border-accent bg-accent/5 text-accent ring-1 ring-accent/30'
                                        : 'border-border dark:border-border-dark text-text-secondary dark:text-text-secondary-dark'}`}
                            >
                                <div className="text-[10px] uppercase tracking-wider text-text-muted dark:text-text-muted-dark mb-0.5">To</div>
                                {endDate ? formatDisplay(endDate) : 'Select date'}
                            </button>
                        </div>

                        {/* Calendar */}
                        <div className="px-4 pb-3">
                            <RangeCalendar
                                startDate={startDate}
                                endDate={endDate}
                                onSelectDate={handleSelectDate}
                                pickingField={pickingField}
                            />
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-border dark:border-border-dark">
                            <button
                                onClick={() => { setShowCustom(false); }}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg
                                    text-text-secondary dark:text-text-secondary-dark
                                    hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                            >
                                ← Back
                            </button>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => { setStartDate(''); setEndDate(''); setPickingField('start'); }}
                                    className="px-3 py-1.5 text-xs font-medium rounded-lg
                                        text-text-muted dark:text-text-muted-dark
                                        hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                                >
                                    Clear
                                </button>
                                <button
                                    onClick={handleCustomApply}
                                    disabled={!startDate || !endDate || startDate > endDate}
                                    className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-accent text-white
                                        hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
                                >
                                    Apply
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Compare toggle */}
            <button
                onClick={toggleCompareMode}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors
                    ${compareMode
                        ? 'border-accent bg-accent/10 text-accent dark:bg-accent/20'
                        : 'border-border dark:border-border-dark bg-card dark:bg-card-dark text-text-secondary dark:text-text-secondary-dark hover:border-accent/50'
                    }`}
                title="Compare with previous period"
            >
                <GitCompareArrows className="w-4 h-4" />
                <span className="hidden sm:inline">Compare</span>
            </button>
        </div>
    );
}
