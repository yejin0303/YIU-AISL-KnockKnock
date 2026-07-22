// src/hooks/editor/useEditorKeyBindings.ts
import { useCallback } from 'react';
import type { RefObject } from 'react';
import { noteFilesApi } from '../../services/api/noteFilesApi';

export function useEditorKeyBindings(
  editorRef: RefObject<HTMLDivElement | null>,
  syncContent: () => void,
  getBlockContext: () => {
    wrapper: HTMLElement;
    inner: HTMLElement;
    range: Range;
    selection: Selection;
  } | null,
  activeNoteId: string | null
) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const editor = editorRef.current;
      if (!editor) return;

      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;

      const range = sel.getRangeAt(0);

      /* ===================================================
        BACKSPACE → wrapper 아래 문단 → 안으로 병합 정규화
       =================================================== */
      if (e.key === 'Backspace' && sel.isCollapsed && range.startOffset === 0) {
        const container =
          range.startContainer.nodeType === Node.TEXT_NODE
            ? range.startContainer.parentElement
            : (range.startContainer as HTMLElement);

        if (container) {
          const prev = container.previousSibling;

          if (
            prev instanceof HTMLElement &&
            (prev.classList.contains('editor-callout') ||
              prev.classList.contains('editor-code-block'))
          ) {
            e.preventDefault();

            const inner = prev.querySelector(
              '.editor-callout-content, .editor-code-block-inner'
            );
            if (!inner) return;

            // 현재 문단 정규화
            if (container.tagName === 'P') {
              while (container.firstChild) {
                inner.appendChild(container.firstChild);
              }
              container.remove();
            } else {
              inner.appendChild(container);
            }

            // 커서 이동
            const newRange = document.createRange();
            let firstMovedNode: ChildNode | null = container.firstChild;

            if (firstMovedNode) {
              if (firstMovedNode.nodeType === Node.TEXT_NODE) {
                newRange.setStart(firstMovedNode, 0);
              } else {
                newRange.setStartBefore(firstMovedNode);
              }
              newRange.collapse(true);
            } else {
              // fallback
              newRange.selectNodeContents(inner);
              newRange.collapse(false);
            }

            sel.removeAllRanges();
            sel.addRange(newRange);

            syncContent();
            return;
          }
        }
      }

      const ctx = getBlockContext();
      if (!ctx) return; // wrapper 내부가 아니면 아무 것도 안 함

      const { wrapper, inner, selection } = ctx;

      /* ===================================================
   ENTER → 블록 탈출 (callout / codeblock)
=================================================== */
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();

        const p = document.createElement('p');
        p.innerHTML = '<br>';

        wrapper.insertAdjacentElement('afterend', p);

        const newRange = document.createRange();
        newRange.setStart(p, 0);
        newRange.collapse(true);

        selection.removeAllRanges();
        selection.addRange(newRange);

        syncContent();
        return;
      }

      /* ===================================================
         BACKSPACE → wrapper 맨 앞에서 누르면 wrapper 삭제
      =================================================== */
      if (e.key === 'Backspace') {
        const isAtStart =
          range.startContainer === inner && range.startOffset === 0;

        // ⭐ textNode에서 시작하는 경우 caret 위치 보정
        if (range.startContainer.nodeType === Node.TEXT_NODE) {
          const text = range.startContainer as Text;
          if (text === inner.firstChild && range.startOffset === 0) {
            // 커서가 텍스트 첫 글자 앞
            // → wrapper 삭제 조건 충족
          } else {
            return; // 일반 백스페이스
          }
        }

        if (isAtStart) {
          e.preventDefault();

          const prev = wrapper.previousSibling;
          wrapper.remove();

          // 커서를 이전 문단 끝으로 이동
          if (prev instanceof HTMLElement) {
            const newRange = document.createRange();
            newRange.selectNodeContents(prev);
            newRange.collapse(false);

            selection.removeAllRanges();
            selection.addRange(newRange);
          }

          syncContent();
          return;
        }
      }
    },
    [editorRef, syncContent, getBlockContext]
  );

  return { handleKeyDown };
}
