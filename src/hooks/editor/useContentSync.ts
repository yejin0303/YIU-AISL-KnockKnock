// src/hooks/editor/useContentSync.ts
import { useRef, useState, useEffect } from 'react';
import type { RefObject } from 'react';
import { noteFilesApi } from '../../services/api/noteFilesApi';

/**
 * contenteditable 입력 동기화 전담 훅
 * (Semantic Anchoring 버전 — 하이라이트 삭제 감지 제거)
 */
export function useContentSync(
  editorRef: RefObject<HTMLDivElement | null>,
  activeNoteId: string | null,
  onContentChange: (html: string) => void
) {
  /** 한글 입력 조합 상태 */
  const [isComposing, setIsComposing] = useState(false);

  /** 로컬 콘텐츠 ref */
  const localHtmlRef = useRef<string>('');

  /** 활성화 노트 ref */
  const activeNoteIdRef = useRef<string | null>(null);

  /** 이전에 존재하던 이미지 fileId 목록 */
  const prevImageIdsRef = useRef<Set<string>>(new Set());

  /** 삭제 중복 방지 */
  const deletingImageIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    activeNoteIdRef.current = activeNoteId;
  }, [activeNoteId]);

  /** ✅ editor 내용이 바뀌면 ref 동기화 */
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    localHtmlRef.current = editor.innerHTML;
  }, [editorRef]);

  /** Debounce 구현 */
  function debounce(fn: (...args: any[]) => void, delay: number) {
    let timer: any;
    return (...args: any[]) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  const debouncedCommit = useRef(
    debounce((html: string) => {
      const noteId = activeNoteIdRef.current;

      if (!noteId) {
        console.log('[ContentSync] skip commit (no activeNote)');
        return;
      }

      console.log('[ContentSync] commit to NotePage', noteId);
      onContentChange(html);
    }, 300)
  ).current;

  //
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!activeNoteId) return;
      onContentChange(localHtmlRef.current);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  /** input 이벤트 */
  const handleContentInput = () => {
    const editor = editorRef.current;
    if (!editor) return;

    localHtmlRef.current = editor.innerHTML;

    // 🔥 현재 이미지 목록
    const currentImageIds = collectImageFileIds();

    // 🔥 이미지가 줄어든 경우 → 삭제 처리 필요
    const imageRemoved = currentImageIds.size < prevImageIdsRef.current.size;

    if (imageRemoved) {
      // ❗ debounce 우회, 즉시 처리
      syncContent();
      return;
    }

    // 기존 텍스트 입력 처리 유지
    if (!isComposing) {
      requestAnimationFrame(() => {
        debouncedCommit(localHtmlRef.current);
      });
    }
  };

  /** 한글 조합 시작 */
  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  /** 한글 조합 종료 → sync */
  const handleCompositionEnd = () => {
    setIsComposing(false);

    requestAnimationFrame(() => {
      debouncedCommit(localHtmlRef.current);
    });
  };

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    prevImageIdsRef.current = collectImageFileIds();
  }, [activeNoteId]);

  /** 외부에서 강제 sync (blur, save 등) */
  const syncContent = () => {
    const editor = editorRef.current;
    const noteId = activeNoteIdRef.current;

    if (!editor || !noteId) return;

    /** 1️⃣ 현재 DOM 기준 이미지 목록 */
    const currentImageIds = collectImageFileIds();

    /** 2️⃣ 삭제된 이미지 계산 */
    const removedIds = [...prevImageIdsRef.current].filter(
      (id) => !currentImageIds.has(id)
    );

    /** 3️⃣ 서버 삭제 요청 */
    removedIds.forEach((fileId) => {
      // temp note / 로컬 노트 보호
      if (noteId.startsWith('temp-note-')) return;

      // 중복 삭제 방지
      if (deletingImageIdsRef.current.has(fileId)) return;
      deletingImageIdsRef.current.add(fileId);

      noteFilesApi.deleteNoteImage(noteId, fileId).catch((e) => {
        console.error('[ImageDelete] 실패', e);
      });
    });

    /** 4️⃣ 기준 이미지 목록 갱신 */
    prevImageIdsRef.current = currentImageIds;

    /** 5️⃣ 기존 content sync 유지 */
    localHtmlRef.current = editor.innerHTML;
    debouncedCommit(localHtmlRef.current);
  };

  const collectImageFileIds = () => {
    const editor = editorRef.current;
    if (!editor) return new Set<string>();

    const imgs = Array.from(
      editor.querySelectorAll<HTMLImageElement>('img[data-file-id]')
    );

    return new Set(
      imgs
        .map((img) => img.dataset.fileId)
        .filter((id): id is string => Boolean(id))
    );
  };

  return {
    isComposing,
    setIsComposing,
    syncContent,
    handleCompositionStart,
    handleCompositionEnd,
    handleContentInput,
  };
}
