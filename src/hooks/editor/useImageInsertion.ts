// src/hooks/editor/useImageInsertion.ts
import type { RefObject } from 'react';
import { useEffect, useRef } from 'react';
import { noteFilesApi } from '../../services/api/noteFilesApi';
import type { NoteItem } from '../../types/noteTypes';

/**
 * 이미지 업로드/삽입 기능 훅입니다.
 *
 * - insertImageAtSelection
 * - handleImageButtonClick
 * - handleImageInputChange
 */

export function useImageInsertion(
  editorRef: RefObject<HTMLDivElement | null>,
  imageInputRef: RefObject<HTMLInputElement | null>,
  syncContent: () => void,
  activeNoteId: string | null
) {
  const insertImageAtSelection = (src: string, fileId?: number) => {
    const editor = editorRef.current;
    if (!editor) return;

    // wrapper div 생성
    const imgWrapper = document.createElement('div');
    imgWrapper.className = 'editor-image-block';
    imgWrapper.contentEditable = 'false';

    const img = document.createElement('img');
    img.className = 'editor-image';
    img.src = src;
    img.alt = '';

    if (fileId) {
      img.dataset.fileId = String(fileId); // 🔥 핵심
    }

    const resizeHandle = document.createElement('span');
    resizeHandle.className = 'image-resize-handle';

    imgWrapper.appendChild(img);
    imgWrapper.appendChild(resizeHandle);

    const sel = window.getSelection();
    let inserted = false;

    // selection 위치에 삽입
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);

      if (editor.contains(range.commonAncestorContainer)) {
        range.collapse(false);
        range.insertNode(imgWrapper);
        inserted = true;

        // cursor 이동
        sel.removeAllRanges();
        const newRange = document.createRange();
        newRange.setStartAfter(imgWrapper);
        newRange.collapse(true);
        sel.addRange(newRange);
      }
    }

    // selection이 없으면 맨 아래에 삽입
    if (!inserted) {
      editor.appendChild(imgWrapper);

      const sel2 = window.getSelection();
      if (sel2) {
        sel2.removeAllRanges();
        const newRange = document.createRange();
        newRange.setStartAfter(imgWrapper);
        newRange.collapse(true);
        sel2.addRange(newRange);
      }
    }

    syncContent();
  };

  /**
   * File | string 모두 지원하는 외부 공개 함수
   * NoteToolbarProps의 타입과 정확히 매칭됨
   */
  const insertImage = (srcOrFile: string | File) => {
    if (srcOrFile instanceof File) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          insertImageAtSelection(reader.result);
        }
      };
      reader.readAsDataURL(srcOrFile);
    } else {
      insertImageAtSelection(srcOrFile);
    }
  };

  /**
   * 기존 handleImageButtonClick (input click)
   */
  const handleImageButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (imageInputRef.current) {
      imageInputRef.current.click();
    }
  };

  const handleImageInputChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    // 1️⃣ 노트 유효성 검사
    const isTemp = activeNoteId?.startsWith('temp-note-');

    if (!activeNoteId || isTemp) {
      alert('노트를 먼저 저장한 뒤 이미지를 추가할 수 있습니다.');
      return;
    }

    try {
      // 2️⃣ 서버 업로드
      const uploaded = await noteFilesApi.uploadNoteImage(activeNoteId, file);
      insertImageAtSelection(uploaded.storedPath, uploaded.id);
    } catch (err) {
      console.error('[ImageUpload] 실패', err);
      alert('이미지 업로드에 실패했습니다.');
    }
  };

  return {
    imageInputRef,
    insertImageAtSelection,
    handleImageButtonClick,
    handleImageInputChange,
    insertImage,
  };
}
