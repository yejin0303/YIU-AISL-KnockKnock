// src/pages/NotePage/NotePage.tsx
import React from 'react';
import './NotePage.css';

import { useNoteData } from '../../hooks/useNoteData';
import { NoteSidebar } from '../../components/Note/NoteSidebar/NoteSidebar';
import { NoteEditor } from '../../components/Note/NoteEditor/NoteEditor';
import { useNoteExport } from '../../hooks/useNoteExport';
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal/ConfirmDeleteModal';
import ExportModal from '../../components/ExportModal/ExportModal';
import PageLayout from '../../components/Layout/PageLayout';

const NotePage: React.FC = () => {
  const {
    categories,
    setNotes,
    notes,
    activeNoteId,
    activeCategoryId,
    contextMenu,
    contextMenuRef,
    editingItem,
    editingText,
    editingInputRef,
    setEditingText,
    finishEditing,
    openContextMenu,
    handleContextMenuItemClick,
    handleCategoryClick,
    handleEnterCategory,
    handleCategoryBackClick,
    handleAddCategory,
    handleAddNote,
    handleNoteClick,
    isDeleteModalOpen,
    deleteTitle,
    deleteDescription,
    handleConfirmDelete,
    handleCancelDelete,
    handleRemoveQuizHighlight,
    handleSaveQuizHighlights,
    handleNoteDragStart,
    handleNoteDragEnd,
    handleDropToCategory,
    handleDropToRoot,
    handleDragOver,
    updateNoteContent,
    reorderNotes,
    reorderCategories,
    handleCategoryDragStart,
    handleCategoryDragEnd,
    dragNoteId,
    dragCategoryId,
    saveNow,
  } = useNoteData();

  const { exportNote } = useNoteExport();

  // Export 모달 상태
  const [isExportModalOpen, setIsExportModalOpen] = React.useState(false);
  const [exportFileName, setExportFileName] = React.useState('');

  const activeCategory = activeCategoryId
    ? categories.find((c) => c.id === activeCategoryId) ?? null
    : null;

  const childCategories = activeCategory
    ? categories.filter((c) => c.parentId === activeCategory.id)
    : categories.filter((c) => c.parentId === null);

  const isCategorySelected = activeCategoryId !== null;

  const childNotes = isCategorySelected
    ? notes.filter((n) => n.categoryId === activeCategoryId)
    : notes;

  const rootNotes = notes
    .filter((n) => n.categoryId === null)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const activeNote = activeNoteId
    ? notes.find((n) => n.id === activeNoteId)
    : undefined;

  const handleContentChange = (html: string) => {
    if (!activeNoteId) return;

    updateNoteContent(activeNoteId, html);
  };

  const handleExportClick = () => {
    const name = activeNote?.name ?? '제목없음';
    setExportFileName(name);
    setIsExportModalOpen(true);
  };

  return (
    <PageLayout
      title="Write a notebook"
      subtitle="공부한 내용을 정리해보세요!"
      headerActions={
        <>
          <button
            type="button"
            className="note-header-button note-header-button--secondary"
            onClick={handleExportClick}
          >
            Export
          </button>
          <button
            type="button"
            className="note-header-button note-header-button--primary"
            onClick={saveNow}
          >
            Save
          </button>
        </>
      }
      sidebar={
        <NoteSidebar
          categories={categories}
          notes={notes}
          activeCategoryId={activeCategoryId}
          activeNoteId={activeNoteId}
          activeCategory={activeCategory}
          childCategories={childCategories}
          childNotes={childNotes}
          rootNotes={rootNotes}
          editingItem={editingItem}
          editingText={editingText}
          editingInputRef={editingInputRef}
          contextMenu={contextMenu}
          contextMenuRef={contextMenuRef}
          onChangeEditingText={setEditingText}
          onFinishEditing={finishEditing}
          onCategoryClick={handleCategoryClick}
          onEnterCategory={handleEnterCategory}
          onBackCategory={handleCategoryBackClick}
          onAddCategory={handleAddCategory}
          onAddNote={handleAddNote}
          onNoteClick={handleNoteClick}
          onOpenContextMenu={openContextMenu}
          onContextMenuAction={handleContextMenuItemClick}
          onRemoveQuizHighlight={handleRemoveQuizHighlight}
          handleNoteDragStart={handleNoteDragStart}
          handleNoteDragEnd={handleNoteDragEnd}
          handleDropToCategory={handleDropToCategory}
          handleDropToRoot={handleDropToRoot}
          handleDragOver={handleDragOver}
          reorderNotes={reorderNotes}
          reorderCategories={reorderCategories}
          handleCategoryDragStart={handleCategoryDragStart}
          handleCategoryDragEnd={handleCategoryDragEnd}
          dragNoteId={dragNoteId}
          dragCategoryId={dragCategoryId}
        />
      }
      mainContent={
        <NoteEditor
          key={activeNoteId}
          activeNote={activeNote}
          activeNoteId={activeNoteId}
          onContentChange={handleContentChange}
          onQuizSave={handleSaveQuizHighlights}
        />
      }
      modals={
        <>
          <ConfirmDeleteModal
            isOpen={isDeleteModalOpen}
            title={deleteTitle}
            description={deleteDescription}
            cancelText="cancel"
            okText="OK"
            onCancel={handleCancelDelete}
            onConfirm={handleConfirmDelete}
          />
          <ExportModal
            isOpen={isExportModalOpen}
            onClose={() => setIsExportModalOpen(false)}
            fileName={exportFileName}
            onChangeFileName={setExportFileName}
            onDownload={({ fileName, format }) => {
              if (!activeNote) return;

              exportNote({
                html: activeNote.content,
                fileName,
                format: format as 'PNG' | 'JPEG' | 'PDF',
              });

              setIsExportModalOpen(false);
            }}
          />
        </>
      }
    />
  );
};

export default NotePage;
