// src/hooks/editor/useEditorSelection.ts
import { useEffect, useRef, useState } from 'react';

export function useEditorSelection(
  editorRef: React.RefObject<HTMLDivElement | null>
) {
  const [isComposing, setIsComposing] = useState(false);

  const [inlineStyleState, setInlineStyleState] = useState({
    bold: false,
    italic: false,
    underline: false,
    strike: false,
  });

  const [currentFontSize, setCurrentFontSize] = useState<number>(11);

  const savedSelectionRef = useRef<Range | null>(null);

  /** selection-change 이벤트 잠시 비활성화 */
  const isSelectionChangeBlocked = useRef(false);

  const blockSelectionChange = () => {
    isSelectionChangeBlocked.current = true;
  };

  const unblockSelectionChange = () => {
    requestAnimationFrame(() => {
      isSelectionChangeBlocked.current = false;
    });
  };

  /** selection 저장 (에디터 내부일 때만) */
  const saveSelection = () => {
    const editor = editorRef.current;
    if (!editor) return;

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    const node = range.startContainer;

    // 🔥 에디터 내부에서 발생한 selection만 저장
    if (editor.contains(node)) {
      savedSelectionRef.current = range.cloneRange();
    }
  };

  /** 현재 font size 감지 */
  const detectFontSize = (node: Node | null) => {
    if (!node) return;

    let el: HTMLElement | null =
      node.nodeType === Node.TEXT_NODE
        ? node.parentElement
        : (node as HTMLElement);

    while (el) {
      const fs = window.getComputedStyle(el).fontSize;
      if (fs.endsWith('px')) {
        const px = parseFloat(fs);
        const pt = Math.round(px * 0.75);
        setCurrentFontSize(pt);
        return;
      }
      el = el.parentElement;
    }

    setCurrentFontSize(11);
  };

  const restoreSelection = () => {
    const saved = savedSelectionRef.current;
    if (!saved) return;

    const sel = window.getSelection();
    if (!sel) return;

    sel.removeAllRanges();
    sel.addRange(saved);
  };

  /* ------------------------------------------------------------------
      🧱 CodeBlock / Callout 블록 감지 기능 복원
  ------------------------------------------------------------------ */

  /** wrapper 블록 찾기 */
  const findWrapperBlock = (node: Node | null): HTMLElement | null => {
    const editor = editorRef.current;
    if (!editor) return null;

    while (node && node !== editor) {
      const el = node as HTMLElement;
      if (
        el?.classList?.contains('editor-code-block') ||
        el?.classList?.contains('editor-callout')
      ) {
        return el;
      }
      node = el.parentElement;
    }
    return null;
  };

  /** inner 블록 찾기 */
  const findInnerBlock = (node: Node | null): HTMLElement | null => {
    const editor = editorRef.current;
    if (!editor) return null;

    while (node && node !== editor) {
      const el = node as HTMLElement;
      if (
        el?.classList?.contains('editor-code-block-inner') ||
        el?.classList?.contains('editor-callout-content')
      ) {
        return el;
      }
      node = el.parentElement;
    }
    return null;
  };

  /** getBlockContext 반환 (포매팅 훅 + keyBindings 훅 모두 필요) */
  const getBlockContext = () => {
    const editor = editorRef.current;
    if (!editor) return null;

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;

    const range = sel.getRangeAt(0);
    const startNode = range.startContainer;

    const inner = findInnerBlock(startNode);
    if (!inner) return null;

    const wrapper = findWrapperBlock(inner);
    if (!wrapper) return null;

    return { wrapper, inner, range, selection: sel };
  };

  /* ------------------------------------------------------------------
      selectionchange listener
  ------------------------------------------------------------------ */

  useEffect(() => {
    const handler = () => {
      if (isSelectionChangeBlocked.current) return;

      const editor = editorRef.current;
      if (!editor) return;
      /* 에디터 외부 요소에서 발생한 selectionchange라면 무시 */
      const activeEl = document.activeElement;
      if (activeEl && !editor.contains(activeEl)) {
        return;
      }
      /* 🔥 2) selection 가져오기 */
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;

      const range = sel.getRangeAt(0);
      const startNode = range.startContainer;

      const node =
        startNode.nodeType === 1
          ? (startNode as HTMLElement)
          : startNode.parentElement;

      if (!node || !editor.contains(node)) return;

      // inline 스타일 감지
      let el: HTMLElement | null = node;
      let bold = false,
        italic = false,
        underline = false,
        strike = false;

      while (el && el !== editor) {
        const style = window.getComputedStyle(el);
        if (
          !bold &&
          (style.fontWeight === '700' || style.fontWeight === 'bold')
        )
          bold = true;
        if (!italic && style.fontStyle === 'italic') italic = true;
        if (!underline && style.textDecoration.includes('underline'))
          underline = true;
        if (!strike && style.textDecoration.includes('line-through'))
          strike = true;

        el = el.parentElement;
      }

      setInlineStyleState((prev) => {
        if (
          prev.bold === bold &&
          prev.italic === italic &&
          prev.underline === underline &&
          prev.strike === strike
        )
          return prev;
        return { bold, italic, underline, strike };
      });

      detectFontSize(startNode);
    };

    document.addEventListener('selectionchange', handler);
    return () => document.removeEventListener('selectionchange', handler);
  }, [editorRef]);

  return {
    isComposing,
    setIsComposing,

    inlineStyleState,
    currentFontSize,

    savedSelectionRef,
    saveSelection,

    blockSelectionChange,
    unblockSelectionChange,

    findWrapperBlock,
    findInnerBlock,
    getBlockContext,

    restoreSelection,
  };
}
