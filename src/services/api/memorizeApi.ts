import { apiClient } from './authApi';

// ==================== 타입 정의 ====================

export interface MemorizationSessionCreateRequest {
	noteId: number;
}

export interface MemorizationSessionUpdateRequest {
	progressLine?: number;
	lastTypedText?: string;
}

export interface MemorizationSessionResponse {
	id: number;
	noteId: number;
	status: string;
	progressLine: number;
	lastTypedText: string | null;
	totalLines: number;
	updatedAt: string;
}

// ==================== API 함수 ====================

export const memorizeApi = {
	/**
	 * 암기 세션 생성 (암기 시작)
	 * POST /memorization-sessions
	 */
	createSession: async (
		noteId: string
	): Promise<MemorizationSessionResponse> => {
		const response = await apiClient.post<MemorizationSessionResponse>(
			'/memorization-sessions',
			{
				noteId: Number(noteId),
			}
		);
		return response.data;
	},

	/**
	 * 암기 세션 조회 (이어하기 화면 로딩)
	 * GET /memorization-sessions/{sessionId}
	 */
	getSession: async (
		sessionId: string
	): Promise<MemorizationSessionResponse> => {
		const response = await apiClient.get<MemorizationSessionResponse>(
			`/memorization-sessions/${sessionId}`
		);
		return response.data;
	},

	/**
	 * 암기 진행 상황 저장 (자동 저장/수동 저장 공통)
	 * PATCH /memorization-sessions/{sessionId}
	 */
	updateSession: async (
		sessionId: string,
		data: MemorizationSessionUpdateRequest
	): Promise<MemorizationSessionResponse> => {
		// 백엔드 응답은 create/get과 동일하게 MemorizationSessionResponse
		const response = await apiClient.patch<MemorizationSessionResponse>(
			`/memorization-sessions/${sessionId}`,
			data
		);
		return response.data;
	},
};
