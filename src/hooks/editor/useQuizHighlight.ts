import { useEffect, useState } from 'react';
import type { RefObject } from 'react';
import type { NoteItem, QuizHighlight } from '../../types/noteTypes';

/* =============================================================
   Flat Text 생성 — DOM 구조와 무관한 순수 TextNode 연결본
============================================================= */
function getFlatText(editor: HTMLElement): string {
	let result = '';
	const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);

	let node = walker.nextNode() as Text | null;
	while (node) {
		result += node.nodeValue ?? '';
		node = walker.nextNode() as Text | null;
	}

	return result;
}

/* =============================================================
   문자열 유사도 계산 (단순 매칭 비율)
============================================================= */
function similarity(a: string, b: string) {
	const len = Math.min(a.length, b.length);
	let same = 0;
	for (let i = 0; i < len; i++) {
		if (a[i] === b[i]) same++;
	}
	return same / Math.max(len, 1);
}

/* =============================================================
   문맥 추출
============================================================= */
function extractContext(full: string, start: number, end: number, ctx = 30) {
	return {
		before: full.slice(Math.max(0, start - ctx), start),
		after: full.slice(end, end + ctx),
	};
}

/* =============================================================
   flat offset → Range 변환 (block 요소와도 호환)
============================================================= */
function getRangeFromFlatOffsets(
	editor: HTMLElement,
	start: number,
	end: number
): Range | null {
	const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);

	let consumed = 0;
	let node = walker.nextNode() as Text | null;

	let startNode: Text | null = null;
	let startOffset = 0;
	let endNode: Text | null = null;
	let endOffset = 0;

	while (node) {
		const textLen = node.nodeValue?.length ?? 0;

		if (!startNode && consumed + textLen >= start) {
			startNode = node;
			startOffset = start - consumed;
		}

		if (!endNode && consumed + textLen >= end) {
			endNode = node;
			endOffset = end - consumed;
			break;
		}

		consumed += textLen;
		node = walker.nextNode() as Text | null;
	}

	if (!startNode || !endNode) return null;

	const range = document.createRange();
	range.setStart(startNode, startOffset);
	range.setEnd(endNode, endOffset);

	return range;
}

/* =============================================================
   문맥 기반 위치 매칭 (flatText 사용)
============================================================= */
function findIndexByContext(
	full: string,
	text: string,
	before: string,
	after: string
) {
	const candidates: number[] = [];
	let idx = full.indexOf(text);

	while (idx !== -1) {
		candidates.push(idx);
		idx = full.indexOf(text, idx + 1);
	}

	if (candidates.length === 0) return -1;

	let bestIndex = -1;
	let bestScore = -Infinity;

	for (const start of candidates) {
		const end = start + text.length;

		const actualBefore = full.slice(Math.max(0, start - before.length), start);
		const actualAfter = full.slice(end, end + after.length);

		const score =
			similarity(actualBefore, before) + similarity(actualAfter, after);

		if (score > bestScore) {
			bestScore = score;
			bestIndex = start;
		}
	}

	return bestIndex;
}

/* =============================================================
  offset 기반 “근방 탐색” 함수
============================================================= */

function findIndexNearOffset(full: string, h: QuizHighlight, radius = 20) {
	const { text, startOffset, contextBefore, contextAfter } = h;

	const from = Math.max(0, startOffset - radius);
	const to = Math.min(full.length, startOffset + radius);

	let bestIndex = -1;
	let bestScore = -Infinity;

	let idx = full.indexOf(text, from);
	while (idx !== -1 && idx <= to) {
		const end = idx + text.length;

		const before = full.slice(Math.max(0, idx - contextBefore.length), idx);
		const after = full.slice(end, end + contextAfter.length);

		const score =
			similarity(before, contextBefore) + similarity(after, contextAfter);

		if (score > bestScore) {
			bestScore = score;
			bestIndex = idx;
		}

		idx = full.indexOf(text, idx + 1);
	}

	return bestIndex;
}

/* =============================================================
   메인 훅 — Semantic Anchoring QuizHighlight
============================================================= */
export function useQuizHighlight(
	editorRef: RefObject<HTMLDivElement | null>,
	activeNote: NoteItem | undefined,
	onContentChange: (html: string) => void,
	onQuizSave?: (noteId: string, highlights: QuizHighlight[]) => void
) {
	const [savedHighlights, setSavedHighlights] = useState<QuizHighlight[]>([]);
	const [isQuizMode, setIsQuizMode] = useState(false);
	const [quizButtonLabel, setQuizButtonLabel] = useState('Quiz');

	/* activeNote 변경 시 하이라이트 로드 */
	useEffect(() => {
		setSavedHighlights(activeNote?.highlightList ?? []);
	}, [activeNote?.id, activeNote?.highlightList]);

	/* =============================================================
     선택 영역 → highlight 생성
============================================================= */
	const createHighlightFromSelection = () => {
		const editor = editorRef.current;
		if (!editor) return;

		const sel = window.getSelection();
		if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;

		const range = sel.getRangeAt(0);
		if (!editor.contains(range.commonAncestorContainer)) return;

		// 겹침 방지
		const editorEl = editorRef.current;
		if (editorEl) {
			const existingHighlights = editorEl.querySelectorAll('.quiz-highlight');
			for (const span of existingHighlights) {
				if (range.intersectsNode(span)) {
					alert('이미 하이라이트가 지정된 영역과 겹칠 수 없습니다.');
					sel.removeAllRanges();
					return;
				}
			}
		}

		const text = sel.toString();

		if (!text.trim()) {
			sel.removeAllRanges();
			return;
		}

		if (text.includes('\n')) {
			alert('줄바꿈을 포함한 영역은 하이라이트할 수 없습니다.');
			sel.removeAllRanges(); // 🔥 선택 즉시 해제
			return;
		}

		// ✔ FlatText 기반 offset 계산
		const flat = getFlatText(editor);

		let selectionStart = 0;
		{
			const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
			let node = walker.nextNode() as Text | null;
			let consumed = 0;

			while (node) {
				if (node === range.startContainer) {
					selectionStart = consumed + range.startOffset;
					break;
				}
				consumed += node.nodeValue?.length ?? 0;
				node = walker.nextNode() as Text | null;
			}
		}

		const selectionEnd = selectionStart + text.length;

		const { before, after } = extractContext(
			flat,
			selectionStart,
			selectionEnd
		);

		const newHL: QuizHighlight = {
			id: crypto.randomUUID(),
			text,
			startOffset: selectionStart,
			endOffset: selectionEnd,
			contextBefore: before,
			contextAfter: after,
		};

		setSavedHighlights((prev) => [...prev, newHL]);

		// DOM 하이라이트 즉시 표시
		const span = document.createElement('span');
		span.className = 'quiz-highlight';

		try {
			range.surroundContents(span);
		} catch {
			const frag = range.extractContents();
			span.appendChild(frag);
			range.insertNode(span);
		}

		sel.removeAllRanges();
	};

	/* =============================================================
     기존 highlight 복원
============================================================= */
	const applyHighlight = (editor: HTMLElement, h: QuizHighlight) => {
		const full = getFlatText(editor);

		// 1️⃣ offset 근방 탐색
		let index = findIndexNearOffset(full, h);

		// 2️⃣ 실패 시 기존 context 방식 fallback
		if (index === -1) {
			index = findIndexByContext(full, h.text, h.contextBefore, h.contextAfter);
		}

		if (index === -1) return;

		const range = getRangeFromFlatOffsets(editor, index, index + h.text.length);
		if (!range) return;

		const span = document.createElement('span');
		span.className = 'quiz-highlight';

		const content = range.extractContents();
		span.appendChild(content);
		range.insertNode(span);
	};

	/* =============================================================
     Quiz 모드 토글
============================================================= */
	const handleQuizToggle = () => {
		const editor = editorRef.current;
		if (!editor) return;

		// ⚠️ 중요: setState(updater) 내부에서 onQuizSave 같은 side-effect를 실행하면
		// React dev/StrictMode에서 updater가 여러 번 호출될 수 있어 중복 저장이 발생할 수 있음.
		// 따라서 토글 분기 + side-effect는 setState 밖에서 처리한다.

		const next = !isQuizMode;

		if (next) {
			document.body.classList.add('quiz-mode-active');
			setQuizButtonLabel('Save');

			// 모든 span 제거 (원본 텍스트만 남기기)
			editor.querySelectorAll('.quiz-highlight').forEach((span) => {
				const parent = span.parentNode;
				while (span.firstChild) parent?.insertBefore(span.firstChild, span);
				span.remove();
			});

			// 문맥 기반 복원
			requestAnimationFrame(() => {
				const ed = editorRef.current;
				if (!ed) return;
				savedHighlights.forEach((h) => applyHighlight(ed, h));
			});

			setIsQuizMode(true);
			return;
		}

		// exiting (Save)
		document.body.classList.remove('quiz-mode-active');
		setQuizButtonLabel('Quiz');

		const editorEl = editorRef.current;
		if (!editorEl) {
			setIsQuizMode(false);
			return;
		}

		const flat = getFlatText(editorEl);

		// ✅ 유효한 하이라이트만 남김
		const validHighlights = savedHighlights.filter((h) => {
			// 1️⃣ offset 근방에서 찾기
			const index = findIndexNearOffset(flat, h);

			// 2️⃣ 근방에서도 못 찾으면 → 삭제된 것으로 간주
			return index !== -1;
		});

		setSavedHighlights(validHighlights);

		// ✅ 저장 (상위 state + 서버 동기화는 onQuizSave에서 처리)
		if (activeNote) {
			onQuizSave?.(activeNote.id, validHighlights);
		}
		onContentChange(editorEl.innerHTML);

		// span 제거 후 원본 복원
		editorEl.querySelectorAll('.quiz-highlight').forEach((span) => {
			const parent = span.parentNode;
			while (span.firstChild) parent?.insertBefore(span.firstChild, span);
			span.remove();
		});

		setIsQuizMode(false);
	};

	/* =============================================================
     mouseup → highlight 생성 (Quiz 모드에서만)
============================================================= */
	useEffect(() => {
		if (!isQuizMode) return;

		const editor = editorRef.current;
		if (!editor) return;

		const handler = () => createHighlightFromSelection();
		editor.addEventListener('mouseup', handler);

		return () => editor.removeEventListener('mouseup', handler);
	}, [isQuizMode]);

	return {
		isQuizMode,
		savedHighlights,
		setSavedHighlights,
		handleQuizToggle,
		quizButtonLabel,
	};
}
