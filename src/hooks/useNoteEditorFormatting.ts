// src/hooks/useNoteEditorFormatting.ts

import { useRef, useState, useEffect } from 'react';
import type React from 'react';
import type { NoteItem, QuizHighlight } from '../types/noteTypes';

/* 가져오는 훅들 */
import { useInlineFormatting } from './editor/useInlineFormatting';
import { useBlockFormatting } from './editor/useBlockFormatting';
import { useImageInsertion } from './editor/useImageInsertion';
import { useHyperlink } from './editor/useHyperlink';
import { useQuizHighlight } from './editor/useQuizHighlight';
import { useToolbarUI } from './editor/useToolbarUI';
import { useContentSync } from './editor/useContentSync';
import { useEditorSelection } from './editor/useEditorSelection';
import { useEditorKeyBindings } from './editor/useEditorKeyBindings';
import { useImageResize } from './editor/useImageResize';

interface Params {
  activeNote: NoteItem | undefined;
  activeNoteId: string | null;
  onContentChange: (html: string) => void;
  onQuizSave: (noteId: string, highlights: QuizHighlight[]) => void;
}

export function useNoteEditorFormatting({
  activeNote,
  activeNoteId,
  onContentChange,
  onQuizSave,
}: Params) {
  /* ---------------- refs ---------------- */
  const editorRef = useRef<HTMLDivElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const toolbarLeftRef = useRef<HTMLDivElement | null>(null);
  const quizButtonRef = useRef<HTMLButtonElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  /* ---------------- Selection / Inline 상태 ---------------- */
  const {
    inlineStyleState,
    currentFontSize,
    saveSelection,
    savedSelectionRef,
    getBlockContext,
  } = useEditorSelection(editorRef);

  /* ---------------- Quiz Highlight Hook ---------------- */
  const {
    isQuizMode,
    quizButtonLabel,
    savedHighlights,
    setSavedHighlights,
    handleQuizToggle,
  } = useQuizHighlight(editorRef, activeNote, onContentChange, onQuizSave);

  /* ---------------- Toolbar UI Hook ---------------- */
  const {
    toolbarOverflow,
    showFontSizeDropdown,
    fontSizeDropdownPos,
    calcFontDropdownPosition,
    showLineHeightDropdown,
    lineHeightDropdownPos,
    calcLineHeightDropdownPosition,
  } = useToolbarUI(toolbarRef, toolbarLeftRef, quizButtonRef);

  /* ---------------- Content Sync Hook ---------------- */
  const {
    isComposing,
    handleCompositionStart,
    handleCompositionEnd,
    handleContentInput,
    syncContent,
  } = useContentSync(editorRef, activeNote?.id ?? null, onContentChange);

  /* ---------------- Inline Formatting Hook ---------------- */
  const { handleInlineStyleClick, applyFontSizeToSelection } =
    useInlineFormatting(
      editorRef,
      savedSelectionRef,
      saveSelection,
      syncContent
    );

  /* ---------------- Block Formatting Hook ---------------- */
  const {
    handleTextAlignClick,
    handleOrderedListClick,
    handleUnorderedListClick,
    handleCodeBlockClick,
    handleCalloutClick,
    handleLineHeightClick,
  } = useBlockFormatting(editorRef, syncContent);

  /* ---------------- Image Insertion Hook ---------------- */
  const {
    insertImageAtSelection,
    handleImageButtonClick,
    handleImageInputChange,
  } = useImageInsertion(editorRef, imageInputRef, syncContent, activeNoteId);

  useImageResize(editorRef, syncContent);

  /* ---------------- Hyperlink Hook ---------------- */
  const { handleLinkButtonClick, hyperlinkModalState } = useHyperlink(
    editorRef,
    onContentChange
  );

  /* ---------------- KeyBindings Hook ---------------- */
  const { handleKeyDown } = useEditorKeyBindings(
    editorRef,
    syncContent,
    getBlockContext,
    activeNoteId
  );

  /* =====================================================
      최초 로딩 시 편집기에 내용 로드
  ====================================================== */

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (!activeNote) return;

    // ✅ 이미 내용이 있으면 덮어쓰지 않음
    if (editor.innerHTML !== '') return;

    // ✅ content가 실제로 있을 때만 주입
    if (!activeNote.content) return;

    editor.innerHTML = activeNote.content;
  }, [activeNote?.id, activeNote?.content]);

  /* =====================================================
      activeNote 변경 시 편집기에 내용 로드
  ====================================================== */
  const lastSyncedNoteIdRef = useRef<string | null>(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const currentNoteId = activeNote?.id ?? null;

    if (currentNoteId !== lastSyncedNoteIdRef.current) {
      editor.innerHTML = activeNote?.content ?? '';
      lastSyncedNoteIdRef.current = currentNoteId;
    }
  }, [activeNote?.id]);

  /* =====================================================
      최종 반환 — 기존 useNoteEditorFormatting API 그대로 유지
  ====================================================== */

  return {
    editorRef,
    isQuizMode,

    toolbarProps: {
      currentFontSize,
      toolbarOverflow,
      activeInlineStyles: inlineStyleState,

      fontSizeDropdown: {
        visible: showFontSizeDropdown,
        top: fontSizeDropdownPos.top,
        left: fontSizeDropdownPos.left,
        onToggle: calcFontDropdownPosition,
        onSelect: applyFontSizeToSelection,
      },

      lineHeightDropdown: {
        visible: showLineHeightDropdown,
        top: lineHeightDropdownPos.top,
        left: lineHeightDropdownPos.left,
        onToggle: calcLineHeightDropdownPosition,
        onSelect: (value: number) => {
          // 1) 저장된 selection 복원
          const sel = window.getSelection();
          sel?.removeAllRanges();
          if (savedSelectionRef.current) {
            sel?.addRange(savedSelectionRef.current.cloneRange());
          }

          // 2) 본문에 줄간격 적용
          handleLineHeightClick(value);
        },
      },

      onInlineStyleClick: handleInlineStyleClick,
      onCodeBlockClick: handleCodeBlockClick,
      onImageButtonClick: handleImageButtonClick,
      onCalloutClick: handleCalloutClick,
      onTextAlignClick: handleTextAlignClick,
      onUnorderedListClick: handleUnorderedListClick,
      onOrderedListClick: handleOrderedListClick,
      onQuizToggle: handleQuizToggle,
      isQuizMode,
      quizButtonLabel,

      toolbarRef,
      toolbarLeftRef,
      quizButtonRef,
      imageInputRef,
      onImageInputChange: handleImageInputChange,
      onLinkButtonClick: handleLinkButtonClick,

      saveCurrentSelection: saveSelection,

      insertImageAtSelection,
    },

    hyperlinkModalState,

    handleContentInput,
    handleCompositionStart,
    handleCompositionEnd,

    handleKeyDown,
  };
}
