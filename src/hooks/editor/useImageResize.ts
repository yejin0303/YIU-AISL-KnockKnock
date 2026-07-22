// src/hooks/editor/useImageResize.ts
import { useEffect } from 'react';
import type { RefObject } from 'react';

export function useImageResize(
  editorRef: RefObject<HTMLDivElement | null>,
  syncContent: () => void
) {
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    let resizing = false;
    let startX = 0;
    let startWidth = 0;
    let targetImg: HTMLImageElement | null = null;

    const clearSelection = () => {
      editor
        .querySelectorAll('.editor-image-block.selected')
        .forEach((el) => el.classList.remove('selected'));
    };

    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // editor 외부 클릭 무시
      if (!editor.contains(target)) return;

      /* ===============================
         1) resize handle 클릭
      =============================== */
      const handle = target.closest('.image-resize-handle');
      if (handle) {
        e.preventDefault();

        const wrapper = handle.closest(
          '.editor-image-block'
        ) as HTMLElement | null;
        const img = wrapper?.querySelector('img') ?? null;
        if (!wrapper || !img) return;

        clearSelection();
        wrapper.classList.add('selected');

        resizing = true;
        startX = e.clientX;
        startWidth = img.offsetWidth;
        targetImg = img;
        return;
      }

      /* ===============================
         2) 이미지 클릭 → 선택만
      =============================== */
      const wrapper = target.closest('.editor-image-block');
      if (wrapper) {
        e.preventDefault();
        clearSelection();
        wrapper.classList.add('selected');
        return;
      }

      /* ===============================
         3) 그 외 영역 클릭 → 해제
      =============================== */
      clearSelection();
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!resizing || !targetImg) return;

      const dx = e.clientX - startX;
      const nextWidth = Math.max(50, startWidth + dx);
      targetImg.style.width = `${nextWidth}px`;
    };

    const onMouseUp = () => {
      if (!resizing) return;

      resizing = false;
      targetImg = null;
      syncContent();
    };

    // 🔥 핵심: document에 바인딩
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [editorRef, syncContent]);
}
