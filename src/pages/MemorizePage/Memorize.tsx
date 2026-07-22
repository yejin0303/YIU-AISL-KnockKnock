// src/pages/MemorizePage/Memorize.tsx
import React, {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import './Memorize.css';

import { useNoteData } from '../../hooks/useNoteData';
import { NoteSidebar } from '../../components/Note/NoteSidebar/NoteSidebar';
import PageLayout from '../../components/Layout/PageLayout';
import TempSaveModal from '../../components/TempSaveModal/TempSaveModal';
import { handleApiError } from '../../services/api/authApi';
import {
	memorizeApi,
	type MemorizationSessionResponse,
} from '../../services/api/memorizeApi';

type DiffChunk = { text: string; isError: boolean };

function stripTags(html: string): string {
	if (!html) return '';
	let text = html
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<div[^>]*>/gi, '\n')
		.replace(/<(p|li|h[1-6])[^>]*>/gi, '\n')
		.replace(/<\/(p|li|h[1-6])>/gi, '\n')
		.replace(/<\/div>/gi, '\n')
		.replace(/<[^>]+>/g, '');
	text = text.replace(/&nbsp;/gi, ' ');
	return text;
}

function getMemorizeLinesFromContent(html?: string | null): string[] {
	const text = stripTags(html || '');
	return text
		.split('\n')
		.map((l) => l.trim())
		.filter((l) => l.length > 0);
}

function diffStrings(reference: string, user: string): DiffChunk[] {
	if (!user) return [{ text: reference, isError: false }];

	const chunks: DiffChunk[] = [];
	let currentText = '';
	let currentIsError = false;

	for (let i = 0; i < reference.length; i++) {
		const refChar = reference[i];
		const userChar = i < user.length ? user[i] : '';
		const isError = i < user.length && refChar !== userChar;

		if (i === 0) {
			currentText = refChar;
			currentIsError = isError;
			continue;
		}

		if (isError !== currentIsError) {
			chunks.push({ text: currentText, isError: currentIsError });
			currentText = refChar;
			currentIsError = isError;
		} else {
			currentText += refChar;
		}
	}
	chunks.push({ text: currentText, isError: currentIsError });
	return chunks;
}

type MemorizeLineItemProps = {
	referenceText: string;
	noteId: string | null;
	lineIndex: number;
	clearVersion: number;
	initialValue?: string;
	onInputChange: (lineIndex: number, value: string) => void;
};

const MemorizeLineItem: React.FC<MemorizeLineItemProps> = ({
	referenceText,
	noteId,
	lineIndex,
	clearVersion,
	initialValue,
	onInputChange,
}) => {
	const storageKey = `memo-${noteId ?? 'none'}-line-${lineIndex}`;

	const [inputValue, setInputValue] = useState(initialValue ?? '');
	const [userText, setUserText] = useState(initialValue ?? '');
	const [isHidden, setIsHidden] = useState(false);
	const [isComposing, setIsComposing] = useState(false);
	const textAreaRef = useRef<HTMLTextAreaElement | null>(null);

	useEffect(() => {
		// restore order: server initialValue -> localStorage -> empty
		if (initialValue !== undefined) {
			setInputValue(initialValue);
			setUserText(initialValue);
			if (initialValue) localStorage.setItem(storageKey, initialValue);
			return;
		}
		const saved = localStorage.getItem(storageKey);
		if (saved) {
			setInputValue(saved);
			setUserText(saved);
		} else {
			setInputValue('');
			setUserText('');
		}
	}, [storageKey, clearVersion, initialValue]);

	useEffect(() => {
		if (!textAreaRef.current) return;
		const el = textAreaRef.current;
		el.style.height = 'auto';
		el.style.height = `${el.scrollHeight}px`;
	}, [inputValue]);

	const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		const value = e.target.value;
		const native = e.nativeEvent as any;

		setInputValue(value);
		localStorage.setItem(storageKey, value);
		onInputChange(lineIndex, value);

		if (!native.isComposing && !isComposing) setUserText(value);
	};

	const handleCompositionStart = () => setIsComposing(true);
	const handleCompositionEnd = (
		e: React.CompositionEvent<HTMLTextAreaElement>
	) => {
		setIsComposing(false);
		setUserText(e.currentTarget.value);
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === 'Enter') {
			e.preventDefault();
			const nextTextArea =
				textAreaRef.current?.parentElement?.parentElement?.nextElementSibling?.querySelector(
					'textarea'
				);
			if (nextTextArea) (nextTextArea as HTMLTextAreaElement).focus();
		}
	};

	const diffChunks = diffStrings(referenceText, userText);

	return (
		<div className="mem-line">
			<div
				className={
					'mem-line-reference' + (isHidden ? ' mem-line-reference--hidden' : '')
				}
			>
				<span className="mem-line-reference-text">
					{isHidden ? (
						<span className="mem-line-mask" />
					) : (
						diffChunks.map((chunk, i) => (
							<span
								key={i}
								className={chunk.isError ? 'mem-text-error' : undefined}
							>
								{chunk.text}
							</span>
						))
					)}
				</span>

				<button
					type="button"
					className={
						'mem-line-toggle-btn' +
						(isHidden ? ' mem-line-toggle-btn--active' : '')
					}
					onClick={() => setIsHidden((p) => !p)}
				>
					<img
						src="/assets/check-icon.png"
						alt="check"
						className="mem-line-check-icon"
					/>
				</button>
			</div>

			<div className="mem-line-input">
				<textarea
					ref={textAreaRef}
					className="mem-line-input-field"
					value={inputValue}
					onChange={handleChange}
					onCompositionStart={handleCompositionStart}
					onCompositionEnd={handleCompositionEnd}
					onKeyDown={handleKeyDown}
					rows={1}
				/>
				<div className="mem-line-input-placeholder" />
			</div>
		</div>
	);
};

function hasSavedTypingForNote(noteId: string | null): boolean {
	if (!noteId) return false;
	const prefix = `memo-${noteId}-`;
	for (let i = 0; i < localStorage.length; i++) {
		const key = localStorage.key(i);
		if (key && key.startsWith(prefix)) {
			const val = localStorage.getItem(key);
			if (val && val.trim() !== '') return true;
		}
	}
	return false;
}

const LINES_PER_PAGE = 10;
const LAST_MEMORIZE_NOTE_ID_KEY = 'memorize-last-typed-note-id';

const MemorizePage: React.FC = () => {
	const {
		categories,
		notes,
		activeNoteId,
		activeCategoryId,
		isLoaded,
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
		dragNoteId,
		dragCategoryId,
	} = useNoteData();

	// pagination
	const [pageStartIndex, setPageStartIndex] = useState(0);
	const [linesPerPage, setLinesPerPage] = useState(LINES_PER_PAGE);
	const pendingProgressLineRef = useRef<number | null>(null);
	const [pageHistory, setPageHistory] = useState<number[]>([0]);
	const [pageHistoryCursor, setPageHistoryCursor] = useState(0);
	const navTriggeredRef = useRef(false);

	// dynamic pagination measurement refs (right content area only)
	const editorBodyRef = useRef<HTMLDivElement | null>(null);
	const memLinesRef = useRef<HTMLDivElement | null>(null);
	const [layoutTick, setLayoutTick] = useState(0);
	const dynamicFitRef = useRef<{
		key: string;
		low: number; // fits
		high: number; // overflows (exclusive upper bound; can be cap+1 sentinel)
		cap: number;
		locked: boolean;
	}>({
		key: '',
		low: 1,
		high: LINES_PER_PAGE + 1,
		cap: LINES_PER_PAGE,
		locked: false,
	});
	const MAX_DYNAMIC_LINES = 60;

	// ✅ MemorizePage 전용: 마지막으로 "타이핑한" 노트를 복원 (재접속/새로고침/재진입 시)
	const didRestoreLastTypedNoteRef = useRef(false);

	// resume modal
	const [isTempModalOpen, setIsTempModalOpen] = useState(false);
	const [clearVersion, setClearVersion] = useState(0);

	// session
	const [sessionId, setSessionId] = useState<string | null>(null);
	const [isLoadingSession, setIsLoadingSession] = useState(false);

	// line inputs
	const [lineInitialValues, setLineInitialValues] = useState<
		Map<number, string>
	>(new Map());
	// ✅ 같은 노트에서 OK/Cancel 이후에는 모달을 다시 띄우지 않기 위한 가드
	const resumePromptResolvedForNoteRef = useRef<string | null>(null);
	// ✅ notes 업데이트 등으로 rerender가 발생해도 세션 로드는 "노트가 바뀔 때만" 실행
	const lastSessionLoadedNoteIdRef = useRef<string | null>(null);
	const allLineInputsRef = useRef<Map<number, string>>(new Map());
	const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const activeCategory = activeCategoryId
		? categories.find((c) => c.id === activeCategoryId) ?? null
		: null;

	const childCategories = activeCategory
		? categories.filter((c) => c.parentId === activeCategory.id)
		: categories.filter((c) => c.parentId === null);

	const childNotes = activeCategory
		? notes.filter((n) => n.categoryId === activeCategory.id)
		: [];

	// ✅ uncategorized notes for root view
	const rootNotes = notes.filter((n) => n.categoryId === null);

	const activeNote = useMemo(
		() => notes.find((n) => n.id === activeNoteId) ?? null,
		[notes, activeNoteId]
	);
	const memorizeLines = useMemo(
		() => (activeNote ? getMemorizeLinesFromContent(activeNote.content) : []),
		[activeNote]
	);

	useEffect(() => {
		// 최초 진입 시 1회만: 마지막으로 "타이핑한" 노트가 있으면 그걸 우선 선택
		if (didRestoreLastTypedNoteRef.current) return;
		if (!isLoaded) return;
		if (!notes || notes.length === 0) return;

		let savedId: string | null = null;
		try {
			savedId = localStorage.getItem(LAST_MEMORIZE_NOTE_ID_KEY);
		} catch {
			savedId = null;
		}

		if (
			savedId &&
			notes.some((n) => n.id === savedId) &&
			savedId !== activeNoteId
		) {
			handleNoteClick(savedId);
		}

		didRestoreLastTypedNoteRef.current = true;
	}, [isLoaded, notes, activeNoteId, handleNoteClick]);

	useEffect(() => {
		// note가 선택되지 않았으면 초기화
		if (!activeNoteId) {
			setSessionId(null);
			setLineInitialValues(new Map());
			setPageStartIndex(0);
			setPageHistory([0]);
			setPageHistoryCursor(0);
			setIsTempModalOpen(false);
			allLineInputsRef.current = new Map();
			lastSessionLoadedNoteIdRef.current = null;
			resumePromptResolvedForNoteRef.current = null;
			pendingProgressLineRef.current = null;
			return;
		}

		// ✅ 노트가 바뀌면(진입/이동) 이 노트에서는 다시 모달을 띄울 수 있도록 reset
		if (lastSessionLoadedNoteIdRef.current !== activeNoteId) {
			resumePromptResolvedForNoteRef.current = null;
		}

		// ✅ 같은 note에서 이미 세션을 로드했다면 재로딩하지 않음
		// (useNoteData의 주기적 sync 등으로 rerender가 발생해도 이어하기 모달이 반복되지 않게)
		if (lastSessionLoadedNoteIdRef.current === activeNoteId) return;

		setPageStartIndex(0);
		setPageHistory([0]);
		setPageHistoryCursor(0);
		setIsLoadingSession(true);
		lastSessionLoadedNoteIdRef.current = activeNoteId;

		const run = async () => {
			try {
				const storedSessionId = localStorage.getItem(
					`memorize-session-${activeNoteId}`
				);
				const hadStoredSessionId = Boolean(storedSessionId);

				let session: MemorizationSessionResponse;
				let resolvedId: string | null = null;

				if (storedSessionId) {
					try {
						session = await memorizeApi.getSession(storedSessionId);
						resolvedId = storedSessionId;
					} catch (e) {
						session = await memorizeApi.createSession(activeNoteId);
						resolvedId = String(session.id);
					}
				} else {
					session = await memorizeApi.createSession(activeNoteId);
					resolvedId = String(session.id);
				}

				setSessionId(resolvedId);
				if (resolvedId) {
					localStorage.setItem(`memorize-session-${activeNoteId}`, resolvedId);
				}

				const initialMap = new Map<number, string>();
				const inputsMap = new Map<number, string>();

				if (session?.lastTypedText) {
					const lines = String(session.lastTypedText).split('\n');
					lines.forEach((line: string, idx: number) => {
						if (line.trim() !== '') {
							initialMap.set(idx, line);
							inputsMap.set(idx, line);
							localStorage.setItem(`memo-${activeNoteId}-line-${idx}`, line);
						}
					});
				}

				setLineInitialValues(initialMap);
				allLineInputsRef.current = inputsMap;

				// progressLine은 "라인 인덱스"이므로, 동적 linesPerPage가 결정된 뒤 pageStartIndex로 환산한다.
				if (
					typeof session?.progressLine === 'number' &&
					session.progressLine > 0
				) {
					pendingProgressLineRef.current = session.progressLine;
				} else {
					pendingProgressLineRef.current = null;
				}

				const hasProgressFromSession =
					session?.lastTypedText && String(session.lastTypedText).trim() !== '';
				const hasProgressFromLocal = hasSavedTypingForNote(activeNoteId);
				const hasProgress = Boolean(
					hasProgressFromSession || hasProgressFromLocal
				);

				// ✅ 이어하기 모달:
				// - 메인→암기 진입 / 새로고침 / 다른 노트 재선택 시, "이전에 저장된 진행 내용"이 있으면 표시
				// - 진행 내용 판별은 서버/로컬 둘 다 고려 (서버 저장 타이밍 이슈 대비)
				// - 노트당 1회만 표시 (OK/Cancel 이후에는 동일 노트에서 다시 안 띄움)
				const shouldShowResumeModal =
					hadStoredSessionId &&
					hasProgress &&
					resumePromptResolvedForNoteRef.current !== activeNoteId;

				setIsTempModalOpen(shouldShowResumeModal);
			} catch (e) {
				console.error('[Memorize] 세션 로드 실패', e);
				setSessionId(null);
				setLineInitialValues(new Map());
				allLineInputsRef.current = new Map();

				// ✅ API 실패 시(localStorage fallback)도 "이전에 세션이 있었다면"만 모달을 띄운다
				const hadStoredSessionId = Boolean(
					localStorage.getItem(`memorize-session-${activeNoteId}`)
				);
				const hasProgress = hasSavedTypingForNote(activeNoteId);
				if (
					hadStoredSessionId &&
					hasProgress &&
					resumePromptResolvedForNoteRef.current !== activeNoteId
				) {
					setIsTempModalOpen(true);
				} else {
					setIsTempModalOpen(false);
				}
			} finally {
				setIsLoadingSession(false);
			}
		};

		run();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [activeNoteId]);

	// observe right content area size changes (window resize, textarea auto-resize, etc.)
	useEffect(() => {
		const container = editorBodyRef.current;
		const content = memLinesRef.current;
		if (!container) return;

		const ro = new ResizeObserver(() => {
			setLayoutTick((t) => t + 1);
		});

		ro.observe(container);
		if (content) ro.observe(content);
		return () => ro.disconnect();
	}, []);

	// dynamic "lines per page": find the maximum count that fits without oscillation (bounded search)
	useLayoutEffect(() => {
		if (!activeNoteId) return;
		if (isLoadingSession) return;
		if (!editorBodyRef.current || !memLinesRef.current) return;

		const container = editorBodyRef.current;
		const content = memLinesRef.current;

		const available = container.clientHeight;
		const needed = content.scrollHeight;
		if (!available) return;

		const remaining = Math.max(0, memorizeLines.length - pageStartIndex);
		const cap = Math.max(1, Math.min(remaining || 1, MAX_DYNAMIC_LINES));

		// init/reset search window for this (note + page + height + content layout) context
		const key = `${activeNoteId}:${pageStartIndex}:${available}:${layoutTick}:${cap}`;
		if (dynamicFitRef.current.key !== key) {
			dynamicFitRef.current = {
				key,
				low: 1,
				high: cap + 1, // sentinel overflow bound
				cap,
				locked: false,
			};
		}

		const state = dynamicFitRef.current;
		if (state.locked) return;

		const candidate = Math.max(1, Math.min(cap, linesPerPage));
		const fits = needed <= available + 1;

		if (fits) {
			state.low = Math.max(state.low, candidate);
		} else {
			state.high = Math.min(state.high, candidate);
		}

		// terminate: we found the max that fits
		if (state.high <= state.low + 1) {
			state.locked = true;
			if (linesPerPage !== state.low) setLinesPerPage(state.low);
			return;
		}

		const next = Math.max(
			1,
			Math.min(cap, Math.floor((state.low + state.high) / 2))
		);
		if (next !== linesPerPage) setLinesPerPage(next);
	}, [
		activeNoteId,
		isLoadingSession,
		layoutTick,
		linesPerPage,
		memorizeLines.length,
		pageStartIndex,
	]);

	// once linesPerPage stabilizes, apply pending progressLine to pageStartIndex
	useEffect(() => {
		if (!activeNoteId) return;
		const progressLine = pendingProgressLineRef.current;
		if (progressLine == null) return;
		if (!Number.isFinite(progressLine) || progressLine < 0) return;

		const nextStart =
			Math.floor(progressLine / Math.max(1, linesPerPage)) *
			Math.max(1, linesPerPage);
		pendingProgressLineRef.current = null;
		const clamped = Math.min(nextStart, Math.max(0, memorizeLines.length - 1));
		navTriggeredRef.current = true;
		setPageStartIndex(clamped);
		setPageHistory([clamped]);
		setPageHistoryCursor(0);
	}, [activeNoteId, linesPerPage, memorizeLines.length]);

	// keep history in sync when pageStartIndex changes programmatically (e.g., resize clamp)
	useEffect(() => {
		if (navTriggeredRef.current) {
			navTriggeredRef.current = false;
			return;
		}
		// If pageStartIndex doesn't match the current history entry, reset history to avoid drift.
		if (pageHistory[pageHistoryCursor] !== pageStartIndex) {
			setPageHistory([pageStartIndex]);
			setPageHistoryCursor(0);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [pageStartIndex]);

	const handleLineInputChange = useCallback(
		(lineIndex: number, value: string) => {
			// ✅ 사용자가 실제로 타이핑한 노트를 기록 (노트 선택만으로는 기록하지 않음)
			if (activeNoteId) {
				try {
					localStorage.setItem(LAST_MEMORIZE_NOTE_ID_KEY, activeNoteId);
				} catch {
					// ignore
				}
			}

			const next = new Map(allLineInputsRef.current);
			next.set(lineIndex, value);
			allLineInputsRef.current = next;

			if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
			saveTimeoutRef.current = setTimeout(() => {
				if (!sessionId) return;

				const sortedEntries = Array.from(
					allLineInputsRef.current.entries()
				).sort(([a], [b]) => a - b);
				const lastTypedText = sortedEntries.map(([, v]) => v).join('\n');

				memorizeApi
					.updateSession(sessionId, { progressLine: lineIndex, lastTypedText })
					.catch((err) =>
						console.error('[Memorize] 자동 저장 실패', handleApiError(err))
					);
			}, 2000);
		},
		[sessionId, activeNoteId]
	);

	const totalPages = Math.max(
		1,
		Math.ceil(memorizeLines.length / Math.max(1, linesPerPage))
	);
	const startIndex = pageStartIndex;
	const currentPageLines = memorizeLines.slice(
		startIndex,
		startIndex + Math.max(1, linesPerPage)
	);

	const handlePrevPage = () => {
		if (pageHistoryCursor <= 0) return;
		const prevStart = pageHistory[pageHistoryCursor - 1] ?? 0;
		navTriggeredRef.current = true;
		setPageHistoryCursor((c) => Math.max(0, c - 1));
		setPageStartIndex(Math.max(0, prevStart));
	};

	const handleNextPage = () => {
		const step = Math.max(1, linesPerPage);
		const nextStart = Math.min(
			Math.max(0, memorizeLines.length - 1),
			startIndex + step
		);
		if (nextStart === startIndex) return;

		navTriggeredRef.current = true;

		setPageHistory((prev) => {
			const base = prev.slice(0, pageHistoryCursor + 1); // trim forward history
			const last = base[base.length - 1];
			if (last === nextStart) return base;
			return [...base, nextStart];
		});
		setPageHistoryCursor((c) => c + 1);
		setPageStartIndex(nextStart);
	};

	const handleTempCancel = async () => {
		if (!activeNoteId) {
			setIsTempModalOpen(false);
			return;
		}

		// ✅ 이 노트에 대해서는 사용자가 의사결정(취소)했으므로, 다시 모달을 띄우지 않음
		resumePromptResolvedForNoteRef.current = activeNoteId;

		// local storage clear
		const prefix = `memo-${activeNoteId}-`;
		const removeKeys: string[] = [];
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (key && key.startsWith(prefix)) removeKeys.push(key);
		}
		removeKeys.forEach((k) => localStorage.removeItem(k));

		// server reset best-effort (cancel = "start over", but keep session usable for future saves)
		try {
			let effectiveSessionId = sessionId;
			if (!effectiveSessionId) {
				const created = await memorizeApi.createSession(activeNoteId);
				effectiveSessionId = String(created.id);
				setSessionId(effectiveSessionId);
			}

			if (effectiveSessionId) {
				localStorage.setItem(
					`memorize-session-${activeNoteId}`,
					effectiveSessionId
				);
				await memorizeApi.updateSession(effectiveSessionId, {
					progressLine: 0,
					lastTypedText: '',
				});
			}
		} catch (e) {
			console.error('[Memorize] 세션 초기화 실패', handleApiError(e));
		}

		setLineInitialValues(new Map());
		allLineInputsRef.current = new Map();
		setPageStartIndex(0);
		setPageHistory([0]);
		setPageHistoryCursor(0);
		setClearVersion((v) => v + 1);
		setIsTempModalOpen(false);
	};

	useEffect(() => {
		return () => {
			if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
		};
	}, []);

	return (
		<>
			<TempSaveModal
				isOpen={isTempModalOpen}
				onCancel={handleTempCancel}
				onConfirm={() => {
					if (activeNoteId) {
						// ✅ OK를 눌렀으면 이 노트에서는 다시 모달을 띄우지 않음
						resumePromptResolvedForNoteRef.current = activeNoteId;
					}
					setIsTempModalOpen(false);
				}}
			/>

			<PageLayout
				title="Memorization typing"
				subtitle="정리한 내용을 암기해보세요"
				headerActions={
					<>
						{totalPages > 1 && pageHistoryCursor > 0 && (
							<button className="memo-header-button" onClick={handlePrevPage}>
								previous
							</button>
						)}
						{totalPages > 1 &&
							startIndex + Math.max(1, linesPerPage) < memorizeLines.length && (
								<button className="memo-header-button" onClick={handleNextPage}>
									next
								</button>
							)}
					</>
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
						handleNoteDragStart={() => {}}
						handleNoteDragEnd={() => {}}
						handleDropToCategory={() => {}}
						handleDropToRoot={() => {}}
						handleDragOver={(e) => e.preventDefault()}
						bottomExtra={null}
						reorderNotes={reorderNotes}
						reorderCategories={reorderCategories}
						handleCategoryDragStart={handleCategoryDragStart}
						handleCategoryDragEnd={handleCategoryDragEnd}
						dragNoteId={dragNoteId}
						dragCategoryId={dragCategoryId}
					/>
				}
				mainContent={
					<div className="note-editor">
						<div className="note-editor-body" ref={editorBodyRef}>
							{activeNote ? (
								memorizeLines.length > 0 ? (
									<div className="mem-lines" ref={memLinesRef}>
										{isLoadingSession ? (
											<p>세션을 불러오는 중...</p>
										) : (
											currentPageLines.map((line, idx) => (
												<MemorizeLineItem
													key={startIndex + idx}
													referenceText={line}
													noteId={activeNoteId}
													lineIndex={startIndex + idx}
													clearVersion={clearVersion}
													initialValue={lineInitialValues.get(startIndex + idx)}
													onInputChange={handleLineInputChange}
												/>
											))
										)}
									</div>
								) : (
									<p>노트 내용이 없습니다.</p>
								)
							) : (
								<p>왼쪽에서 노트를 선택해 주세요.</p>
							)}
						</div>
					</div>
				}
			/>
		</>
	);
};

export default MemorizePage;
