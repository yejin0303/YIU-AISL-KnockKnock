// src/components/Note/NoteEditor/NoteEditor.tsx

import type { NoteItem, QuizHighlight } from '../../../types/noteTypes';
import { useNoteEditorFormatting } from '../../../hooks/useNoteEditorFormatting';
import { NoteToolbar } from '../NoteToolbar/NoteToolbar';
import HyperlinkModal from '../../HyperlinkModal/HyperlinkModal';

import './NoteEditor.css';

interface NoteEditorProps {
  activeNote: NoteItem | undefined;
  activeNoteId: string | null;
  onContentChange: (html: string) => void;
  onQuizSave: (noteId: string, highlights: QuizHighlight[]) => void;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({
  activeNote,
  activeNoteId,
  onContentChange,
  onQuizSave,
}) => {
  const {
    editorRef,
    isQuizMode,
    toolbarProps,
    hyperlinkModalState,
    handleContentInput,
    handleCompositionStart,
    handleCompositionEnd,
    handleKeyDown,
  } = useNoteEditorFormatting({
    activeNote,
    activeNoteId,
    onContentChange,
    onQuizSave,
  });

  // 활성 노트가 없을 때: 안내 문구
  if (!activeNote) {
    return (
      <main className="note-editor note-editor--disabled">
        <div className="note-editor-placeholder">
          내용을 작성할 노트를 선택해주세요.
        </div>
      </main>
    );
  }

  return (
    <main
      className={'note-editor' + (isQuizMode ? ' note-editor--quiz-mode' : '')}
    >
      {/* 상단 툴바 */}
      <NoteToolbar {...toolbarProps} />

      {/* 본문 에디터 */}
      <div
        className="note-editor-body"
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleContentInput}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onKeyDown={handleKeyDown}
      />

      {/* 하이퍼링크 모달 */}
      <HyperlinkModal
        isOpen={hyperlinkModalState.isOpen}
        onClose={hyperlinkModalState.onClose}
        defaultText={hyperlinkModalState.defaultText}
        defaultUrl={hyperlinkModalState.defaultUrl}
        onSubmit={hyperlinkModalState.onSubmit}
      />
    </main>
  );
};
