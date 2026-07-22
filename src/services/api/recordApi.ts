import { apiClient } from './authApi';

// -----------------------------
// Types (server response shapes)
// -----------------------------

type LocalDateTimeString = string; // e.g. "2025-11-11T20:23:00"

type NoteRecordResponseApi = {
	note_info: {
		note_id: number;
		note_title: string;
		category_id: number | null;
		category_name: string | null;
	};
	summary: {
		total_sessions: number;
		total_questions: number;
		correct_questions: number;
		overall_accuracy: number;
	};
	trend: {
		session_id: number;
		finished_at: LocalDateTimeString;
		accuracy: number;
		wrong_rate: number;
	}[];
	recent_sessions: {
		session_id: number;
		finished_at: LocalDateTimeString;
		accuracy: number;
		correct_count: number;
		total_questions: number;
		score_level: 'GREEN' | 'YELLOW' | 'RED';
	}[];
	top_sessions: {
		session_id: number;
		finished_at: LocalDateTimeString;
		correct_count: number;
		total_questions: number;
		accuracy: number;
	}[];
	low_accuracy_sessions: {
		session_id: number;
		finished_at: LocalDateTimeString;
		correct_count: number;
		total_questions: number;
		accuracy: number;
	}[];
	oldest_sessions: {
		session_id: number;
		finished_at: LocalDateTimeString;
		correct_count: number;
		total_questions: number;
		accuracy: number;
	}[];
};

type RecentSessionsResponseApi = {
	recent_sessions: {
		session_id: number;
		note_id: number | null;
		note_title: string | null;
		category_id: number | null;
		category_name: string | null;
		correct_count: number;
		total_questions: number;
		accuracy: number;
		finished_at: LocalDateTimeString;
	}[];
};

// -----------------------------
// Types (frontend-friendly)
// -----------------------------

export type NoteRecord = {
	noteInfo: {
		noteId: number;
		noteTitle: string;
		categoryId: number | null;
		categoryName: string | null;
	};
	summary: {
		totalSessions: number;
		totalQuestions: number;
		correctQuestions: number;
		overallAccuracy: number;
	};
	trend: {
		sessionId: number;
		finishedAt: LocalDateTimeString;
		accuracy: number;
		wrongRate: number;
	}[];
	recentSessions: {
		sessionId: number;
		finishedAt: LocalDateTimeString;
		accuracy: number;
		correctCount: number;
		totalQuestions: number;
		scoreLevel: 'GREEN' | 'YELLOW' | 'RED';
	}[];
	topSessions: {
		sessionId: number;
		finishedAt: LocalDateTimeString;
		correctCount: number;
		totalQuestions: number;
		accuracy: number;
	}[];
	lowAccuracySessions: {
		sessionId: number;
		finishedAt: LocalDateTimeString;
		correctCount: number;
		totalQuestions: number;
		accuracy: number;
	}[];
	oldestSessions: {
		sessionId: number;
		finishedAt: LocalDateTimeString;
		correctCount: number;
		totalQuestions: number;
		accuracy: number;
	}[];
};

export type RecentSession = {
	sessionId: number;
	noteId: number | null;
	noteTitle: string | null;
	categoryId: number | null;
	categoryName: string | null;
	correctCount: number;
	totalQuestions: number;
	accuracy: number;
	finishedAt: LocalDateTimeString;
};

function mapNoteRecord(api: NoteRecordResponseApi): NoteRecord {
	return {
		noteInfo: {
			noteId: api.note_info.note_id,
			noteTitle: api.note_info.note_title,
			categoryId: api.note_info.category_id,
			categoryName: api.note_info.category_name,
		},
		summary: {
			totalSessions: api.summary.total_sessions,
			totalQuestions: api.summary.total_questions,
			correctQuestions: api.summary.correct_questions,
			overallAccuracy: api.summary.overall_accuracy,
		},
		trend: (api.trend ?? []).map((t) => ({
			sessionId: t.session_id,
			finishedAt: t.finished_at,
			accuracy: t.accuracy,
			wrongRate: t.wrong_rate,
		})),
		recentSessions: (api.recent_sessions ?? []).map((s) => ({
			sessionId: s.session_id,
			finishedAt: s.finished_at,
			accuracy: s.accuracy,
			correctCount: s.correct_count,
			totalQuestions: s.total_questions,
			scoreLevel: s.score_level,
		})),
		topSessions: (api.top_sessions ?? []).map((s) => ({
			sessionId: s.session_id,
			finishedAt: s.finished_at,
			accuracy: s.accuracy,
			correctCount: s.correct_count,
			totalQuestions: s.total_questions,
		})),
		lowAccuracySessions: (api.low_accuracy_sessions ?? []).map((s) => ({
			sessionId: s.session_id,
			finishedAt: s.finished_at,
			accuracy: s.accuracy,
			correctCount: s.correct_count,
			totalQuestions: s.total_questions,
		})),
		oldestSessions: (api.oldest_sessions ?? []).map((s) => ({
			sessionId: s.session_id,
			finishedAt: s.finished_at,
			accuracy: s.accuracy,
			correctCount: s.correct_count,
			totalQuestions: s.total_questions,
		})),
	};
}

function mapRecentSessions(api: RecentSessionsResponseApi): RecentSession[] {
	return (api.recent_sessions ?? []).map((s) => ({
		sessionId: s.session_id,
		noteId: s.note_id,
		noteTitle: s.note_title,
		categoryId: s.category_id,
		categoryName: s.category_name,
		correctCount: s.correct_count,
		totalQuestions: s.total_questions,
		accuracy: s.accuracy,
		finishedAt: s.finished_at,
	}));
}

export const recordApi = {
	/**
	 * 노트 기준 학습 기록 요약/트렌드
	 * GET /records/notes/{noteId}
	 */
	getNoteRecord: async (noteId: number): Promise<NoteRecord> => {
		const res = await apiClient.get<NoteRecordResponseApi>(
			`/records/notes/${noteId}`
		);
		return mapNoteRecord(res.data);
	},

	/**
	 * 최근 학습 기록(세션) 목록
	 * GET /records/recent-sessions?limit=10
	 */
	getRecentSessions: async (limit = 10): Promise<RecentSession[]> => {
		const res = await apiClient.get<RecentSessionsResponseApi>(
			'/records/recent-sessions',
			{ params: { limit } }
		);
		return mapRecentSessions(res.data);
	},
};
