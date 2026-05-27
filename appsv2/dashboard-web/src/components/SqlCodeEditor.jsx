import { useMemo, forwardRef, useCallback } from 'react';
import CodeMirror, { EditorView } from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { oneDark } from '@codemirror/theme-one-dark';

/**
 * A CodeMirror 6 based SQL editor with:
 *  - SQL syntax highlighting
 *  - Schema-aware keyword + column autocomplete
 *  - Dark-mode aware theme
 *  - Cmd/Ctrl+Enter fires onRun
 *
 * The `ref` prop is forwarded to the underlying CodeMirror EditorView,
 * so callers can do editorRef.current.dispatch(...) for programmatic inserts.
 */
const SqlCodeEditor = forwardRef(function SqlCodeEditor(
    { value, onChange, schema, onRun, readOnly = false, minHeight = '180px', maxHeight = '45vh' },
    ref,
) {
    // Convert schema { tableName: [{name, type}] } → { tableName: [colName, ...] }
    const schemaMap = useMemo(() => {
        if (!schema || typeof schema !== 'object') return {};
        return Object.fromEntries(
            Object.entries(schema).map(([table, cols]) => [
                table,
                Array.isArray(cols) ? cols.map((c) => (typeof c === 'object' ? c.name : c)) : [],
            ]),
        );
    }, [schema]);

    // Extensions array — rebuild only when schemaMap or onRun changes
    const extensions = useMemo(
        () => [
            sql({ schema: schemaMap, upperCaseKeywords: false }),
            EditorView.lineWrapping,
            // Custom keymap: Cmd/Ctrl+Enter → run query
            EditorView.domEventHandlers({
                keydown(e) {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                        e.preventDefault();
                        e.stopPropagation();
                        onRun?.();
                        return true;
                    }
                },
            }),
        ],
        [schemaMap, onRun],
    );

    const onCreateEditor = useCallback(
        (view) => {
            if (ref) {
                if (typeof ref === 'function') ref(view);
                else ref.current = view;
            }
        },
        [ref],
    );

    return (
        <CodeMirror
            value={value}
            onChange={onChange}
            extensions={extensions}
            theme={oneDark}
            readOnly={readOnly}
            onCreateEditor={onCreateEditor}
            basicSetup={{
                lineNumbers: true,
                highlightActiveLineGutter: true,
                highlightSpecialChars: true,
                history: true,
                foldGutter: true,
                drawSelection: true,
                allowMultipleSelections: false,
                indentOnInput: true,
                syntaxHighlighting: true,
                bracketMatching: true,
                closeBrackets: true,
                autocompletion: true,
                rectangularSelection: false,
                highlightActiveLine: true,
                highlightSelectionMatches: true,
                closeBracketsKeymap: true,
                defaultKeymap: true,
                searchKeymap: false,
                historyKeymap: true,
                foldKeymap: true,
                completionKeymap: true,
                lintKeymap: false,
            }}
            style={{ fontSize: '13px', minHeight, maxHeight, overflow: 'auto' }}
        />
    );
});

export default SqlCodeEditor;
