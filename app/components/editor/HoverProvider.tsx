/**
 * HoverProvider.tsx
 *
 * A React component that wraps a CodeMirror editor container and provides
 * semantic hover tooltips powered by the backend SCIP engine.
 *
 * Usage:
 *   <HoverProvider repoUrl={repoUrl} filePath={filePath}>
 *     <YourCodeMirrorEditor />
 *   </HoverProvider>
 *
 * The component listens to mousemove events on its container, debounces them,
 * resolves the hovered character position, and queries the backend for hover data.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getHover } from '~/lib/scip/scipClient';
import type { HoverResult } from '~/lib/scip/scipClient';

// ─── Types ────────────────────────────────────────────────────────────────────

interface HoverProviderProps {
  repoUrl: string;
  filePath: string;
  children: React.ReactNode;

  /** CodeMirror EditorView ref — needed to resolve pixel coords to line/char */
  editorViewRef?: React.RefObject<any>;
}

interface TooltipPosition {
  x: number;
  y: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function HoverProvider({ repoUrl, filePath, children, editorViewRef }: HoverProviderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [hover, setHover] = useState<HoverResult | null>(null);
  const [tooltipPos, setTooltipPos] = useState<TooltipPosition | null>(null);
  const [loading, setLoading] = useState(false);

  // ─── Mouse handling ─────────────────────────────────────────────────────────

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(async () => {
        // Resolve pixel position → line/character using CodeMirror's posAtCoords
        const view = editorViewRef?.current;

        if (!view) {
          return;
        }

        const pos = view.posAtCoords({ x: e.clientX, y: e.clientY }, false);

        if (pos == null) {
          return;
        }

        const line = view.state.doc.lineAt(pos);
        const lineNumber = line.number - 1; // 0-indexed for backend
        const character = pos - line.from;

        setLoading(true);
        setTooltipPos({ x: e.clientX, y: e.clientY });

        try {
          const result = await getHover(repoUrl, filePath, lineNumber, character);
          setHover(result);
        } catch {
          setHover(null);
        } finally {
          setLoading(false);
        }
      }, 150);
    },
    [repoUrl, filePath, editorViewRef],
  );

  const handleMouseLeave = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    setHover(null);
    setTooltipPos(null);
    setLoading(false);
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setHover(null);
      setTooltipPos(null);
    }
  }, []);

  // ─── Event listeners ────────────────────────────────────────────────────────

  useEffect(() => {
    const el = containerRef.current;

    if (!el) {
      return () => {};
    }

    el.addEventListener('mousemove', handleMouseMove);
    el.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      el.removeEventListener('mousemove', handleMouseMove);
      el.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('keydown', handleKeyDown);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [handleMouseMove, handleMouseLeave, handleKeyDown]);

  // ─── Render ─────────────────────────────────────────────────────────────────

  const showTooltip = tooltipPos && (loading || hover);

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {children}

      {showTooltip && <HoverTooltip hover={hover} loading={loading} x={tooltipPos.x} y={tooltipPos.y} />}
    </div>
  );
}

// ─── Tooltip UI ───────────────────────────────────────────────────────────────

interface HoverTooltipProps {
  hover: HoverResult | null;
  loading: boolean;
  x: number;
  y: number;
}

function HoverTooltip({ hover, loading, x, y }: HoverTooltipProps) {
  const style: React.CSSProperties = {
    position: 'fixed',
    left: x + 12,
    top: y + 16,
    zIndex: 9999,
    maxWidth: 480,
    background: 'var(--hover-bg, #1e1e2e)',
    color: 'var(--hover-fg, #cdd6f4)',
    border: '1px solid var(--hover-border, #313244)',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 13,
    lineHeight: 1.6,
    boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
    fontFamily: 'inherit',
    pointerEvents: 'none',
  };

  if (loading) {
    return (
      <div style={style}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', opacity: 0.6 }}>
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              border: '2px solid currentColor',
              borderTopColor: 'transparent',
              animation: 'spin 0.6s linear infinite',
              display: 'inline-block',
            }}
          />
          Loading…
        </div>
      </div>
    );
  }

  if (!hover) {
    return null;
  }

  return (
    <div style={style}>
      {/* Symbol name */}
      {hover.displayName && (
        <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--hover-name, #89b4fa)' }}>{hover.displayName}</div>
      )}

      {/* Type signature */}
      {hover.signatureDoc && (
        <pre
          style={{
            margin: '0 0 8px',
            padding: '6px 10px',
            background: 'var(--hover-code-bg, #181825)',
            borderRadius: 4,
            fontSize: 12,
            overflowX: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {hover.signatureDoc}
        </pre>
      )}

      {/* Documentation */}
      {hover.documentation && <div style={{ opacity: 0.85, fontSize: 12 }}>{hover.documentation}</div>}

      {/* Fallback: raw symbol */}
      {!hover.displayName && !hover.signatureDoc && !hover.documentation && (
        <code style={{ fontSize: 12, opacity: 0.7 }}>{hover.symbol}</code>
      )}
    </div>
  );
}
