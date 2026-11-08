import { indentWithTab } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { lintGutter, setDiagnostics, type Diagnostic as CmDiagnostic } from '@codemirror/lint';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';
import { basicSetup } from 'codemirror';
import { useEffect, useRef } from 'react';
import type { Diagnostic } from '../../shared/types.ts';

const theme = EditorView.theme({
  '&': { backgroundColor: 'var(--code-bg)', color: 'var(--ink)', fontSize: '14px' },
  '&.cm-focused': { outline: 'none' },
  '.cm-content': { fontFamily: 'var(--mono)', caretColor: 'var(--ink)', padding: '12px 0' },
  '.cm-cursor': { borderLeftColor: 'var(--ink)' },
  '.cm-gutters': { backgroundColor: 'var(--code-bg)', color: 'var(--muted)', border: 'none' },
  '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'var(--code-active)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--code-selection) !important',
  },
  '.cm-tooltip': { backgroundColor: 'var(--surface)', border: '1px solid var(--line-strong)', color: 'var(--ink)' },
  '.cm-diagnostic-error': { borderLeftColor: 'var(--bad)' },
  '.cm-lintRange-error': {
    backgroundImage: 'none',
    textDecoration: 'underline wavy var(--bad)',
    textUnderlineOffset: '3px',
  },
});

const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.modifier, t.controlKeyword, t.definitionKeyword, t.moduleKeyword, t.operatorKeyword], color: 'var(--tok-keyword)' },
  { tag: [t.string, t.special(t.string), t.regexp], color: 'var(--tok-string)' },
  { tag: [t.number, t.bool, t.null, t.atom], color: 'var(--tok-number)' },
  { tag: [t.typeName, t.className, t.namespace], color: 'var(--tok-type)' },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.definition(t.function(t.variableName))], color: 'var(--tok-fn)' },
  { tag: [t.lineComment, t.blockComment], color: 'var(--muted)', fontStyle: 'italic' },
]);

interface Props {
  initialValue: string;
  /** Replaces the document whenever a new object is passed, e.g. for "Reset code". */
  replacement: { code: string } | null;
  onChange: (code: string) => void;
  diagnostics: Diagnostic[];
  label: string;
}

/**
 * Uncontrolled: the editor owns its text and reports changes. React state can lag
 * behind fast typing, so feeding it back in as a prop would overwrite newer keystrokes.
 */
export function CodeEditor({ initialValue, replacement, onChange, diagnostics, label }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const change = useRef(onChange);
  change.current = onChange;

  useEffect(() => {
    const editor = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: initialValue,
        extensions: [
          basicSetup,
          keymap.of([indentWithTab]),
          javascript({ typescript: true }),
          syntaxHighlighting(highlight),
          lintGutter(),
          theme,
          EditorView.contentAttributes.of({ 'aria-label': label }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) change.current(update.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = editor;
    return () => {
      editor.destroy();
      view.current = null;
    };
    // The editor is created once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const editor = view.current;
    if (editor && replacement) {
      editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: replacement.code } });
    }
  }, [replacement]);

  useEffect(() => {
    const editor = view.current;
    if (!editor) return;
    // Results may be for an older version of the text, so keep ranges inside the document.
    const length = editor.state.doc.length;
    const items: CmDiagnostic[] = diagnostics.map((d) => {
      const from = Math.min(d.from, length);
      return { from, to: Math.max(from, Math.min(d.to, length)), severity: 'error', message: d.message };
    });
    editor.dispatch(setDiagnostics(editor.state, items));
  }, [diagnostics]);

  return <div ref={host} className="editor" />;
}
