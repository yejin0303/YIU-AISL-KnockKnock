import React, { useEffect, useMemo, useState } from 'react';
import './RecordPage.css';
import PageLayout from '../../components/Layout/PageLayout';
import { useNavigate } from 'react-router-dom';

import {
	LineChart,
	Line,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	ResponsiveContainer,
	LabelList,
} from 'recharts';

import arrowDropDown from '../../png/icons/arrow_drop_down.png';
import categoryLeftIcon from '../../png/icons/categoryLefttIcon.png';
import { categoriesApi } from '../../services/api/categoriesApi';
import { notesApi } from '../../services/api/notesApi';
import { recordApi } from '../../services/api/recordApi';
import type { Category, NoteItem } from '../../types/noteTypes';
import { quizApi } from '../../services/api/quizApi';
import { handleApiError } from '../../services/api/authApi';

type TopRecord = {
	sessionId: number;
	date: string;
	textRate: string; // "16/19"
	raw: string; // "84.21%"
	rateColor: 'green' | 'yellow' | 'red';
};

type RecentRecord = {
	sessionId: number;
	modeLetter: 'A' | 'P' | '';
	showModeBadge: boolean;
	title: string;
	correctText: string; // "8/19"
	rateText: string; // "42.11%"
	date: string;
	rateColor: 'green' | 'yellow' | 'red';
};

type HeaderEntry =
	| { type: 'category'; id: string; title: string }
	| { type: 'note'; id: string; title: string };

// 라인 차트 데이터 타입
type LineDatum = {
	shortLabel: string;
	fullDate: string;
	rate: number;
	rateLabel: string;
};

const parseRate = (s: string): number => {
	const n = parseFloat(s.replace('%', ''));
	return isNaN(n) ? 0 : n;
};

// 퍼센트 값으로 색상 클래스 결정
// < 50 : 빨강, 50~80 미만 : 노랑, 80 이상 : 초록
const getRateColorClass = (rateOrString: number | string): string => {
	const rate =
		typeof rateOrString === 'number'
			? rateOrString
			: parseRate(String(rateOrString));

	if (rate < 50) return 'rate-red';
	if (rate < 80) return 'rate-yellow';
	return 'rate-green';
};

// "2025-11-11T20:23:00" (LocalDateTime) → Date (local)
const parseLocalDateTime = (s: string): Date | null => {
	if (!s) return null;
	const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
	if (!m) return null;
	const [, y, mo, d, h, mi, sec] = m;
	return new Date(
		Number(y),
		Number(mo) - 1,
		Number(d),
		Number(h),
		Number(mi),
		sec ? Number(sec) : 0
	);
};

const pad2 = (n: number) => String(n).padStart(2, '0');

// Date → "2025년 11월 11일 20:23"
const formatKoreanDate = (d: Date): string => {
	return `${d.getFullYear()}년 ${pad2(d.getMonth() + 1)}월 ${pad2(
		d.getDate()
	)}일 ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

// "2025년 11월 11일 20:23" → ["2025년", "11월 11일", "20:23"]
const splitKoreanDateLines = (s: string): string[] => {
	const m = s.match(
		/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*(\d{1,2}):(\d{2})/
	);
	if (!m) return [s];

	const [, y, mo, d, h, mi] = m;
	const mm = mo.padStart(2, '0');
	const dd = d.padStart(2, '0');
	const hh = h.padStart(2, '0');
	const min = mi.padStart(2, '0');

	return [`${y}년`, `${mm}월 ${dd}일`, `${hh}:${min}`];
};

const formatAccuracy = (v: number): string => {
	const rounded = Math.round(v * 100) / 100;
	if (Number.isInteger(rounded)) return `${rounded}%`;
	return `${rounded.toFixed(2)}%`;
};

const RecordPage: React.FC = () => {
	const navigate = useNavigate();

	// 헤더 드롭다운 상태들
	const [isTitleOpen, setIsTitleOpen] = useState(false);
	const [dropdownLevel, setDropdownLevel] = useState<'category' | 'session'>(
		'category'
	);

	const UNCATEGORIZED_ID = '__uncategorized__';

	const [categories, setCategories] = useState<Category[]>([]);
	// categoryId(or UNCATEGORIZED_ID) -> notes list
	const [notesByCategoryId, setNotesByCategoryId] = useState<
		Record<string, NoteItem[]>
	>({});
	const [notesLoadingByCategoryId, setNotesLoadingByCategoryId] = useState<
		Record<string, boolean>
	>({});

	// 선택된 카테고리 / 노트
	const [activeCategoryId, setActiveCategoryId] = useState<string>('');
	const [activeNoteId, setActiveNoteId] = useState<string>('');

	const [noteRecordLoading, setNoteRecordLoading] = useState(false);
	const [noteRecordError, setNoteRecordError] = useState<string | null>(null);
	const [noteRecord, setNoteRecord] = useState<any | null>(null);

	// 최근 세션(전체) - 하단 표를 필터링해서 사용
	const [recentSessionsLoading, setRecentSessionsLoading] = useState(false);
	const [recentSessionsError, setRecentSessionsError] = useState<string | null>(
		null
	);
	const [recentSessions, setRecentSessions] = useState<any[]>([]);

	// sessionId -> { correctCount, totalQuestions } (최신/오래된 정렬에서 counts 보강용)
	const [sessionCountsById, setSessionCountsById] = useState<
		Record<number, { correctCount: number; totalQuestions: number }>
	>({});

	// sessionId -> mode (ALL_TRY/PART_TRY) 캐시 (최근 학습 기록 A/P 표시용)
	const [sessionModeById, setSessionModeById] = useState<
		Record<number, string>
	>({});

	const headerEntries: HeaderEntry[] = useMemo(() => {
		const sorted = [...categories].sort(
			(a, b) => (a.order ?? 0) - (b.order ?? 0)
		);

		const entries: HeaderEntry[] = sorted.map((c) => ({
			type: 'category',
			id: c.id,
			title: c.name,
		}));

		// ✅ 서버 정책상 미분류 노트는 /notes 로 가져오므로, 1단계에서 "노트 제목"으로 직접 노출
		const uncategorized = notesByCategoryId[UNCATEGORIZED_ID] ?? [];
		uncategorized.forEach((n) => {
			entries.push({
				type: 'note',
				id: n.id,
				title: n.name,
			});
		});

		return entries;
	}, [categories, notesByCategoryId]);

	const activeCategory = useMemo(() => {
		if (!activeCategoryId || activeCategoryId === UNCATEGORIZED_ID) return null;
		return categories.find((c) => c.id === activeCategoryId) ?? null;
	}, [categories, activeCategoryId]);

	const activeCategoryNotes = useMemo(() => {
		if (!activeCategoryId) return [];
		return notesByCategoryId[activeCategoryId] ?? [];
	}, [notesByCategoryId, activeCategoryId]);

	const activeNote =
		activeCategoryNotes.find((n) => n.id === activeNoteId) ??
		activeCategoryNotes[0] ??
		null;

	const mainTitle = useMemo(() => {
		// 일반(미분류) 노트: 제목만
		if (activeCategoryId === UNCATEGORIZED_ID)
			return activeNote?.name ?? '노트 선택';

		// 카테고리 선택: "카테고리 > 노트" 형태
		const catTitle = activeCategory?.name ?? '카테고리 선택';
		return activeNote ? `${catTitle} > ${activeNote.name}` : catTitle;
	}, [activeCategory, activeNote]);

	// 정렬 드롭다운
	const [sortLabel, setSortLabel] = useState<
		'정답률 높은 순' | '정답률 낮은 순' | '최신순' | '오래된 순'
	>('정답률 높은 순');
	const [showSortMenu, setShowSortMenu] = useState(false);

	// 초기 로딩: categories + (미분류 notes) + recent-sessions (하단 테이블)
	useEffect(() => {
		const load = async () => {
			try {
				const [cats, uncategorizedNotes] = await Promise.all([
					categoriesApi.getCategories(),
					// ⚠️ 서버 정책: categoryId가 없으면 "미분류 노트"만 내려줌
					notesApi.getNotes(),
				]);

				setCategories(cats);
				setNotesByCategoryId({
					[UNCATEGORIZED_ID]: uncategorizedNotes,
				});

				// 기본 선택:
				// 1) 미분류 노트가 있으면 그 첫 노트
				// 2) 없으면 첫 카테고리 선택만 해두고, 노트는 카테고리 클릭 시 로딩
				if (uncategorizedNotes.length > 0) {
					setActiveCategoryId(UNCATEGORIZED_ID);
					setActiveNoteId(uncategorizedNotes[0].id);
				} else if (cats.length > 0) {
					setActiveCategoryId(cats[0].id);
					setActiveNoteId('');
				} else {
					setActiveCategoryId(UNCATEGORIZED_ID);
					setActiveNoteId('');
				}
			} catch (e) {
				console.error('[Record] 초기 로딩 실패', e);
			}

			// 최근 세션 목록도 함께
			try {
				setRecentSessionsLoading(true);
				setRecentSessionsError(null);
				const items = await recordApi.getRecentSessions(50);
				setRecentSessions(items);
			} catch (e) {
				console.error('[Record] recent-sessions 실패', e);
				setRecentSessionsError(handleApiError(e));
			} finally {
				setRecentSessionsLoading(false);
			}
		};

		load();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// 카테고리 선택 시: 해당 카테고리의 노트 목록을 지연 로딩
	useEffect(() => {
		const loadNotesForCategory = async (categoryId: string) => {
			if (!categoryId) return;
			if (notesByCategoryId[categoryId]) return; // 이미 로드됨

			try {
				setNotesLoadingByCategoryId((prev) => ({
					...prev,
					[categoryId]: true,
				}));
				const fetched =
					categoryId === UNCATEGORIZED_ID
						? await notesApi.getNotes()
						: await notesApi.getNotes(categoryId);

				setNotesByCategoryId((prev) => ({ ...prev, [categoryId]: fetched }));
			} catch (e) {
				console.error('[Record] 카테고리 노트 로딩 실패', e);
				setNotesByCategoryId((prev) => ({ ...prev, [categoryId]: [] }));
			} finally {
				setNotesLoadingByCategoryId((prev) => ({
					...prev,
					[categoryId]: false,
				}));
			}
		};

		void loadNotesForCategory(activeCategoryId);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [activeCategoryId]);

	// 현재 카테고리의 노트 목록이 갱신되면, activeNoteId 보정(비어있거나 사라진 경우)
	useEffect(() => {
		if (!activeCategoryId) return;
		const list = notesByCategoryId[activeCategoryId] ?? [];
		if (list.length === 0) return;

		const exists = list.some((n) => n.id === activeNoteId);
		if (!exists) setActiveNoteId(list[0].id);
	}, [activeCategoryId, notesByCategoryId, activeNoteId]);

	// 노트 선택 시: note record 조회
	useEffect(() => {
		const load = async () => {
			if (!activeNoteId) return;
			const noteIdNum = Number(activeNoteId);
			if (!Number.isFinite(noteIdNum) || noteIdNum <= 0) return;

			try {
				setNoteRecordLoading(true);
				setNoteRecordError(null);
				const data = await recordApi.getNoteRecord(noteIdNum);
				setNoteRecord(data);
			} catch (e) {
				console.error('[Record] note record 실패', e);
				setNoteRecordError(handleApiError(e));
				setNoteRecord(null);
			} finally {
				setNoteRecordLoading(false);
			}
		};

		load();
	}, [activeNoteId]);

	const donutValue = Math.round(noteRecord?.summary?.overallAccuracy ?? 0);
	const donutColor = useMemo(() => {
		if (donutValue < 50) return '#ef4444';
		if (donutValue < 80) return '#eab308';
		return '#16a34a';
	}, [donutValue]);

	const lineData: LineDatum[] = useMemo(() => {
		const trend = (noteRecord?.trend ?? []) as {
			sessionId: number;
			finishedAt: string;
			accuracy: number;
		}[];

		return trend.map((t) => {
			const d = parseLocalDateTime(t.finishedAt);
			const fullDate = d ? formatKoreanDate(d) : String(t.finishedAt);
			const shortLabel = d
				? `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`
				: '-';
			return {
				shortLabel,
				fullDate,
				rate: t.accuracy,
				rateLabel: formatAccuracy(t.accuracy),
			};
		});
	}, [noteRecord]);

	const ensureSessionCounts = async (sessionIds: number[]) => {
		const need = sessionIds.filter((id) => !sessionCountsById[id]);
		if (need.length === 0) return;

		try {
			const details = await Promise.all(
				need.map((id) => quizApi.getSessionDetail(id))
			);

			setSessionCountsById((prev) => {
				const next = { ...prev };
				details.forEach((d) => {
					const total = d.questions?.length ?? 0;
					const correct = (d.questions ?? []).filter((q) => q.isCorrect).length;
					next[d.sessionId] = { correctCount: correct, totalQuestions: total };
				});
				return next;
			});
		} catch (e) {
			console.error('[Record] 세션 상세(counts) 조회 실패', e);
		}
	};

	const ensureSessionModes = async (sessionIds: number[]) => {
		const need = sessionIds.filter((id) => !sessionModeById[id]);
		if (need.length === 0) return;

		try {
			const details = await Promise.allSettled(
				need.map((id) => quizApi.getSessionDetail(id))
			);

			setSessionModeById((prev) => {
				const next = { ...prev };
				details.forEach((r) => {
					if (r.status !== 'fulfilled') return;
					next[r.value.sessionId] = r.value.mode;
				});
				return next;
			});
		} catch (e) {
			console.error('[Record] 세션 상세(mode) 조회 실패', e);
		}
	};

	const sortedTopRecords: TopRecord[] = useMemo(() => {
		if (!noteRecord) return [];

		const top = (noteRecord.topSessions ?? []).map((s: any) => {
			const d = parseLocalDateTime(s.finishedAt);
			const date = d ? formatKoreanDate(d) : String(s.finishedAt);
			return {
				sessionId: s.sessionId,
				date,
				textRate: `${s.correctCount}/${s.totalQuestions}`,
				raw: formatAccuracy(s.accuracy),
				rateColor:
					s.accuracy < 50 ? 'red' : s.accuracy < 80 ? 'yellow' : 'green',
			} as TopRecord;
		});

		const low = (noteRecord.lowAccuracySessions ?? []).map((s: any) => {
			const d = parseLocalDateTime(s.finishedAt);
			const date = d ? formatKoreanDate(d) : String(s.finishedAt);
			return {
				sessionId: s.sessionId,
				date,
				textRate: `${s.correctCount}/${s.totalQuestions}`,
				raw: formatAccuracy(s.accuracy),
				rateColor:
					s.accuracy < 50 ? 'red' : s.accuracy < 80 ? 'yellow' : 'green',
			} as TopRecord;
		});

		const trend = (noteRecord.trend ?? []) as {
			sessionId: number;
			finishedAt: string;
			accuracy: number;
		}[];

		if (sortLabel === '정답률 높은 순') return top;
		if (sortLabel === '정답률 낮은 순') return low;

		if (sortLabel === '최신순') {
			const newest = [...trend].slice(-3).reverse();
			const ids = newest.map((t) => t.sessionId);
			void ensureSessionCounts(ids);

			return newest.map((t) => {
				const d = parseLocalDateTime(t.finishedAt);
				const date = d ? formatKoreanDate(d) : String(t.finishedAt);
				const cnt = sessionCountsById[t.sessionId];
				const textRate = cnt
					? `${cnt.correctCount}/${cnt.totalQuestions}`
					: '-/-';
				return {
					sessionId: t.sessionId,
					date,
					textRate,
					raw: formatAccuracy(t.accuracy),
					rateColor:
						t.accuracy < 50 ? 'red' : t.accuracy < 80 ? 'yellow' : 'green',
				} as TopRecord;
			});
		}

		// 오래된 순
		const oldest = [...trend].slice(0, 3);
		const ids = oldest.map((t) => t.sessionId);
		void ensureSessionCounts(ids);

		return oldest.map((t) => {
			const d = parseLocalDateTime(t.finishedAt);
			const date = d ? formatKoreanDate(d) : String(t.finishedAt);
			const cnt = sessionCountsById[t.sessionId];
			const textRate = cnt
				? `${cnt.correctCount}/${cnt.totalQuestions}`
				: '-/-';
			return {
				sessionId: t.sessionId,
				date,
				textRate,
				raw: formatAccuracy(t.accuracy),
				rateColor:
					t.accuracy < 50 ? 'red' : t.accuracy < 80 ? 'yellow' : 'green',
			} as TopRecord;
		});
	}, [noteRecord, sortLabel, sessionCountsById]);

	const sortedRecentRecords: RecentRecord[] = useMemo(() => {
		// ✅ "최근 학습 기록"은 선택된 노트와 무관하게 전체 노트의 기록을 최신순으로 표시
		const sorted = [...recentSessions].sort((a, b) => {
			const da = parseLocalDateTime(a.finishedAt)?.getTime() ?? 0;
			const db = parseLocalDateTime(b.finishedAt)?.getTime() ?? 0;
			return db - da;
		});

		const ids = sorted.map((s) => s.sessionId);
		// A/P 뱃지용 mode 캐시 로딩
		void ensureSessionModes(ids);

		// ✅ "최초 채점(첫 회차)"에는 A/P를 표시하지 않음 (노트별로 적용)
		// noteId별 earliest finishedAt 계산
		const earliestByNoteId = new Map<number, number>();
		sorted.forEach((s) => {
			const noteId = Number(s.noteId);
			if (!Number.isFinite(noteId)) return;
			const t = parseLocalDateTime(s.finishedAt)?.getTime();
			if (t == null) return;
			const prev = earliestByNoteId.get(noteId);
			if (prev == null || t < prev) earliestByNoteId.set(noteId, t);
		});

		return sorted.map((s) => {
			const title =
				s.categoryName && s.noteTitle
					? `${s.categoryName} > ${s.noteTitle}`
					: s.noteTitle ?? '(제목 없음)';
			const d = parseLocalDateTime(s.finishedAt);
			const date = d ? formatKoreanDate(d) : String(s.finishedAt);
			const mode = sessionModeById[s.sessionId] ?? '';
			const modeLetter =
				mode === 'ALL_TRY' ? 'A' : mode === 'PART_TRY' ? 'P' : '';

			const noteId = Number(s.noteId);
			const ts = d?.getTime() ?? null;
			const earliest = Number.isFinite(noteId)
				? earliestByNoteId.get(noteId) ?? null
				: null;
			const isFirstAttempt = earliest != null && ts === earliest;

			const showModeBadge = !isFirstAttempt && modeLetter !== '';
			return {
				sessionId: s.sessionId,
				modeLetter,
				showModeBadge,
				title,
				correctText: `${s.correctCount}/${s.totalQuestions}`,
				rateText: formatAccuracy(s.accuracy),
				date,
				rateColor:
					s.accuracy < 50 ? 'red' : s.accuracy < 80 ? 'yellow' : 'green',
			} as RecentRecord;
		});
	}, [recentSessions, sessionModeById]);

	// 그래프 위 퍼센트 라벨 (색상도 퍼센트에 따라 결정)
	const renderRateLabel = (props: any) => {
		const { x, y, value } = props;
		if (x == null || y == null) return null;

		const numericRate =
			typeof value === 'number' ? value : parseRate(String(value));
		const colorClass = getRateColorClass(numericRate);

		return (
			<text x={x} y={y - 12} className={`record-line-label ${colorClass}`}>
				{value}
			</text>
		);
	};

	// X축 tick: 날짜를 3줄로 표시 (각 tick 아래 중앙 정렬)
	const renderXAxisTick = (props: any) => {
		const { x, y, payload } = props;
		if (x == null || y == null || !payload) return null;

		const idx = payload.index;
		const fullDate: string = lineData[idx]?.fullDate || String(payload.value);

		const lines = splitKoreanDateLines(fullDate);

		return (
			<g transform={`translate(${x},${y})`}>
				<text textAnchor="middle" className="record-xaxis-date">
					{lines.map((line: string, i: number) => (
						<tspan key={i} x={0} dy={i === 0 ? 0 : 22}>
							{line}
						</tspan>
					))}
				</text>
			</g>
		);
	};

	// 라인 차트 Tooltip: 날짜 + 시간 + 정답률 표시
	const renderLineTooltip = (props: any) => {
		const { active, payload } = props;
		if (!active || !payload || !payload.length) return null;

		const datum = payload[0].payload as LineDatum;
		const fullDate: string = datum.fullDate;
		const rate: number = datum.rate;

		return (
			<div className="record-line-tooltip">
				<div className="record-line-tooltip-date">{fullDate}</div>
				<div className="record-line-tooltip-rate">{rate.toFixed(2)}%</div>
			</div>
		);
	};

	// Retry 버튼 클릭 시: 선택된 카테고리/세션에 맞는 퀴즈 페이지로 이동
	const handleRetry = () => {
		if (!activeNoteId) return;
		navigate(`/quiz?noteId=${encodeURIComponent(activeNoteId)}`);
	};

	// more 버튼 클릭 시: 해당 회차(세션) 결과 상세 페이지로 이동
	const handleMoreClick = (item: RecentRecord) => {
		// "조회 전용": 당시 채점된 퀴즈 화면 그대로 재현(QuizPage review 모드)
		navigate(`/quiz?sessionId=${encodeURIComponent(String(item.sessionId))}`);
	};

	return (
		<PageLayout
			title="Record"
			subtitle="지금까지의 학습 기록을 확인하세요!"
			headerActions={
				<div className="record-header-actions">
					{/* 헤더 우측 드롭다운 */}
					<div className="record-header-dropdown-wrapper">
						<div
							className="record-header-select"
							onClick={() => {
								setIsTitleOpen((prev) => !prev);
								setDropdownLevel('category');
							}}
						>
							<span className="record-header-dropdown-text">{mainTitle}</span>
							<button
								type="button"
								className="record-header-dropdown-arrow-btn"
							>
								<img
									src={arrowDropDown}
									alt="dropdown"
									className="dropdown-icon"
								/>
							</button>
						</div>

						{isTitleOpen && (
							<div className="record-header-dropdown-card">
								{dropdownLevel === 'category' ? (
									<>
										<div className="record-header-dropdown-card-top"></div>
										<div className="record-header-session-list">
											{headerEntries.map((entry) => (
												<div
													key={`${entry.type}:${entry.id}`}
													className={
														'record-header-session-item' +
														((entry.type === 'category' &&
															entry.id === activeCategoryId) ||
														(entry.type === 'note' &&
															activeCategoryId === UNCATEGORIZED_ID &&
															entry.id === activeNoteId)
															? ' record-header-session-item--active'
															: '')
													}
													onClick={() => {
														if (entry.type === 'category') {
															setActiveCategoryId(entry.id);
															setDropdownLevel('session');
														} else {
															// ✅ 일반 노트는 1단계에서 바로 선택
															setActiveCategoryId(UNCATEGORIZED_ID);
															setActiveNoteId(entry.id);
															setIsTitleOpen(false);
															setDropdownLevel('category');
														}
													}}
												>
													{entry.title}
												</div>
											))}
										</div>
									</>
								) : (
									<>
										<div className="record-header-dropdown-card-top">
											<button
												className="record-header-left-icon clickable"
												type="button"
												onClick={() => setDropdownLevel('category')}
											>
												<img
													src={categoryLeftIcon}
													alt="back"
													className="left-icon"
												/>
											</button>
											<span className="record-header-dropdown-title">
												{activeCategory?.name ?? '카테고리'}
											</span>
										</div>

										<div className="record-header-session-list">
											{notesLoadingByCategoryId[activeCategoryId] ? (
												<div
													style={{
														fontSize: 12,
														color: '#6b7280',
														padding: '6px 2px',
													}}
												>
													불러오는 중...
												</div>
											) : activeCategoryNotes.length === 0 ? (
												<div
													style={{
														fontSize: 12,
														color: '#6b7280',
														padding: '6px 2px',
													}}
												>
													노트가 없습니다.
												</div>
											) : (
												activeCategoryNotes.map((note) => {
													const noteId = note.id;
													const label = note?.name ?? '(제목 없음)';
													return (
														<div
															key={noteId}
															className={
																'record-header-session-item' +
																(noteId === activeNoteId
																	? ' record-header-session-item--active'
																	: '')
															}
															onClick={() => {
																setActiveNoteId(noteId);
																setIsTitleOpen(false);
															}}
														>
															{label}
														</div>
													);
												})
											)}
										</div>
									</>
								)}
							</div>
						)}
					</div>

					<button
						type="button"
						className="record-header-retry"
						onClick={handleRetry}
					>
						Retry
					</button>
				</div>
			}
			mainContent={
				<div className="record-page">
					<div className="record-card">
						{noteRecordError && (
							<div style={{ color: '#d9534f', fontSize: 12, margin: '8px 0' }}>
								{noteRecordError}
							</div>
						)}
						{/* 위쪽: 도넛 + 그래프 + 정답률 리스트 */}
						<div className="record-top-grid">
							{/* 도넛 */}
							<div className="record-donut-section">
								<div
									className="record-donut-chart"
									style={{
										background: `conic-gradient(${donutColor} 0 ${donutValue}%, #e4e6fb ${donutValue}% 100%)`,
									}}
								>
									<div className="record-donut-inner">
										<div className="record-donut-label">정답률</div>
										<div className="record-donut-value">{donutValue}%</div>
									</div>
								</div>
							</div>

							{/* 라인 차트 */}
							<div className="record-chart-section">
								<div className="record-section-title">
									지난 오답률 대비 변화
								</div>
								<div className="record-linechart-wrapper">
									<ResponsiveContainer width="100%" height="100%">
										<LineChart
											data={lineData}
											margin={{ top: 30, bottom: 30, right: 180 }}
										>
											<CartesianGrid strokeDasharray="3 3" vertical={false} />
											<XAxis
												dataKey="shortLabel"
												height={70}
												tick={renderXAxisTick}
												interval={0}
												tickMargin={22}
											/>
											<YAxis
												tick={{ fontSize: 16 }}
												dx={-5}
												domain={[0, 100]} // 0~100% 고정
											/>
											<Tooltip content={renderLineTooltip} />
											<Line
												dataKey="rate"
												stroke="#4F46E5"
												strokeWidth={2}
												dot={(props: any) => (
													<circle
														cx={props.cx}
														cy={props.cy}
														r={6}
														fill="#4F46E5"
														stroke="#4F46E5"
													/>
												)}
												activeDot={{ r: 8 }}
											>
												<LabelList
													dataKey="rateLabel"
													content={renderRateLabel}
												/>
											</Line>
										</LineChart>
									</ResponsiveContainer>
								</div>
							</div>

							{/* 정답률 정렬 리스트 + 드롭다운 */}
							<div className="record-toplist-section">
								<div className="record-toplist-header">
									<span className="record-section-title">{sortLabel}</span>
									<button
										type="button"
										className="record-sort-button"
										onClick={() => setShowSortMenu((prev) => !prev)}
									>
										<img
											src={arrowDropDown}
											alt="dropdown"
											className="dropdown-icon"
										/>
									</button>

									{showSortMenu && (
										<div className="record-sort-menu">
											<div
												onClick={() => {
													setSortLabel('정답률 높은 순');
													setShowSortMenu(false);
												}}
											>
												정답률 높은 순
											</div>
											<div
												onClick={() => {
													setSortLabel('정답률 낮은 순');
													setShowSortMenu(false);
												}}
											>
												정답률 낮은 순
											</div>
											<div
												onClick={() => {
													setSortLabel('최신순');
													setShowSortMenu(false);
												}}
											>
												최신순
											</div>
											<div
												onClick={() => {
													setSortLabel('오래된 순');
													setShowSortMenu(false);
												}}
											>
												오래된 순
											</div>
										</div>
									)}
								</div>

								<div className="record-toplist-body">
									{sortedTopRecords.map((item, idx) => {
										const rateNum = parseRate(item.raw);
										const colorClass = getRateColorClass(rateNum);
										return (
											<div
												className="record-toplist-row"
												key={item.sessionId ?? idx}
											>
												<div className="record-toplist-date">{item.date}</div>
												<div className="record-toplist-correct">
													{item.textRate}
												</div>
												<div className={`record-toplist-rate ${colorClass}`}>
													{item.raw}
												</div>
											</div>
										);
									})}
									{noteRecordLoading && (
										<div
											style={{ fontSize: 12, color: '#666', padding: '8px 0' }}
										>
											불러오는 중...
										</div>
									)}
								</div>
							</div>
						</div>

						{/* 아래쪽: 최근 학습 기록 */}
						<div className="record-bottom">
							<div className="record-recent-title-label">최근 학습 기록</div>
							<div className="record-bottom-divider" />
							<div className="record-recent-table">
								{sortedRecentRecords.map((item, idx) => {
									const rateNum = parseRate(item.rateText);
									const colorClass = getRateColorClass(rateNum);
									return (
										<div
											className="record-recent-row"
											key={item.sessionId ?? idx}
										>
											<div className="record-recent-title">
												<span
													className={
														'record-recent-badge' +
														(item.showModeBadge
															? ''
															: ' record-recent-badge--empty')
													}
												>
													{item.showModeBadge ? item.modeLetter : ''}
												</span>
												{item.title}
											</div>
											<div className="record-recent-correct">
												{item.correctText}
											</div>
											<div className={`record-recent-rate ${colorClass}`}>
												{item.rateText}
											</div>
											<div className="record-recent-date">{item.date}</div>
											<button
												type="button"
												className="record-recent-more"
												onClick={() => handleMoreClick(item)}
											>
												more
											</button>
										</div>
									);
								})}
								{recentSessionsLoading && (
									<div
										style={{ fontSize: 12, color: '#666', padding: '8px 0' }}
									>
										최근 기록 불러오는 중...
									</div>
								)}
								{recentSessionsError && (
									<div
										style={{ fontSize: 12, color: '#d9534f', padding: '8px 0' }}
									>
										{recentSessionsError}
									</div>
								)}
							</div>
						</div>
					</div>
				</div>
			}
		/>
	);
};

export default RecordPage;
