	import React, { useEffect, useMemo, useState } from 'react';
import './QuizPage.css';

import { useNoteData } from '../../hooks/useNoteData';
import { NoteSidebar } from '../../components/Note/NoteSidebar/NoteSidebar';
import PageLayout from '../../components/Layout/PageLayout';
import { useLocation, useNavigate } from 'react-router-dom';
import type { NoteItem, QuizHighlight } from '../../types/noteTypes';
import { handleApiError } from '../../services/api/authApi';
import {
	quizApi,
	type QuizSessionDetailResponse,
} from '../../services/api/quizApi';
import { keywordApi } from '../../services/api/keywordApi';
import type { WrongKeywordApiItem } from '../../services/api/keywordApi';

// 한 줄을 "일반 텍스트" / "빈칸" 조각으로 나누기 위한 타입
type Segment =
	| { type: 'text'; text: string }
	| { type: 'blank'; text: string; blankIndex: number };

type ParsedLine = Segment[];

function getDisplayTextFromHtml(html: string): string {
	if (!html) return '';
	try {
		// ⚠️ 중요:
		// 키워드 offset은 DOM TextNode 기준(flatText)으로 계산되어 있음.
		// displayText를 단순 문자열 치환(stripTags)로 만들면 &nbsp; 같은 엔티티가 "문자열 길이"를 깨뜨려
		// flatText↔displayText 매핑이 실패하고(-> fallback), 줄바꿈이 사라질 수 있다.
		//
		// 따라서 displayText도 DOM을 통해 텍스트를 얻어(엔티티 디코딩 포함),
		// block/BR 경계에서만 \n을 삽입해 "보기용 줄바꿈"을 만든다.
		const parser = new DOMParser();
		const doc = parser.parseFromString(html, 'text/html');
		const root = doc.body;

		const blockTags = new Set([
			'DIV',
			'P',
			'LI',
			'H1',
			'H2',
			'H3',
			'H4',
			'H5',
			'H6',
		]);

		let out = '';
		const ensureNewline = () => {
			if (out.length === 0) return;
			if (!out.endsWith('\n')) out += '\n';
		};

		const walk = (node: Node) => {
			if (node.nodeType === Node.TEXT_NODE) {
				out += node.nodeValue ?? '';
				return;
			}

			if (node.nodeType !== Node.ELEMENT_NODE) return;
			const el = node as HTMLElement;
			const tag = el.tagName;

			if (tag === 'BR') {
				out += '\n';
				return;
			}

			const isBlock = blockTags.has(tag);
			if (isBlock) ensureNewline();

			for (const child of Array.from(el.childNodes)) {
				walk(child);
			}

			if (isBlock) ensureNewline();
		};

		for (const child of Array.from(root.childNodes)) walk(child);

		return out.replace(/\r\n?/g, '\n');
	} catch {
		// fallback
		return stripTags(html).replace(/\r\n?/g, '\n');
	}
}

function getFlatTextFromHtml(html: string): string {
	if (!html) return '';
	try {
		const parser = new DOMParser();
		const doc = parser.parseFromString(html, 'text/html');

		let result = '';
		const root = doc.body;
		const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);

		let node = walker.nextNode() as Text | null;
		while (node) {
			result += node.nodeValue ?? '';
			node = walker.nextNode() as Text | null;
		}

		return result;
	} catch {
		// fallback: 기존 로직 (정확도는 떨어질 수 있음)
		return stripTags(html);
	}
}

function buildDisplayIndicesByFlatOffset(
	displayText: string,
	flatLen: number
): { start: number[]; end: number[] } | null {
	/**
	 * flatText(줄바꿈 제외) offset → displayText(줄바꿈 포함) index 매핑
	 *
	 * 문제 배경:
	 * - displayText에는 block/BR 기준으로 \n이 삽입된다.
	 * - \n은 flatPos(줄바꿈 제외 문자 count)를 증가시키지 않으므로,
	 *   같은 flatPos 위치에 "여러 display index"가 존재할 수 있다.
	 *
	 * 여기서는 같은 flatPos에 대해 두 가지 경계를 만든다:
	 * - start[flatPos]: 해당 flatPos로 막 도달한 '첫' display index (뒤따르는 \n 포함 전)
	 * - end[flatPos]: 해당 flatPos에서 가능한 '마지막' display index (뒤따르는 \n 포함 후)
	 *
	 * 이렇게 하면, 빈칸(blank) 세그먼트 경계에 바로 오는 줄바꿈이
	 * 이전 slice로 흡수되어 사라지는 문제를 방지할 수 있다.
	 */
	const start = new Array<number>(flatLen + 1).fill(0);
	const end = new Array<number>(flatLen + 1).fill(0);

	let flatPos = 0;
	start[0] = 0;
	end[0] = 0;

	for (let displayIdx = 0; displayIdx < displayText.length; displayIdx++) {
		const ch = displayText[displayIdx];

		if (ch === '\n' || ch === '\r') {
			// 줄바꿈은 flatPos는 그대로이므로 end만 앞으로 밀어준다(줄바꿈을 포함시키기 위함)
			end[flatPos] = displayIdx + 1;
			continue;
		}

		flatPos++;
		if (flatPos > flatLen) break;
		start[flatPos] = displayIdx + 1;
		end[flatPos] = displayIdx + 1;
	}

	// displayText의 (줄바꿈 제외) 길이와 flatLen이 다르면 offset 매칭이 깨질 수 있으므로 fallback 유도
	if (flatPos !== flatLen) return null;

	return { start, end };
}

function stripTags(html: string): string {
	if (!html) return '';
	return html
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<div[^>]*>/gi, '\n')
		.replace(/<(p|li|h[1-6])[^>]*>/gi, '\n')
		.replace(/<\/(p|li|h[1-6])>/gi, '\n')
		.replace(/<[^>]+>/g, '')
		.replace(/\r\n?/g, '\n');
}

function splitSegmentsIntoLines(wholeSegments: Segment[]): ParsedLine[] {
	const parsedLines: ParsedLine[] = [];
	let currentLine: ParsedLine = [];

	const pushCurrentLine = () => {
		if (currentLine.length === 0) {
			parsedLines.push([{ type: 'text', text: '' }]);
		} else {
			parsedLines.push(currentLine);
		}
		currentLine = [];
	};

	wholeSegments.forEach((seg) => {
		if (seg.type === 'text') {
			const parts = seg.text.split('\n');
			parts.forEach((part, idx) => {
				if (part !== '') currentLine.push({ type: 'text', text: part });
				if (idx < parts.length - 1) pushCurrentLine();
			});
		} else {
			currentLine.push(seg);
		}
	});

	if (currentLine.length > 0) parsedLines.push(currentLine);
	return parsedLines;
}

function parseContentFromHighlight(html: string): {
	parsedLines: ParsedLine[];
	answers: string[];
} {
	if (!html) return { parsedLines: [], answers: [] };

	const answers: string[] = [];
	const wholeSegments: Segment[] = [];

	const highlightRegex = /<(mark|span)([^>]*)>(.*?)<\/\1>/gis;

	let lastIndex = 0;
	let match: RegExpExecArray | null;

	while ((match = highlightRegex.exec(html)) !== null) {
		const [fullMatch, tagName, attrs, innerHTML] = match;
		const start = match.index;

		if (start > lastIndex) {
			const beforeHtml = html.slice(lastIndex, start);
			const beforeText = stripTags(beforeHtml);
			if (beforeText) wholeSegments.push({ type: 'text', text: beforeText });
		}

		const lowerTag = String(tagName).toLowerCase();
		const isHighlightTag =
			lowerTag === 'mark' ||
			/tiptap-highlight/i.test(attrs) ||
			/data-type=["']highlight["']/i.test(attrs);

		const innerText = stripTags(innerHTML).trim();

		if (isHighlightTag && innerText) {
			const blankIndex = answers.length;
			answers.push(innerText);
			wholeSegments.push({ type: 'blank', text: innerText, blankIndex });
		} else if (innerText) {
			wholeSegments.push({ type: 'text', text: innerText });
		}

		lastIndex = start + fullMatch.length;
	}

	if (lastIndex < html.length) {
		const afterHtml = html.slice(lastIndex);
		const afterText = stripTags(afterHtml);
		if (afterText) wholeSegments.push({ type: 'text', text: afterText });
	}

	return { parsedLines: splitSegmentsIntoLines(wholeSegments), answers };
}

function buildQuizFromContentAndHighlights(
	html: string,
	highlights?: QuizHighlight[]
): {
	parsedLines: ParsedLine[];
	answers: string[];
	orderedKeywordIds: string[];
} {
	if (!highlights || highlights.length === 0) {
		const parsed = parseContentFromHighlight(html);
		return { ...parsed, orderedKeywordIds: [] };
	}

	const answers: string[] = [];
	const orderedKeywordIds: string[] = [];
	// ⚠️ 키워드 offset은 NoteEditor에서 TextNode 기준(flat text; 줄바꿈 없음)으로 계산됨
	// 표시용 텍스트는 줄바꿈이 포함되어야 하므로:
	// - flatText: offset 매칭/범위 계산용
	// - displayText: 화면 표시/줄바꿈 반영용
	const flatText = getFlatTextFromHtml(html);
	const displayText = getDisplayTextFromHtml(html);
	const displayIndicesByFlat = buildDisplayIndicesByFlatOffset(
		displayText,
		flatText.length
	);

	// 매핑 실패 시(엔티티/공백 처리 차이 등)에는 기존 방식(줄바꿈 없이)으로 fallback
	if (!displayIndicesByFlat) {
		const sortedFallback = [...highlights].sort(
			(a, b) => a.startOffset - b.startOffset
		);

		const wholeSegmentsFallback: Segment[] = [];
		let cursorFallback = 0;

		sortedFallback.forEach((h) => {
			const offset = h.startOffset;
			const text = h.text;
			if (!text) return;

			if (offset > cursorFallback) {
				const before = flatText.slice(cursorFallback, offset);
				if (before) wholeSegmentsFallback.push({ type: 'text', text: before });
			}

			const blankIndex = answers.length;
			answers.push(text);
			orderedKeywordIds.push(String((h as any).id ?? ''));
			wholeSegmentsFallback.push({ type: 'blank', text, blankIndex });

			cursorFallback = h.endOffset ?? offset + text.length;
		});

		if (cursorFallback < flatText.length) {
			const after = flatText.slice(cursorFallback);
			if (after) wholeSegmentsFallback.push({ type: 'text', text: after });
		}

		return {
			parsedLines: splitSegmentsIntoLines(wholeSegmentsFallback),
			answers,
			orderedKeywordIds,
		};
	}

	const sorted = [...highlights].sort((a, b) => a.startOffset - b.startOffset);

	const wholeSegments: Segment[] = [];
	let cursorFlat = 0;

	sorted.forEach((h) => {
		const { text } = h;
		const offset = Math.max(0, Math.min(h.startOffset, flatText.length));
		const endOffset = Math.max(
			offset,
			Math.min(h.endOffset ?? offset + text.length, flatText.length)
		);
		if (!text) return;

		if (offset > cursorFlat) {
			const before = displayText.slice(
				displayIndicesByFlat.start[cursorFlat],
				displayIndicesByFlat.end[offset]
			);
			if (before) wholeSegments.push({ type: 'text', text: before });
		}

		const blankIndex = answers.length;
		answers.push(text);
		orderedKeywordIds.push(String((h as any).id ?? ''));
		wholeSegments.push({ type: 'blank', text, blankIndex });

		cursorFlat = endOffset;
	});

	if (cursorFlat < flatText.length) {
		const after = displayText.slice(displayIndicesByFlat.start[cursorFlat]);
		if (after) wholeSegments.push({ type: 'text', text: after });
	}

	return {
		parsedLines: splitSegmentsIntoLines(wholeSegments),
		answers,
		orderedKeywordIds,
	};
}

// (Server grading is used now; keep for future fuzzy matching if needed.)
// const normalizeText = (text: string) => text.replace(/\s+/g, '');

function getWeightedLength(text: string): number {
	if (!text) return 0;
	return Array.from(text).reduce((acc, ch) => {
		if (/[\uAC00-\uD7A3]/.test(ch)) return acc + 2;
		return acc + 1;
	}, 0);
}

const QuizPage: React.FC = () => {
	const {
		categories,
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
		reorderNotes,
		reorderCategories,
		handleCategoryDragStart,
		handleCategoryDragEnd,
		handleNoteDragStart,
		handleNoteDragEnd,
		handleDropToCategory,
		handleDropToRoot,
		handleDragOver,
		dragNoteId,
		dragCategoryId,
	} = useNoteData();
	const location = useLocation();
	const navigate = useNavigate();

	const [reviewSessionId, setReviewSessionId] = useState<number | null>(null);
	const [reviewDetail, setReviewDetail] =
		useState<QuizSessionDetailResponse | null>(null);
	const [isReviewLoading, setIsReviewLoading] = useState(false);
	const [isReviewFallback, setIsReviewFallback] = useState(false);

	const isReviewMode = reviewSessionId != null;

	// RecordPage에서 넘어오는 경우:
	// - Retry: /quiz?noteId=123
	// - more(조회): /quiz?sessionId=27  (채점 결과 복원)
	useEffect(() => {
		const params = new URLSearchParams(location.search);
		const sessionIdParam = params.get('sessionId');
		const noteId = params.get('noteId');

		if (sessionIdParam) {
			const n = Number(sessionIdParam);
			if (Number.isFinite(n) && n > 0) setReviewSessionId(n);
			else setReviewSessionId(null);
			return;
		}

		// sessionId가 없으면 일반 퀴즈 모드
		setReviewSessionId(null);
		if (noteId) handleNoteClick(noteId);
	}, [location.search, handleNoteClick]);

	// NotePage 기준 그대로
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

	const rootNotes = useMemo(() => {
		return notes
			.filter((n) => n.categoryId === null)
			.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
	}, [notes]);

	const activeNote = useMemo(() => {
		const found = notes.find((n) => n.id === activeNoteId) ?? null;
		return found as NoteItem | null;
	}, [notes, activeNoteId]);

	const quizSourceHtml = activeNote?.content ?? '';

	const { parsedLines, answers, orderedKeywordIds } = useMemo(() => {
		if (!activeNote)
			return {
				parsedLines: [] as ParsedLine[],
				answers: [] as string[],
				orderedKeywordIds: [] as string[],
			};
		return buildQuizFromContentAndHighlights(
			quizSourceHtml,
			activeNote.highlightList
		);
	}, [activeNote, quizSourceHtml]);

	const [userAnswers, setUserAnswers] = useState<string[]>([]);
	const [gradeResult, setGradeResult] = useState<boolean[] | null>(null);
	const [showNextButtons, setShowNextButtons] = useState(false);

	// ===== 서버 퀴즈 세션 =====
	const [sessionId, setSessionId] = useState<number | null>(null);
	const [questionIdByBlankIndex, setQuestionIdByBlankIndex] = useState<
		number[]
	>([]);
	const [isSessionLoading, setIsSessionLoading] = useState(false);
	const [sessionError, setSessionError] = useState<string>('');
	const [fixedBlankIndexSet, setFixedBlankIndexSet] = useState<Set<number>>(
		() => new Set()
	);

	// ===== 서버: 자주 틀린 단어 =====
	const [wrongKeywords, setWrongKeywords] = useState<WrongKeywordApiItem[]>([]);
	const [isWrongKeywordsLoading, setIsWrongKeywordsLoading] = useState(false);

	useEffect(() => {
		if (reviewSessionId) return; // 복습(조회) 모드에서는 초기화로 답을 지우지 않음
		setUserAnswers(Array(answers.length).fill(''));
		setGradeResult(null);
		setShowNextButtons(false);
		setFixedBlankIndexSet(new Set());
	}, [activeNoteId, answers.length, reviewSessionId]);

	// ===============================
	// Review 모드: sessionId로 채점결과 복원
	// ===============================
	useEffect(() => {
		const load = async () => {
			if (!reviewSessionId) {
				setReviewDetail(null);
				setIsReviewFallback(false);
				return;
			}

			try {
				setIsReviewLoading(true);
				// sessionId가 바뀌면 이전 결과가 잠깐이라도 보이지 않게 초기화
				setReviewDetail(null);
				setIsReviewFallback(false);
				setSessionError('');
				const detail = await quizApi.getSessionDetail(reviewSessionId);
				setReviewDetail(detail);

				// note 선택 → 노트 상세/키워드 로딩은 기존 흐름(useNoteDetailSync)이 담당
				handleNoteClick(String(detail.noteId));

				// 화면상 세션/채점 상태
				setSessionId(detail.sessionId);
				setShowNextButtons(false);
			} catch (e) {
				console.error('[Quiz][Review] 세션 상세 조회 실패', e);
				setSessionError(handleApiError(e));
				setReviewDetail(null);
				setSessionId(null);
			} finally {
				setIsReviewLoading(false);
			}
		};

		void load();
	}, [reviewSessionId, handleNoteClick]);

	// 노트/하이라이트 파싱 결과(answers, orderedKeywordIds)가 준비되면
	// reviewDetail.questions를 blankIndex에 매핑해 userAnswer/isCorrect를 복원
	useEffect(() => {
		if (!reviewSessionId || !reviewDetail) return;
		if (!activeNoteId) return;

		const map = new Map<string, number>();
		orderedKeywordIds.forEach((kid, idx) => {
			if (!map.has(kid)) map.set(kid, idx);
		});

		const questions = reviewDetail.questions ?? [];
		const hasNullKeywordId = questions.some((q) => q.keywordId == null);
		let mappedCount = 0;

		const nextUserAnswers = Array(answers.length).fill('');
		const nextGradeResult = Array(answers.length).fill(false);
		const nextQuestionIdByBlankIndex = Array(answers.length).fill(0);

		questions.forEach((q) => {
			const idx = map.get(String(q.keywordId ?? ''));
			if (idx == null) return;
			mappedCount++;
			nextUserAnswers[idx] = q.userAnswer ?? '';
			nextGradeResult[idx] = Boolean(q.isCorrect);
			nextQuestionIdByBlankIndex[idx] = q.id;
		});

		// ✅ 키워드 삭제/변경 등으로 keywordId가 null이 되거나, 노트 highlightList와 매핑이 깨진 경우:
		// 빈칸 재현 대신 세션 상세(questionText/answerText/userAnswer/isCorrect) 기반 리스트로 fallback
		if (
			questions.length > 0 &&
			(hasNullKeywordId ||
				answers.length === 0 ||
				mappedCount !== questions.length)
		) {
			setIsReviewFallback(true);
			return;
		}

		setIsReviewFallback(false);
		setUserAnswers(nextUserAnswers);
		setGradeResult(nextGradeResult);
		setQuestionIdByBlankIndex(nextQuestionIdByBlankIndex);
		setFixedBlankIndexSet(
			new Set(Array.from({ length: answers.length }, (_, i) => i))
		);
		setShowNextButtons(false);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		reviewSessionId,
		reviewDetail,
		answers.length,
		orderedKeywordIds.join('|'),
		activeNoteId,
	]);

	const fetchWrongKeywords = async (noteId: string) => {
		setIsWrongKeywordsLoading(true);
		try {
			const list = await keywordApi.getWrongKeywords(noteId);
			setWrongKeywords(list);
		} catch (e) {
			console.warn('[Quiz] wrong-keywords 조회 실패', e);
			setWrongKeywords([]);
		} finally {
			setIsWrongKeywordsLoading(false);
		}
	};

	const getServerNoteIdOrNull = (): number | null => {
		if (!activeNoteId) return null;
		if (activeNoteId.startsWith('temp-note-')) return null;
		if (!activeNote || activeNote.isLocalOnly) return null;
		const n = Number(activeNoteId);
		if (!Number.isFinite(n) || n <= 0) return null;
		return n;
	};

	// 노트 선택 시 서버 세션 생성 (ALL_TRY 기본)
	useEffect(() => {
		const start = async () => {
			if (reviewSessionId) return; // 복습(조회) 모드에서는 새 세션을 만들지 않음
			if (!activeNoteId) return;
			if (!activeNote) return;

			// 서버 세션은 "서버에 존재하는 노트(id 숫자)"만 가능
			const numericNoteId = getServerNoteIdOrNull();
			if (!numericNoteId) {
				setSessionId(null);
				setQuestionIdByBlankIndex([]);
				setWrongKeywords([]);
				setSessionError(
					'이 노트는 아직 서버에 저장되지 않아 퀴즈를 시작할 수 없습니다. (일반 노트 생성 직후에는 잠시 대기 필요)\n' +
						'노트 페이지에서 저장 후 다시 시도하거나, 잠시 후 다시 선택해 주세요.'
				);
				return;
			}

			if (!activeNote.highlightList || activeNote.highlightList.length === 0) {
				setSessionId(null);
				setQuestionIdByBlankIndex([]);
				setWrongKeywords([]);
				setSessionError(
					'이 노트에는 DB에 저장된 키워드가 없어 퀴즈를 생성할 수 없습니다.\n' +
						'노트 페이지에서 키워드를 저장(Save)한 뒤 다시 시도해주세요.'
				);
				return;
			}

			// ⚠️ 서버는 contentHtml에서 태그만 제거한 문자열로 substring을 하므로,
			// DB에 저장된 start/endOffset이 그 길이를 벗어나면 서버에서 500이 날 수 있다.
			const serverPlain = String(activeNote.content ?? '').replace(
				/<[^>]*>/g,
				''
			);
			const plainLen = serverPlain.length;
			const invalid = (activeNote.highlightList ?? []).find(
				(h) =>
					h.startOffset < 0 ||
					h.endOffset <= h.startOffset ||
					h.endOffset > plainLen
			);
			if (invalid) {
				setSessionId(null);
				setQuestionIdByBlankIndex([]);
				setWrongKeywords([]);
				setSessionError(
					`이 노트는 키워드 위치(offset)가 서버 기준 본문 길이와 맞지 않아 퀴즈를 생성할 수 없습니다.\n` +
						`(keyword endOffset=${invalid.endOffset}, plainLen=${plainLen})\n` +
						'노트 페이지에서 본문/키워드를 다시 저장하거나 키워드를 다시 생성해 주세요.'
				);
				return;
			}

			// 자주 틀린 단어 카드 로드 (세션 생성과 별개)
			fetchWrongKeywords(String(numericNoteId));

			setIsSessionLoading(true);
			setSessionError('');
			try {
				const created = await quizApi.createSession({
					noteId: numericNoteId,
					mode: 'ALL_TRY',
				});

				// keywordId -> questionId
				const map = new Map<string, number>();
				created.questions.forEach((q) =>
					map.set(String(q.keywordId), q.questionId)
				);

				const qids = orderedKeywordIds.map((kid) => map.get(kid) ?? -1);
				if (qids.some((v) => v <= 0)) {
					// 방어: 매핑 실패 시 session 정보만 유지하고, 채점은 막는다
					console.warn('[Quiz] questionId 매핑 실패', {
						orderedKeywordIds,
						created,
					});
				}

				setSessionId(created.sessionId);
				setQuestionIdByBlankIndex(qids);
			} catch (e) {
				setSessionId(null);
				setQuestionIdByBlankIndex([]);
				setSessionError(handleApiError(e));
			} finally {
				setIsSessionLoading(false);
			}
		};

		start();
	}, [activeNoteId, orderedKeywordIds.join('|'), reviewSessionId]);

	const handleChangeAnswer = (blankIndex: number, value: string) => {
		if (fixedBlankIndexSet.has(blankIndex)) return;
		setUserAnswers((prev) => {
			const next = [...prev];
			next[blankIndex] = value;
			return next;
		});
	};

	const handleGrade = async () => {
		if (!sessionId) {
			setSessionError(
				'퀴즈 세션이 아직 생성되지 않았습니다. 노트를 다시 선택하거나 잠시 후 다시 시도해 주세요.'
			);
			return;
		}
		if (questionIdByBlankIndex.length !== answers.length) {
			alert('문제 정보가 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.');
			return;
		}
		if (questionIdByBlankIndex.some((v) => v <= 0)) {
			alert('문제 정보 매핑에 실패했습니다. 노트를 다시 선택해 주세요.');
			return;
		}

		try {
			await quizApi.gradeSession(sessionId, {
				answers: questionIdByBlankIndex.map((qid, idx) => ({
					questionId: qid,
					userAnswer: (userAnswers[idx] ?? '').trim(),
				})),
			});

			// 채점 결과는 detail에서 question별 isCorrect로 가져온다
			const detail = await quizApi.getSessionDetail(sessionId);
			const byId = new Map<number, boolean>();
			detail.questions.forEach((q) => byId.set(q.id, Boolean(q.isCorrect)));

			const result = questionIdByBlankIndex.map(
				(qid) => byId.get(qid) ?? false
			);
			setGradeResult(result);
			setShowNextButtons(true);

			// 서버 기준: 자주 틀린 단어 카드 즉시 갱신
			const numericNoteId = getServerNoteIdOrNull();
			if (numericNoteId) {
				fetchWrongKeywords(String(numericNoteId));
			}
		} catch (e) {
			alert(handleApiError(e));
		}
	};

	const createRetrySession = async (mode: 'ALL_TRY' | 'PART_TRY') => {
		const numericNoteId = getServerNoteIdOrNull();
		if (!numericNoteId) return false;
		setIsSessionLoading(true);
		setSessionError('');
		try {
			const created = await quizApi.createSession({
				noteId: numericNoteId,
				mode,
			});
			const map = new Map<string, number>();
			created.questions.forEach((q) =>
				map.set(String(q.keywordId), q.questionId)
			);
			const qids = orderedKeywordIds.map((kid) => map.get(kid) ?? -1);
			setSessionId(created.sessionId);
			setQuestionIdByBlankIndex(qids);
			return true;
		} catch (e) {
			setSessionId(null);
			setQuestionIdByBlankIndex([]);
			setSessionError(handleApiError(e));
			return false;
		} finally {
			setIsSessionLoading(false);
		}
	};

	const canGrade =
		!!activeNote &&
		answers.length > 0 &&
		!isSessionLoading &&
		!sessionError &&
		!!sessionId &&
		questionIdByBlankIndex.length === answers.length &&
		!questionIdByBlankIndex.some((v) => v <= 0);
	const canGradeInThisMode = canGrade && !isReviewMode;

	const handleAllTry = async () => {
		await createRetrySession('ALL_TRY');
		setFixedBlankIndexSet(new Set());
		setUserAnswers(Array(answers.length).fill(''));
		setGradeResult(null);
		setShowNextButtons(false);
	};

	const handlePartTry = async () => {
		if (!gradeResult) return;
		await createRetrySession('PART_TRY');

		const fixed = new Set<number>();
		const nextAnswers = Array(answers.length).fill('');
		for (let i = 0; i < answers.length; i++) {
			if (gradeResult[i]) {
				fixed.add(i);
				nextAnswers[i] = answers[i];
			}
		}
		setFixedBlankIndexSet(fixed);
		setUserAnswers(nextAnswers);
		setGradeResult(null);
		setShowNextButtons(false);
	};

	const frequentWords = useMemo(() => {
		// 서버 기준: isActive=true만 표시
		return wrongKeywords
			.filter((w) => w.isActive)
			.sort((a, b) => b.wrongCount - a.wrongCount);
	}, [wrongKeywords]);

	return (
		<div className="quiz-page-root">
			{sessionError && (
				<div style={{ color: '#d9534f', fontSize: 12, margin: '8px 0' }}>
					{sessionError}
				</div>
			)}
			<PageLayout
				title="Quiz"
				subtitle="암기한 내용을 확인해보세요!"
				headerActions={
					<div className="quiz-header-actions">
						{isReviewMode ? (
							<>
								{isReviewLoading && (
									<span style={{ fontSize: 12, color: '#666' }}>
										세션 불러오는 중...
									</span>
								)}
								<button
									className="quiz-header-button--primary"
									onClick={() => navigate(-1)}
								>
									Back
								</button>
							</>
						) : (
							<>
								{showNextButtons && (
									<>
										<button className="quiz-next-button" onClick={handleAllTry}>
											All try
										</button>
										<button
											className="quiz-next-button"
											onClick={handlePartTry}
										>
											Part try
										</button>
									</>
								)}
								{isSessionLoading && (
									<span style={{ fontSize: 12, color: '#666' }}>
										세션 생성 중...
									</span>
								)}

								<button
									className="quiz-header-button--primary"
									onClick={handleGrade}
									disabled={!canGradeInThisMode}
								>
									grade
								</button>
							</>
						)}
					</div>
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
						showAddNoteButton={false}
						showAddCategoryButton={false}
						showQuizHighlightCard={false}
						reorderNotes={reorderNotes}
						reorderCategories={reorderCategories}
						handleCategoryDragStart={handleCategoryDragStart}
						handleCategoryDragEnd={handleCategoryDragEnd}
						handleNoteDragStart={handleNoteDragStart}
						handleNoteDragEnd={handleNoteDragEnd}
						handleDropToCategory={handleDropToCategory}
						handleDropToRoot={handleDropToRoot}
						handleDragOver={handleDragOver}
						bottomExtra={
							<div className="wrong-words-card">
								<h3 className="wrong-words-title">자주 틀리는 단어</h3>
								{isWrongKeywordsLoading ? (
									<p className="wrong-words-empty">불러오는 중...</p>
								) : frequentWords.length === 0 ? (
									<p className="wrong-words-empty">
										아직 자주 틀리는 단어가 없어요.
									</p>
								) : (
									<ul className="wrong-words-list">
										{frequentWords.map((item) => {
											const word = item.text;
											const count = item.wrongCount;

											let colorClass = 'wrong-score-gray';
											if (count >= 5) colorClass = 'wrong-score-red';
											else if (count >= 3) colorClass = 'wrong-score-yellow';

											return (
												<li key={item.id} className="wrong-words-item">
													<span className={`wrong-score ${colorClass}`}>
														{count}
													</span>
													<span className="wrong-words-text">{word}</span>
												</li>
											);
										})}
									</ul>
								)}
							</div>
						}
						dragNoteId={dragNoteId}
						dragCategoryId={dragCategoryId}
					/>
				}
				mainContent={
					<div className="note-editor">
						<div className="note-editor-body">
							{activeNote ? (
								isReviewMode && isReviewFallback && reviewDetail ? (
									<div className="quiz-review-fallback">
										<div className="quiz-review-fallback-hint">
											키워드가 삭제되었거나 노트의 키워드가 변경되어, 빈칸
											형태로 재현할 수 없습니다. 아래에서 당시 채점 결과를
											확인하세요.
										</div>

										<div className="quiz-review-fallback-list">
											{reviewDetail.questions.map((q, i) => {
												const graded = q.isCorrect != null;
												const correct = q.isCorrect === true;
												const badge = graded ? (correct ? 'O' : 'X') : '-';
												const badgeClass = graded
													? correct
														? 'quiz-review-badge--ok'
														: 'quiz-review-badge--no'
													: 'quiz-review-badge--na';

												return (
													<div key={q.id} className="quiz-review-fallback-item">
														<div className="quiz-review-fallback-item-top">
															<span
																className={`quiz-review-badge ${badgeClass}`}
															>
																{badge}
															</span>
															<span className="quiz-review-fallback-item-title">
																Q{i + 1}
															</span>
														</div>

														<div className="quiz-review-fallback-question">
															{q.questionText}
														</div>

														<div className="quiz-review-fallback-answers">
															<div>
																<strong>Your:</strong>{' '}
																{q.userAnswer?.trim()
																	? q.userAnswer
																	: '(empty)'}
															</div>
															<div>
																<strong>Answer:</strong> {q.answerText}
															</div>
														</div>
													</div>
												);
											})}
										</div>
									</div>
								) : parsedLines.length > 0 ? (
									<div className="quiz-lines-scroll">
										<div className="quiz-lines">
											{parsedLines.map((segments, lineIdx) => {
												const wrongAnswersForLine: string[] = [];

												if (gradeResult) {
													segments.forEach((seg) => {
														if (
															seg.type === 'blank' &&
															!gradeResult[seg.blankIndex]
														) {
															wrongAnswersForLine.push(seg.text);
														}
													});
												}

												return (
													<div key={lineIdx} className="quiz-line">
														{segments.map((seg, segIdx) => {
															if (seg.type === 'text') {
																return (
																	<span key={segIdx}>
																		{seg.text || '\u00A0'}
																	</span>
																);
															}

															const value = userAnswers[seg.blankIndex] ?? '';
															const isGraded = !!gradeResult;
															const isCorrect =
																gradeResult?.[seg.blankIndex] ?? false;

															const statusClass = isGraded
																? isCorrect
																	? 'blank-input--correct'
																	: 'blank-input--wrong'
																: '';

															const answerLength = seg.text?.length ?? 0;
															const hasKorean = /[\uAC00-\uD7A3]/.test(value);

															const inputLength = hasKorean
																? getWeightedLength(value)
																: value.length;

															const displayLength = Math.max(
																answerLength,
																inputLength,
																2
															);
															const padding = hasKorean ? 6 : 2;
															const widthCh = displayLength + padding;

															return (
																<input
																	key={segIdx}
																	className={`blank-input ${statusClass}`}
																	value={value}
																	disabled={fixedBlankIndexSet.has(
																		seg.blankIndex
																	)}
																	onChange={(e) =>
																		handleChangeAnswer(
																			seg.blankIndex,
																			e.target.value
																		)
																	}
																	style={{ width: `${widthCh}ch` }}
																/>
															);
														})}

														{gradeResult && wrongAnswersForLine.length > 0 && (
															<span className="correct-answer-text">
																{wrongAnswersForLine.join(', ')}
															</span>
														)}
													</div>
												);
											})}
										</div>
									</div>
								) : (
									<p className="quiz-empty-message">
										노트 내용에 하이라이트가 없어요.
									</p>
								)
							) : (
								<p>왼쪽에서 노트를 선택해 주세요.</p>
							)}
						</div>
					</div>
				}
			/>
		</div>
	);
};

export default QuizPage;
