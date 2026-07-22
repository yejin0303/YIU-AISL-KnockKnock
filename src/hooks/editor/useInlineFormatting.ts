// src/hooks/editor/useInlineFormatting.ts
import type { RefObject } from 'react';

type InlineStyle = 'bold' | 'italic' | 'underline' | 'strike';

export function useInlineFormatting(
  editorRef: RefObject<HTMLDivElement | null>,
  savedSelectionRef: RefObject<Range | null>,
  saveCurrentSelection: () => void,
  syncContent: () => void
) {
  /**
   * applyInlineSpanToRange
   */
  const applyInlineSpanToRange = (
    applyStyle: (span: HTMLSpanElement) => void
  ) => {
    const editor = editorRef.current;
    if (!editor) return;

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    if (sel.isCollapsed) return;

    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);

    const targetNodes: Text[] = [];
    let current = walker.nextNode() as Text | null;

    // range와 교차하는 텍스트 노드 수집
    while (current) {
      let intersects = false;

      if ((range as any).intersectsNode) {
        intersects = (range as any).intersectsNode(current);
      } else {
        const nodeRange = document.createRange();
        nodeRange.selectNodeContents(current);

        const isBefore =
          range.compareBoundaryPoints(Range.END_TO_START, nodeRange) <= 0;
        const isAfter =
          range.compareBoundaryPoints(Range.START_TO_END, nodeRange) >= 0;

        intersects = !(isBefore || isAfter);
      }

      if (intersects) targetNodes.push(current);
      current = walker.nextNode() as Text | null;
    }

    if (targetNodes.length === 0) return;

    let lastSpan: HTMLSpanElement | null = null;

    targetNodes.forEach((node) => {
      const full = node.data;
      const len = full.length;

      let startOffset = 0;
      let endOffset = len;

      if (node === range.startContainer) startOffset = range.startOffset ?? 0;

      if (node === range.endContainer) endOffset = range.endOffset ?? len;

      if (startOffset >= endOffset) return;

      const before = full.slice(0, startOffset);
      const middle = full.slice(startOffset, endOffset);
      const after = full.slice(endOffset);

      const frag = document.createDocumentFragment();

      if (before) frag.appendChild(document.createTextNode(before));

      if (middle) {
        const span = document.createElement('span');
        applyStyle(span);
        span.textContent = middle;
        frag.appendChild(span);
        lastSpan = span;
      }

      if (after) frag.appendChild(document.createTextNode(after));

      node.replaceWith(frag);
    });

    // lastSpan 뒤로 커서 이동
    if (lastSpan) {
      sel.removeAllRanges();
      const newR = document.createRange();
      newR.setStartAfter(lastSpan);
      newR.collapse(true);
      sel.addRange(newR);
    }

    syncContent();
  };

  /**
   * applyInlineStyleToSelection
   */
  const applyInlineStyleToSelection = (style: InlineStyle) => {
    applyInlineSpanToRange((span) => {
      if (style === 'bold') span.style.fontWeight = '700';
      if (style === 'italic') span.style.fontStyle = 'italic';
      if (style === 'underline') span.style.textDecoration = 'underline';
      if (style === 'strike') span.style.textDecoration = 'line-through';
    });
  };

  /**
   * handleInlineStyleClick — execCommand 유지
   */
  const handleInlineStyleClick = (
    style: InlineStyle,
    e: React.MouseEvent<HTMLButtonElement>
  ) => {
    e.preventDefault();
    saveCurrentSelection();

    const command =
      style === 'bold'
        ? 'bold'
        : style === 'italic'
        ? 'italic'
        : style === 'underline'
        ? 'underline'
        : 'strikeThrough';

    document.execCommand(command, false);
  };

  /**
 doApplyFontSize 와 applyFontSizeToSelection 통합 버전.
   */
  /**
   * 폰트 크기 적용
   */
  const applyFontSizeToSelection = (pt: number) => {
    const editor = editorRef.current;
    const savedRange = savedSelectionRef.current;

    if (!editor || !savedRange) return;

    const sel = window.getSelection();
    if (!sel) return;

    // selectionchange 임시 비활성화
    if ((window as any).blockSelectionChange) {
      (window as any).blockSelectionChange();
    }

    // --- 1) 저장된 selection 복원 ---
    sel.removeAllRanges();
    sel.addRange(savedRange.cloneRange());

    const range = sel.getRangeAt(0);

    // --- 2) 커서만 있는 경우 (collapsed) ---
    if (range.collapsed) {
      const span = document.createElement('span');
      span.style.fontSize = `${pt}pt`;

      // Zero-width space
      span.appendChild(document.createTextNode('\u200B'));
      range.insertNode(span);

      // span 뒤로 커서 이동
      const newRange = document.createRange();
      newRange.setStart(span.childNodes[0], 1);
      newRange.collapse(true);

      sel.removeAllRanges();
      sel.addRange(newRange);

      syncContent();

      if ((window as any).unblockSelectionChange) {
        (window as any).unblockSelectionChange();
      }

      return;
    }

    // --- 3) 텍스트가 선택된 경우 ---
    applyInlineSpanToRange((span) => {
      span.style.fontSize = `${pt}pt`;
      span.style.lineHeight = 'normal';
    });

    syncContent();

    // selectionchange 이벤트 복구
    if ((window as any).unblockSelectionChange) {
      (window as any).unblockSelectionChange();
    }
  };

  return {
    applyInlineSpanToRange,
    applyInlineStyleToSelection,
    handleInlineStyleClick,
    applyFontSizeToSelection,
  };
}
