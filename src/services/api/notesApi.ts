import { apiClient } from './authApi';
import type { NoteItem } from '../../types/noteTypes';

/**
 * 서버에서 내려주는 노트 형태
 */
interface NoteApiItem {
  id: number;
  title: string;
  categoryId: number | null;
  // 목록 조회(/notes)에서는 contentHtml/createdAt이 없을 수 있음 (NoteListResponse)
  contentHtml?: string;
  createdAt?: string;
}

//최신순 조회용
interface RecentNoteApiItem {
  id: number;
  title: string;
  categoryId: number | null;
}

//세부 조회용
interface NoteKeywordApiItem {
  id: number;
  text: string;
  startOffset: number;
  endOffset: number;
}

interface NoteFileApiItem {
  id: number;
  noteId: number;
  originalName: string;
  storedPath: string;
  fileSize: number;
  createdAt: string;
}

interface NoteDetailApiResponse {
  id: number;
  title: string;
  categoryId: number | null;
  contentHtml: string;
  keywords: NoteKeywordApiItem[];
  files: NoteFileApiItem[];
  updatedAt: string;
}

//제목, 본문 수정용
interface UpdateNoteApiResponse {
  id: number;
  title: string;
  updatedAt: string;
}

//노트 이동용
interface MoveNotesRequest {
  noteIds: number[];
  categoryId: number | null;
}

interface MoveNotesResponse {
  movedCount: number;
  categoryId: number | null;
}

//노트 순서 재정렬용
interface ReorderNotesRequest {
  categoryId?: number; // 없으면 미분류 정렬
  notes: { id: number }[];
}

interface ReorderNotesResponse {
  success: boolean;
  updatedCount: number;
}

//노트 삭제용
interface DeleteNoteResponse {
  message: string;
  noteId: number;
}

/**
 * 서버 → 프론트 변환
 */
const mapNoteApiItemToNote = (item: NoteApiItem): NoteItem => ({
  id: String(item.id),
  name: item.title,
  active: false,
  categoryId: item.categoryId ? String(item.categoryId) : null,
  content: item.contentHtml ?? '',
  order: 0, // 서버에서 자동 정렬 → 프론트 임시값
  // 목록 조회에서는 createdAt이 없어서 NaN이 될 수 있음 → 안전한 fallback
  updatedAt: item.createdAt ? new Date(item.createdAt).getTime() : Date.now(),
  isLocalOnly: false,
});

//최신순 조회용
const mapRecentNoteApiItemToNote = (item: RecentNoteApiItem): NoteItem => ({
  id: String(item.id),
  name: item.title,
  active: false,
  categoryId: item.categoryId ? String(item.categoryId) : null,
  content: '',
  order: 0,

  updatedAt: Date.now(), // 또는 0
});

//세부 조회용
const mapNoteDetailApiToNote = (item: NoteDetailApiResponse): NoteItem => ({
  id: String(item.id),
  name: item.title,
  active: false,
  categoryId: item.categoryId ? String(item.categoryId) : null,
  content: item.contentHtml ?? '',
  order: 0,
  updatedAt: new Date(item.updatedAt).getTime(),

  // 🔽 확장 필드 (noteTypes.ts에 optional로 있어야 함)
  highlightList:
    item.keywords?.map((k) => ({
      id: String(k.id),
      text: k.text,
      startOffset: k.startOffset,
      endOffset: k.endOffset,

      // 🔥 QuizHighlight 필수 필드 채우기
      contextBefore: '',
      contextAfter: '',
    })) ?? [],

  files:
    item.files?.map((f) => ({
      id: String(f.id),
      noteId: String(f.noteId),
      originalName: f.originalName,
      storedPath: f.storedPath,
      fileSize: f.fileSize,
      createdAt: new Date(f.createdAt).getTime(),
    })) ?? [],
});

export const notesApi = {
  /**
   * 노트 목록 조회
   * categoryId 없으면 → 미분류 포함 전체 or 서버 정책에 따름
   */
  getNotes: async (categoryId?: string): Promise<NoteItem[]> => {
    const res = await apiClient.get<NoteApiItem[]>('/notes', {
      params: categoryId ? { categoryId: Number(categoryId) } : undefined,
    });

    return res.data.map(mapNoteApiItemToNote);
  },

  /**
   * 최근 사용한 노트 조회
   */
  getRecentNotes: async (): Promise<NoteItem[]> => {
    const res = await apiClient.get<RecentNoteApiItem[]>('/notes/recent');

    return res.data.map(mapRecentNoteApiItemToNote);
  },

  /**
   * 노트 생성
   * - title: 프론트에서 기본값 처리 ("제목 없음")
   * - categoryId 없으면 미분류 노트
   */
  createNote: async (title: string, categoryId?: string): Promise<NoteItem> => {
    const res = await apiClient.post<NoteApiItem>('/notes', {
      title,
      ...(categoryId ? { categoryId: Number(categoryId) } : {}),
    });

    return mapNoteApiItemToNote(res.data);
  },

  /**
   * 📄 노트 상세 조회
   * - 본문 HTML
   * - 키워드
   * - 첨부 파일
   */
  getNoteDetail: async (noteId: string): Promise<NoteItem> => {
    const res = await apiClient.get<NoteDetailApiResponse>(`/notes/${noteId}`);

    return mapNoteDetailApiToNote(res.data);
  },

  /**
   * 노트 제목 / 본문 수정 (자동저장 포함)
   */
  updateNote: async (
    noteId: string,
    payload: {
      title?: string;
      contentHtml?: string;
    }
  ): Promise<Pick<NoteItem, 'id' | 'name' | 'updatedAt'>> => {
    const res = await apiClient.patch<UpdateNoteApiResponse>(
      `/notes/${noteId}`,
      {
        ...(payload.title !== undefined && { title: payload.title }),
        ...(payload.contentHtml !== undefined && {
          contentHtml: payload.contentHtml,
        }),
      }
    );

    return {
      id: String(res.data.id),
      name: res.data.title,
      updatedAt: new Date(res.data.updatedAt).getTime(),
    };
  },

  /**
   * 노트 이동 (단일 / 다중 / 미분류)
   */
  moveNotes: async (
    noteIds: string[],
    categoryId: string | null
  ): Promise<{
    movedCount: number;
    categoryId: string | null;
  }> => {
    const payload: MoveNotesRequest = {
      noteIds: noteIds.map(Number),
      categoryId: categoryId !== null ? Number(categoryId) : null,
    };

    const res = await apiClient.patch<MoveNotesResponse>(
      '/notes/move',
      payload
    );

    return {
      movedCount: res.data.movedCount,
      categoryId:
        res.data.categoryId !== null ? String(res.data.categoryId) : null,
    };
  },

  /**
   * 노트 순서 재정렬
   * - categoryId 있으면: 해당 카테고리 내부 정렬
   * - categoryId 없으면: 미분류 노트 정렬
   */
  reorderNotes: async (
    noteIdsInOrder: string[],
    categoryId?: string
  ): Promise<{ success: boolean; updatedCount: number }> => {
    const payload: ReorderNotesRequest = {
      notes: noteIdsInOrder.map((id) => ({ id: Number(id) })),
      ...(categoryId !== undefined ? { categoryId: Number(categoryId) } : {}),
    };

    const res = await apiClient.patch<ReorderNotesResponse>(
      '/notes/reorder',
      payload
    );

    return res.data;
  },

  /**
   * 노트 삭제
   * - 노트 및 연관 데이터 전체 삭제
   */
  deleteNote: async (
    noteId: string
  ): Promise<{ message: string; noteId: string }> => {
    const res = await apiClient.delete<DeleteNoteResponse>(
      `/notes/${Number(noteId)}`
    );

    return {
      message: res.data.message,
      noteId: String(res.data.noteId),
    };
  },
};
