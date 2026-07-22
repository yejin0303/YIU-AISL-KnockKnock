import { apiClient } from './authApi';
import type { QuizHighlight } from '../../types/noteTypes';

// ==================== API 타입 ====================

// GET /notes/{noteId}/keywords 응답 (백엔드: Note_KeywordResponse)
type GetKeywordApiItem = {
  id: number;
  keywordText: string;
  startOffset: number;
  endOffset: number;
};

// POST /notes/{noteId}/keywords 요청 (백엔드: KeywordCreateRequest)
export type CreateKeywordApiRequest = {
  keywordText: string;
  startOffset: number;
  endOffset: number;
};

// POST /notes/{noteId}/keywords 응답 (백엔드: KeywordCreateResponse)
type CreateKeywordApiResponse = {
  id: number;
  keywordText: string;
  startOffset: number;
  endOffset: number;
};

// DELETE /notes/{noteId}/keywords/{keywordId} 응답 (백엔드: KeywordDeleteResponse)
type DeleteKeywordApiResponse = {
  keywordId: number;
  message?: string;
};

// GET /notes/wrong-keywords?noteId=15 응답 (백엔드: WrongKeywordResponse)
export type WrongKeywordApiItem = {
  id: number; // keywordId
  text: string; // keywordText
  wrongCount: number;
  isActive: boolean;
};

// GET /wrong-keywords?noteId=... 응답 (백엔드: WrongKeywordListResponse)
type WrongKeywordListResponseApi = {
  keywords: WrongKeywordApiItem[];
};

const mapApiItemToQuizHighlight = (item: GetKeywordApiItem): QuizHighlight => ({
  id: String(item.id),
  text: item.keywordText,
  startOffset: item.startOffset,
  endOffset: item.endOffset,
  // 서버에는 문맥 정보가 없으므로 비워둠 (offset 기반 복원 우선)
  contextBefore: '',
  contextAfter: '',
});

export const keywordApi = {
  /**
   * 키워드 전체 조회
   * GET /notes/{noteId}/keywords
   */
  getKeywords: async (noteId: string): Promise<QuizHighlight[]> => {
    const res = await apiClient.get<GetKeywordApiItem[]>(
      `/notes/${Number(noteId)}/keywords`
    );

    return res.data.map(mapApiItemToQuizHighlight);
  },

  /**
   * 키워드 생성
   * POST /notes/{noteId}/keywords
   */
  createKeyword: async (
    noteId: string,
    payload: CreateKeywordApiRequest
  ): Promise<CreateKeywordApiResponse> => {
    const res = await apiClient.post<CreateKeywordApiResponse>(
      `/notes/${Number(noteId)}/keywords`,
      payload
    );
    return res.data;
  },

  /**
   * 키워드 삭제
   * DELETE /notes/{noteId}/keywords/{keywordId}
   */
  deleteKeyword: async (
    noteId: string,
    keywordId: string
  ): Promise<DeleteKeywordApiResponse> => {
    const res = await apiClient.delete<DeleteKeywordApiResponse>(
      `/notes/${Number(noteId)}/keywords/${Number(keywordId)}`
    );
    return res.data;
  },

  /**
   * 자주 틀린 단어 리스트 조회
   * GET /wrong-keywords?noteId=15
   */
  getWrongKeywords: async (noteId: string): Promise<WrongKeywordApiItem[]> => {
    const res = await apiClient.get<WrongKeywordListResponseApi>('/wrong-keywords', {
      params: { noteId: Number(noteId) },
    });
    return res.data.keywords ?? [];
  },
};

