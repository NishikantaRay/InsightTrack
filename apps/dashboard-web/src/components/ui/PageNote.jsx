import { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * PageNote — collapsible "what is this page?" banner shown at the top of every analytics page.
 *
 * Props:
 *   title       – short title, e.g. "What is Acquisition?"
 *   summary     – 1-2 sentence plain-language summary (always visible when expanded)
 *   details     – array of { label, text } objects for the detail rows
 *   businessTip – tip for business owners
 *   devTip      – tip for developers / technical users
 *   defaultOpen – boolean, default false
 */
export default function PageNote({
    title,
    summary,
    details = [],
    businessTip,
    devTip,
    defaultOpen = false,
}) {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/60 dark:bg-indigo-950/30 overflow-hidden">
            {/* Header — always visible */}
            <button
                onClick={() => setOpen((v) => !v)}
                className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
            >
                <div className="flex-shrink-0 p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-800/40">
                    <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-300">{title}</p>
                    {!open && (
                        <p className="text-xs text-indigo-600/80 dark:text-indigo-400/70 mt-0.5 leading-relaxed break-words">
                            {summary}
                        </p>
                    )}
                </div>
                <div className="flex-shrink-0 text-indigo-400 dark:text-indigo-500 mt-0.5">
                    {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
            </button>

            {/* Expanded body */}
            {open && (
                <div className="px-4 pb-4 space-y-4 border-t border-indigo-100 dark:border-indigo-900/40 pt-3">
                    <p className="text-sm text-indigo-700 dark:text-indigo-300 leading-relaxed break-words">{summary}</p>

                    {details.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {details.map(({ label, text }) => (
                                <div
                                    key={label}
                                    className="rounded-lg bg-white dark:bg-gray-900/50 border border-indigo-100 dark:border-indigo-900/30 p-3"
                                >
                                    <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-1">{label}</p>
                                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed break-words">{text}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    {(businessTip || devTip) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {businessTip && (
                                <div className="flex gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 p-3">
                                    <span className="text-lg leading-none">💼</span>
                                    <div>
                                        <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-1">Business Owner</p>
                                        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed break-words">{businessTip}</p>
                                    </div>
                                </div>
                            )}
                            {devTip && (
                                <div className="flex gap-2 rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-900/30 p-3">
                                    <span className="text-lg leading-none">🛠️</span>
                                    <div>
                                        <p className="text-xs font-semibold text-violet-700 dark:text-violet-400 mb-1">Developer</p>
                                        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed break-words">{devTip}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
