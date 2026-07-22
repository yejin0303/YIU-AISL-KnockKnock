// src/hooks/editor/useHyperlink.ts
import { useState, useRef, useEffect } from 'react';
import type { RefObject } from 'react';

interface HyperlinkModalState {
  isOpen: boolean;
  defaultText: string;
  defaultUrl: string;
  onClose: () => void;
  onSubmit: (text: string, url: string) => void;
}

/**
 * 하이퍼링크 기능
 */
export function useHyperlink(
  editorRef: RefObject<HTMLDivElement | null>, // ← ★ 수정됨
  onContentChange: (html: string) => void
) {
  const [isHyperlinkOpen, setIsHyperlinkOpen] = useState(false);
  const [hyperlinkText, setHyperlinkText] = useState('');
  const [hyperlinkUrl, setHyperlinkUrl] = useState('');

  const savedRangeRef = useRef<Range | null>(null);

  /**
   * → 선택된 텍스트를 저장하고 모달 열기
   */
  const handleLinkButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();

    const editor = editorRef.current;
    if (!editor) {
      savedRangeRef.current = null;
      setHyperlinkText('');
      setHyperlinkUrl('');
      setIsHyperlinkOpen(true);
      return;
    }

    const selection = window.getSelection();
    let selectedText = '';

    if (
      selection &&
      selection.rangeCount > 0 &&
      editor.contains(selection.anchorNode)
    ) {
      selectedText = selection.toString();
      savedRangeRef.current = selection.getRangeAt(0).cloneRange();
    } else {
      savedRangeRef.current = null;
    }

    setHyperlinkText(selectedText);
    setHyperlinkUrl('');
    setIsHyperlinkOpen(true);
  };

  /**
   * → 하이퍼링크 삽입 후 onContentChange 호출
   */
  const handleHyperlinkSubmit = (text: string, url: string) => {
    const editorEl = editorRef.current;
    if (!editorEl) return;
    if (!url.trim()) return;

    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = text || url;

    let range: Range | null = savedRangeRef.current;

    // 선택 영역이 없으면 마지막에 추가
    if (!range) {
      const selection = window.getSelection();
      range = document.createRange();
      range.selectNodeContents(editorEl);
      range.collapse(false);

      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }

    if (!range) return;

    range.deleteContents();
    range.insertNode(a);

    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      const newRange = document.createRange();
      newRange.setStartAfter(a);
      newRange.collapse(true);
      selection.addRange(newRange);
    }

    onContentChange(editorEl.innerHTML);
    savedRangeRef.current = null;
  };

  /**
   * hyperlinkModalState
   */
  const hyperlinkModalState: HyperlinkModalState = {
    isOpen: isHyperlinkOpen,
    defaultText: hyperlinkText,
    defaultUrl: hyperlinkUrl,
    onClose: () => setIsHyperlinkOpen(false),
    onSubmit: handleHyperlinkSubmit,
  };

  /**
   * 본문 내 하이퍼링크 클릭 시 새 탭 열기
   */
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName.toLowerCase() === 'a') {
        e.preventDefault();
        const href = (target as HTMLAnchorElement).href;
        if (href) window.open(href, '_blank', 'noopener,noreferrer');
      }
    };

    editor.addEventListener('click', handleClick);
    return () => editor.removeEventListener('click', handleClick);
  }, [editorRef]);

  return {
    handleLinkButtonClick,
    handleHyperlinkSubmit,
    savedRangeRef,
    hyperlinkModalState,
  };
}
