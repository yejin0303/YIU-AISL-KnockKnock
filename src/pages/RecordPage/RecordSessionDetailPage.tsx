import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageLayout from '../../components/Layout/PageLayout';
import {
	quizApi,
	type QuizSessionDetailResponse,
} from '../../services/api/quizApi';
import { handleApiError } from '../../services/api/authApi';

function calcAccuracy(correct: number, total: number): number {
	if (total <= 0) return 0;
	return Math.round(((correct * 100) / total) * 100) / 100;
}

const RecordSessionDetailPage: React.FC = () => {
	const navigate = useNavigate();
	const { sessionId } = useParams();

	const [detail, setDetail] = useState<QuizSessionDetailResponse | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const id = Number(sessionId);
		if (!Number.isFinite(id) || id <= 0) {
			setError('유효하지 않은 sessionId 입니다.');
			return;
		}

		const load = async () => {
			try {
				setIsLoading(true);
				setError(null);
				const res = await quizApi.getSessionDetail(id);
				setDetail(res);
			} catch (e) {
				console.error('[RecordDetail] 세션 상세 조회 실패', e);
				setError(handleApiError(e));
				setDetail(null);
			} finally {
				setIsLoading(false);
			}
		};

		load();
	}, [sessionId]);

	const summary = useMemo(() => {
		const total = detail?.questions?.length ?? 0;
		const correct = (detail?.questions ?? []).filter((q) => q.isCorrect).length;
		return { total, correct, accuracy: calcAccuracy(correct, total) };
	}, [detail]);

	return (
		<PageLayout
			title="Record"
			subtitle="회차별 채점 결과를 확인하세요!"
			headerActions={
				<div style={{ display: 'flex', gap: 8, marginRight: 16 }}>
					<button
						type="button"
						style={{
							padding: '10px 16px',
							borderRadius: 6,
							border: '1px solid #111827',
							background: '#fff',
							cursor: 'pointer',
							fontWeight: 600,
						}}
						onClick={() => navigate(-1)}
					>
						Back
					</button>
				</div>
			}
			mainContent={
				<div style={{ width: '100%', padding: 16 }}>
					{error && (
						<div style={{ color: '#d9534f', fontSize: 12, margin: '8px 0' }}>
							{error}
						</div>
					)}

					{isLoading && (
						<div style={{ fontSize: 12, color: '#666', margin: '8px 0' }}>
							불러오는 중...
						</div>
					)}

					{detail && (
						<>
							<div
								style={{
									display: 'flex',
									gap: 18,
									alignItems: 'center',
									marginBottom: 12,
								}}
							>
								<div style={{ fontWeight: 700 }}>
									session #{detail.sessionId}
								</div>
								<div style={{ color: '#374151' }}>
									{summary.correct}/{summary.total} ({summary.accuracy}%)
								</div>
								<div style={{ color: '#6b7280' }}>{detail.status}</div>
							</div>

							<div
								style={{
									borderTop: '1px solid #e5e7eb',
									borderBottom: '1px solid #e5e7eb',
								}}
							>
								{(detail.questions ?? []).map((q) => {
									const isCorrect = q.isCorrect;
									const color =
										isCorrect === true
											? '#16a34a'
											: isCorrect === false
											? '#ef4444'
											: '#6b7280';

									return (
										<div
											key={q.id}
											style={{
												padding: '12px 0',
												borderTop: '1px solid #f3f4f6',
											}}
										>
											<div style={{ display: 'flex', gap: 10 }}>
												<div style={{ width: 22, color, fontWeight: 800 }}>
													{isCorrect === true
														? 'O'
														: isCorrect === false
														? 'X'
														: '-'}
												</div>
												<div style={{ flex: 1 }}>
													<div style={{ fontWeight: 700, color: '#111827' }}>
														{q.questionText}
													</div>
													<div style={{ marginTop: 6, color: '#111827' }}>
														<span style={{ fontWeight: 700 }}>내 답: </span>
														<span>{q.userAnswer ?? '(미입력)'}</span>
													</div>
													<div style={{ marginTop: 2, color: '#111827' }}>
														<span style={{ fontWeight: 700 }}>정답: </span>
														<span>{q.answerText}</span>
													</div>
												</div>
											</div>
										</div>
									);
								})}
							</div>
						</>
					)}
				</div>
			}
		/>
	);
};

export default RecordSessionDetailPage;
