import { Focus, Minimize2 } from 'lucide-react';
import { useFocusModeStore } from '../../store/useFocusModeStore';

/**
 * FocusToggleButton — a pill button that toggles global focus mode.
 * When focusMode is OFF it shows "Focus" (inviting the user to hide headers).
 * When focusMode is ON  it shows "Show"  (inviting the user to restore them).
 * Drop it anywhere you want a visible per-page toggle (e.g. top-right of page).
 */
export default function FocusToggleButton() {
    const { focusMode, toggleFocusMode } = useFocusModeStore();
    return (
        <button
            onClick={toggleFocusMode}
            title={focusMode ? 'Show page headers and info panels' : 'Focus mode — hide headers for more space'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all shrink-0 ${
                focusMode
                    ? 'bg-accent border-accent text-white hover:bg-accent/90'
                    : 'border-border dark:border-border-dark text-text-muted dark:text-text-muted-dark bg-card dark:bg-card-dark hover:border-accent hover:text-accent'
            }`}
        >
            {focusMode
                ? <><Minimize2 className="w-3.5 h-3.5" /> Show</>
                : <><Focus className="w-3.5 h-3.5" /> Focus</>
            }
        </button>
    );
}
