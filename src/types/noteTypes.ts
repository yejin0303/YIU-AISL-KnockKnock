// src/types/noteTypes.ts

// 사이드바 카테고리
export interface Category {
  id: string;
  name: string;
  parentId: string | null; // 최상위면 null
  order: number;
}

export interface QuizHighlight {
  id: string; // highlight의 고유 ID
  text: string; // 실제 선택된 텍스트
  startOffset: number;
  endOffset: number;
  contextBefore: string; // 앞 문맥
  contextAfter: string; // 뒤 문맥
}

export type HighlightItem = {
  id: string; // highlight 고유 id
  text: string; // 표시될 텍스트
  startOffset: number; // 문서 전체 텍스트 기준 시작 index
  endOffset: number; // 문서 전체 텍스트 기준 끝 index
};

export interface NoteFile {
  id: string;
  noteId: string;
  originalName: string;
  storedPath: string;
  fileSize: number;
  createdAt: number;
}

// 노트 아이템
export interface NoteItem {
  id: string;
  name: string;
  active?: boolean;
  content: string;
  categoryId: string | null; // 어떤 카테고리에 속하는지
  order: number;
  updatedAt?: number; // 마지막 수정 시간 (타임스탬프)
  isLocalOnly?: boolean;

  highlightList?: QuizHighlight[];
  hasContentLoaded?: boolean;
  files?: NoteFile[];
}

// 컨텍스트 메뉴가 열릴 수 있는 대상 종류
export type ContextTargetType = 'category' | 'note';

// 우클릭 컨텍스트 메뉴 상태
export interface ContextMenuState {
  x: number; // 화면상 X 좌표
  y: number; // 화면상 Y 좌표
  targetType: ContextTargetType;
  targetId: string; // 카테고리/노트 id
}

// 이름 수정 중일 때 사용하는 상태
export interface EditingItem {
  type: ContextTargetType; // 'category' | 'note'
  id: string; // 수정 중인 카테고리/노트 id
}
