import { apiClient } from './authApi';

export type QuizMode = 'ALL_TRY' | 'PART_TRY';

export type QuizSessionCreateRequest = {
  noteId: number;
  mode: QuizMode;
};

export type QuizSessionQuestionDto = {
  questionId: number;
  keywordId: number;
  keywordText: string;
  startOffset: number;
  endOffset: number;
};

export type QuizSessionCreateResponse = {
  sessionId: number;
  noteId: number;
  mode: QuizMode;
  questions: QuizSessionQuestionDto[];
};

export type QuizSessionDetailQuestion = {
  id: number;
  keywordId: number | null;
  questionText: string;
  answerText: string;
  userAnswer: string | null;
  isCorrect: boolean | null;
};

export type QuizSessionDetailResponse = {
  sessionId: number;
  noteId: number;
  mode: QuizMode;
  status: 'IN_PROGRESS' | 'GRADED';
  questions: QuizSessionDetailQuestion[];
};

export type QuizGradeRequest = {
  answers: { questionId: number; userAnswer: string }[];
};

export type QuizGradeResponse = {
  sessionId: number;
  noteId: number;
  correctCount: number;
  incorrectCount: number;
  accuracy: number;
  status: 'GRADED';
  finishedAt: string; // ISO datetime
};

export const quizApi = {
  /**
   * 퀴즈 세션 생성
   * POST /quiz-sessions
   */
  createSession: async (
    payload: QuizSessionCreateRequest
  ): Promise<QuizSessionCreateResponse> => {
    const res = await apiClient.post<QuizSessionCreateResponse>(
      '/quiz-sessions',
      payload
    );
    return res.data;
  },

  /**
   * 퀴즈 세션 상세 조회
   * GET /quiz-sessions/{sessionId}
   */
  getSessionDetail: async (
    sessionId: number
  ): Promise<QuizSessionDetailResponse> => {
    const res = await apiClient.get<QuizSessionDetailResponse>(
      `/quiz-sessions/${sessionId}`
    );
    return res.data;
  },

  /**
   * 일괄 채점
   * POST /quiz-sessions/{sessionId}/grade
   */
  gradeSession: async (
    sessionId: number,
    payload: QuizGradeRequest
  ): Promise<QuizGradeResponse> => {
    const res = await apiClient.post<QuizGradeResponse>(
      `/quiz-sessions/${sessionId}/grade`,
      payload
    );
    return res.data;
  },
};

