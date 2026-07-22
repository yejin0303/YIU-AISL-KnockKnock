// src/components/Note/NoteSidebar/NoteSidebar.tsx
import React from 'react';
import type {
  Category,
  ContextMenuState,
  ContextTargetType,
  EditingItem,
  NoteItem,
  QuizHighlight,
} from '../../../types/noteTypes';
import './NoteSidebar.css';

interface NoteSidebarProps {
  categories: Category[];
  notes: NoteItem[];
  activeCategoryId: string | null;
  activeNoteId: string | null;
  activeCategory: Category | null;
  childCategories: Category[];
  childNotes: NoteItem[];
  rootNotes: NoteItem[];

  editingItem: EditingItem | null;
  editingText: string;
  editingInputRef: React.RefObject<HTMLInputElement | null>;

  contextMenu: ContextMenuState | null;
  contextMenuRef: React.RefObject<HTMLDivElement | null>;

  onChangeEditingText: (value: string) => void;
  onFinishEditing: () => void;

  onCategoryClick: (id: string) => void;
  onEnterCategory: (id: string) => void;
  onBackCategory: () => void;
  onAddCategory: () => void;
  onAddNote: () => void;
  onNoteClick: (id: string) => void;

  onOpenContextMenu: (
    e: React.MouseEvent<HTMLElement>,
    type: ContextTargetType,
    id: string
  ) => void;

  onContextMenuAction: (action: 'rename' | 'todo' | 'delete') => void;

  // 옵션 UI (노트 페이지에서는 기본 true / 퀴즈 페이지에서는 false로 줄 수 있음)
  showAddNoteButton?: boolean;
  showAddCategoryButton?: boolean;
  showQuizHighlightCard?: boolean;

  bottomExtra?: React.ReactNode;

  // 노트 페이지에서만 실제로 쓰는 콜백 (퀴즈 페이지에서는 생략 가능)
  onRemoveQuizHighlight?: (noteId: string, keywordId: string) => void;

  handleNoteDragStart: (noteId: string) => void;
  handleNoteDragEnd: () => void;
  handleDropToCategory: (categoryId: string) => void;
  handleDropToRoot: () => void;
  handleDragOver: (e: React.DragEvent) => void;

  // ⭐ 추가: 순서 변경 / 카테고리 드래그 관련 기능
  reorderNotes: (dragId: string, targetId: string) => void;
  reorderCategories: (dragId: string, targetId: string) => void;
  handleCategoryDragStart: (categoryId: string) => void;
  handleCategoryDragEnd: () => void;

  // ⭐ 드래그 중인 아이템 ID들
  dragNoteId: string | null;
  dragCategoryId: string | null;
}

export const NoteSidebar: React.FC<NoteSidebarProps> = ({
  categories,
  notes,
  activeNoteId,
  activeCategory,
  childCategories,
  childNotes,
  rootNotes,
  editingItem,
  editingText,
  editingInputRef,
  contextMenu,
  contextMenuRef,
  onChangeEditingText,
  onFinishEditing,
  onCategoryClick,
  onEnterCategory,
  onBackCategory,
  onAddCategory,
  onAddNote,
  onNoteClick,
  onOpenContextMenu,
  onContextMenuAction,
  showAddNoteButton = true,
  showAddCategoryButton = true,
  showQuizHighlightCard = true,
  bottomExtra,
  onRemoveQuizHighlight = () => {}, // 퀴즈 페이지에서는 안 넘겨도 되도록 기본값(no-op)
  handleNoteDragStart,
  handleNoteDragEnd,
  handleDropToCategory,
  handleDropToRoot,
  handleDragOver,
  reorderNotes,
  reorderCategories,
  handleCategoryDragStart,
  handleCategoryDragEnd,
  dragNoteId,
  dragCategoryId,
}) => {
  // 🔥 현재 활성 노트
  const activeNote = React.useMemo(
    () => notes.find((n) => n.id === activeNoteId),
    [notes, activeNoteId]
  );

  // 🔥 현재 노트의 하이라이트 리스트 (없으면 빈 배열)
  // NoteItem 타입에 highlightList 가 없더라도, 여기서만 느슨하게 캐스팅해서 사용
  const quizHighlightList: QuizHighlight[] = ((activeNote as any)
    ?.highlightList ?? []) as QuizHighlight[];

  // 🔥 특정 키워드 삭제(상위 hook에 위임)
  const handleRemoveQuizLabel = (keywordId: string) => {
    if (!activeNote) return;
    onRemoveQuizHighlight(activeNote.id, keywordId);
  };

  return (
    <aside className="note-sidebar">
      {/* 🔼 위쪽: 스크롤되는 영역 */}
      <div className="sidebar-scroll">
        {/* ▷ 카테고리 안에 들어간 상태 */}
        {activeCategory && (
          <div className="sidebar-active-view">
            {/* ✅ 여기 전체 줄을 클릭하면 onBackCategory 실행 */}
            <div
              className="sidebar-active-category-row"
              onClick={onBackCategory}
              style={{ cursor: 'pointer' }}
              onDragOver={handleDragOver}
              onDrop={(e) => {
                e.preventDefault();
                handleDropToRoot();
              }}
            >
              <button
                type="button"
                className="sidebar-active-category-icon-button"
                onClick={(e) => {
                  e.stopPropagation(); // 줄 전체 클릭 이벤트와 중복 방지
                  onBackCategory();
                }}
              >
                <img
                  src="/assets/icons/category-out-icon.png"
                  alt="상위로"
                  className="sidebar-active-category-icon"
                />
              </button>

              <span className="sidebar-active-category-label">
                {activeCategory.name}
              </span>
            </div>

            <div className="sidebar-active-children">
              {/* 자식 카테고리 */}
              {childCategories.map((cat) => (
                <div className="sidebar-category-item" key={cat.id}>
                  <button
                    type="button"
                    className="sidebar-category-label-btn"
                    onClick={(e) => {
                      if (
                        editingItem?.type === 'category' &&
                        editingItem.id === cat.id
                      ) {
                        e.stopPropagation();
                        e.preventDefault();
                        return;
                      }
                      onEnterCategory(cat.id);
                    }}
                    onContextMenu={(e) =>
                      onOpenContextMenu(e, 'category', cat.id)
                    }
                    onDragOver={handleDragOver}
                    onDrop={() => handleDropToCategory(cat.id)}
                  >
                    {editingItem?.type === 'category' &&
                    editingItem.id === cat.id ? (
                      <input
                        ref={editingInputRef}
                        className="sidebar-category-edit-input"
                        value={editingText}
                        onChange={(e) => onChangeEditingText(e.target.value)}
                        onBlur={onFinishEditing}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className="sidebar-category-label">{cat.name}</span>
                    )}
                  </button>

                  <button
                    type="button"
                    className="sidebar-category-icon-button"
                    onClick={() => onEnterCategory(cat.id)}
                  >
                    <img
                      src="/assets/icons/category-in-icon.png"
                      alt="카테고리 아이콘"
                      className="sidebar-category-icon"
                    />
                  </button>
                </div>
              ))}

              {/* 자식 노트 */}
              <div className="sidebar-note-list">
                {childNotes.map((note) => (
                  <div
                    key={note.id}
                    className={
                      'sidebar-note-item' +
                      (note.id === activeNoteId
                        ? ' sidebar-note-item--active'
                        : '')
                    }
                    onDragOver={handleDragOver}
                    onDrop={() => {
                      if (dragNoteId && dragNoteId !== note.id)
                        reorderNotes(dragNoteId, note.id);
                    }}
                  >
                    <div
                      className="sidebar-note-draggable"
                      draggable={
                        !(
                          editingItem?.type === 'note' &&
                          editingItem.id === note.id
                        )
                      }
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', note.id);
                        handleNoteDragStart(note.id);
                      }}
                      onDragEnd={handleNoteDragEnd}
                      onContextMenu={(e) =>
                        onOpenContextMenu(e, 'note', note.id)
                      }
                    >
                      <button
                        type="button"
                        className="sidebar-note-label-btn"
                        onClick={() => onNoteClick(note.id)}
                      >
                        {editingItem?.type === 'note' &&
                        editingItem.id === note.id ? (
                          <input
                            ref={editingInputRef}
                            className="sidebar-note-edit-input"
                            value={editingText}
                            onChange={(e) =>
                              onChangeEditingText(e.target.value)
                            }
                            onBlur={onFinishEditing}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                          />
                        ) : (
                          <span className="sidebar-note-label">
                            {note.name}
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ▷ 루트 상태 */}
        {!activeCategory && (
          <>
            <div className="sidebar-category-list">
              {categories
                .filter((c) => c.parentId === null)
                .map((cat) => (
                  <div
                    className="sidebar-category-item"
                    key={cat.id}
                    onDragOver={handleDragOver}
                    onDrop={() => {
                      if (dragCategoryId && dragCategoryId !== cat.id)
                        reorderCategories(dragCategoryId, cat.id);
                    }}
                  >
                    <button
                      type="button"
                      className="sidebar-category-label-btn"
                      draggable
                      onDragStart={() => handleCategoryDragStart(cat.id)}
                      onDragEnd={handleCategoryDragEnd}
                      onClick={(e) => {
                        if (
                          editingItem?.type === 'category' &&
                          editingItem.id === cat.id
                        ) {
                          e.stopPropagation();
                          e.preventDefault(); // 🔥 핵심: 편집 중이면 진입 방지
                          return;
                        }
                        onCategoryClick(cat.id);
                      }}
                      onContextMenu={(e) =>
                        onOpenContextMenu(e, 'category', cat.id)
                      }
                      onDragOver={handleDragOver}
                      onDrop={() => handleDropToCategory(cat.id)}
                    >
                      {editingItem?.type === 'category' &&
                      editingItem.id === cat.id ? (
                        <input
                          ref={editingInputRef}
                          className="sidebar-category-edit-input"
                          value={editingText}
                          onChange={(e) => onChangeEditingText(e.target.value)}
                          onBlur={onFinishEditing}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                        />
                      ) : (
                        <span className="sidebar-category-label">
                          {cat.name}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      className="sidebar-category-icon-button"
                      onClick={(e) => {
                        if (
                          editingItem?.type === 'category' &&
                          editingItem.id === cat.id
                        ) {
                          e.stopPropagation();
                          e.preventDefault(); // 🔥 편집 중 진입 차단
                          return;
                        }
                        onEnterCategory(cat.id);
                      }}
                    >
                      <img
                        src="/assets/icons/category-in-icon.png"
                        alt="카테고리 아이콘"
                        className="sidebar-category-icon"
                      />
                    </button>
                  </div>
                ))}
            </div>

            <div className="sidebar-note-list">
              {rootNotes.map((note) => (
                <div
                  key={note.id}
                  className={
                    'sidebar-note-item' +
                    (note.id === activeNoteId
                      ? ' sidebar-note-item--active'
                      : '')
                  }
                  onDragOver={handleDragOver}
                  onDrop={() => {
                    if (dragNoteId && dragNoteId !== note.id)
                      reorderNotes(dragNoteId, note.id);
                  }}
                >
                  <div
                    className="sidebar-note-draggable"
                    draggable={
                      !(
                        editingItem?.type === 'note' &&
                        editingItem.id === note.id
                      )
                    }
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', note.id); // ★ 필수
                      handleNoteDragStart(note.id);
                    }}
                    onDragEnd={handleNoteDragEnd}
                    onContextMenu={(e) => onOpenContextMenu(e, 'note', note.id)}
                  >
                    <button
                      type="button"
                      className="sidebar-note-label-btn"
                      onClick={() => onNoteClick(note.id)}
                    >
                      {editingItem?.type === 'note' &&
                      editingItem.id === note.id ? (
                        <input
                          ref={editingInputRef}
                          className="sidebar-note-edit-input"
                          value={editingText}
                          onChange={(e) => onChangeEditingText(e.target.value)}
                          onBlur={onFinishEditing}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              (e.target as HTMLInputElement).blur(); // ★ blur 강제
                            }
                          }}
                        />
                      ) : (
                        <span className="sidebar-note-label">{note.name}</span>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* 노트 추가 */}
        {showAddNoteButton && (
          <div className="sidebar-note-add">
            <button
              type="button"
              className="sidebar-note-add-btn"
              onClick={onAddNote}
            >
              <img
                src="/assets/icons/note-add-icon.png"
                alt=""
                aria-hidden="true"
                className="sidebar-note-add-icon"
              />
              <span className="sidebar-note-add-label">노트 추가하기</span>
            </button>
          </div>
        )}

        {/* 카테고리 추가 */}
        {showAddCategoryButton && !activeCategory && (
          <div className="sidebar-category-add">
            <button
              type="button"
              className="sidebar-category-add-btn"
              onClick={onAddCategory}
            >
              <img
                src="/assets/icons/category-add-icon.png"
                alt=""
                aria-hidden="true"
                className="sidebar-category-add-icon"
              />
              <span className="sidebar-category-add-label">카테고리 추가</span>
            </button>
          </div>
        )}
      </div>

      {/* 🔽 사이드바 맨 아래: 퀴즈에서 사용하는 추가 영역 (자주 틀리는 단어 카드 등) */}
      {bottomExtra && (
        <div className="note-sidebar-bottom-extra">{bottomExtra}</div>
      )}

      {/* Quiz Highlight 카드 (노트 페이지에서만 보이게) */}
      {showQuizHighlightCard && (
        <div className="quiz-highlight-card">
          <div className="quiz-highlight-title">Quiz Highlight</div>
          <ul className="quiz-highlight-list">
            {quizHighlightList.map((h: QuizHighlight, index: number) => (
              <li
                className="quiz-highlight-item"
                key={h.id ?? `${activeNoteId}-${index}`}
              >
                <button
                  type="button"
                  className="quiz-highlight-item-btn"
                  onClick={() => handleRemoveQuizLabel(h.id)}
                >
                  <img
                    src="/assets/icons/quiz-highligh-delete-icon.png"
                    alt=""
                    aria-hidden="true"
                    className="quiz-highlight-item-icon"
                  />
                </button>
                <span className="quiz-highlight-item-text">{h.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 컨텍스트 메뉴 */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="sidebar-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            type="button"
            className="sidebar-context-menu-item"
            onClick={() => onContextMenuAction('rename')}
          >
            이름 바꾸기
          </button>
          <button
            type="button"
            className="sidebar-context-menu-item sidebar-context-menu-item--danger"
            onClick={() => onContextMenuAction('delete')}
          >
            삭제하기
          </button>
        </div>
      )}
    </aside>
  );
};
