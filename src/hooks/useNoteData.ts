// src/hooks/useNoteData.ts
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type {
	Category,
	ContextMenuState,
	ContextTargetType,
	EditingItem,
	NoteItem,
} from '../types/noteTypes';
import { DEFAULT_TITLE } from '../utils/noteConstants';
import { saveAll, loadAll } from '../storage/localNoteStorage';
import type { QuizHighlight } from '../types//noteTypes';
import { categoriesApi } from '../services/api/categoriesApi';
import { notesApi } from '../services/api/notesApi';
import { keywordApi } from '../services/api/keywordApi';
import { handleApiError } from '../services/api/authApi';
import { useNoteDetailSync } from './useNoteDetailSync';

interface DeleteTarget {
	type: ContextTargetType;
	id: string;
}

export function useNoteData() {
	const [categories, setCategories] = useState<Category[]>([]);
	const [notes, setNotes] = useState<NoteItem[]>([]);

	const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
	const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

	const [isLoaded, setIsLoaded] = useState(false);

	const categoriesRef = useRef(categories);
	const notesRef = useRef(notes);

	// 키워드 생성 중복 호출 방지용 (noteId별로 client highlight id 추적)
	const keywordCreateInFlightRef = useRef<Record<string, Set<string>>>({});
	const activeNoteIdRef = useRef<string | null>(null);
	const activeCategoryIdRef = useRef(activeCategoryId);

	useNoteDetailSync({
		activeNoteId,
		notes,
		setNotes,
	});

	useEffect(() => {
		categoriesRef.current = categories;
	}, [categories]);

	useEffect(() => {
		notesRef.current = notes;
	}, [notes]);

	useEffect(() => {
		activeNoteIdRef.current = activeNoteId;
	}, [activeNoteId]);

	useEffect(() => {
		activeCategoryIdRef.current = activeCategoryId;
	}, [activeCategoryId]);

	/** 컨텍스트 메뉴 */
	const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
	const contextMenuRef = useRef<HTMLDivElement | null>(null);

	/** 이름 수정 */
	const [editingItem, setEditingItem] = useState<EditingItem | null>(null);
	const [editingText, setEditingText] = useState('');
	const editingInputRef = useRef<HTMLInputElement | null>(null);

	/** 삭제 모달 상태 */
	const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
	const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

	/** 드래그 중인 노트 ID */
	const [dragNoteId, setDragNoteId] = useState<string | null>(null);

	/** 드래그 중인 카테고리 ID */
	const [dragCategoryId, setDragCategoryId] = useState<string | null>(null);

	const handleNoteDragStart = (noteId: string) => {
		setDragNoteId(noteId);
	};

	const handleNoteDragEnd = async () => {
		setDragNoteId(null);

		try {
			const targetCategoryId = activeCategoryIdRef.current;

			// 현재 보고 있는 카테고리(or 미분류)의 노트만 추출
			const orderedNotes = notesRef.current
				.filter((n) =>
					targetCategoryId === null
						? n.categoryId === null
						: n.categoryId === targetCategoryId
				)
				.sort((a, b) => a.order - b.order)
				.map((n) => n.id);

			if (orderedNotes.length === 0) return;

			await notesApi.reorderNotes(orderedNotes, targetCategoryId ?? undefined);
		} catch (e) {
			console.error('[Note] 순서 저장 실패', e);
			alert('노트 순서 저장에 실패했습니다.');
		}
	};

	const handleCategoryDragStart = (categoryId: string) => {
		setDragCategoryId(categoryId);
	};

	const handleCategoryDragEnd = async () => {
		setDragCategoryId(null);

		try {
			// 🔥 최종 정렬 상태를 서버에 한 번만 전달
			await categoriesApi.reorderCategories(categoriesRef.current);
		} catch (e) {
			console.error('[Category] 순서 저장 실패', e);
			alert('카테고리 순서 저장에 실패했습니다.');
			// (선택) 실패 시 재조회 or 롤백 전략 가능
		}
	};

	/**  노트용 공통 이동 함수 추가 **/
	const moveNotesToCategory = async (
		noteIds: string[],
		targetCategoryId: string | null
	) => {
		try {
			await notesApi.moveNotes(noteIds, targetCategoryId);
		} catch (e) {
			console.error('[Note] 이동 실패', e);
			alert('노트 이동에 실패했습니다.');
			// ❗ 기존 UX 유지: 롤백은 하지 않음
		}
	};

	const handleDropToCategory = (categoryId: string) => {
		if (!dragNoteId) return;

		// 1️⃣ UI 즉시 반영 (기존 로직 유지)
		setNotes((prev) =>
			prev.map((n) => (n.id === dragNoteId ? { ...n, categoryId } : n))
		);

		// 2️⃣ 서버 반영 (추가)
		moveNotesToCategory([dragNoteId], categoryId);

		setDragNoteId(null);
	};

	const handleDropToRoot = () => {
		if (!dragNoteId) return;

		// 1️⃣ UI
		setNotes((prev) =>
			prev.map((n) => (n.id === dragNoteId ? { ...n, categoryId: null } : n))
		);

		// 2️⃣ 서버
		moveNotesToCategory([dragNoteId], null);

		setDragNoteId(null);
	};

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
	};

	/* ========== 노트 / 카테고리 순서 재배열 ========== */

	// 노트 순서 변경
	const reorderNotes = (dragId: string, targetId: string) => {
		setNotes((prev) => {
			const list = [...prev];

			const dragIndex = list.findIndex((n) => n.id === dragId);
			const targetIndex = list.findIndex((n) => n.id === targetId);
			if (dragIndex === -1 || targetIndex === -1) return prev;

			const [dragItem] = list.splice(dragIndex, 1);
			list.splice(targetIndex, 0, dragItem);

			// order 재정렬
			return list.map((n, index) => ({ ...n, order: index }));
		});
	};

	// 카테고리 순서 변경
	const reorderCategories = (dragId: string, targetId: string) => {
		setCategories((prev) => {
			const list = [...prev];

			const dragIndex = list.findIndex((c) => c.id === dragId);
			const targetIndex = list.findIndex((c) => c.id === targetId);
			if (dragIndex === -1 || targetIndex === -1) return prev;

			const [dragItem] = list.splice(dragIndex, 1);
			list.splice(targetIndex, 0, dragItem);

			return list.map((c, index) => ({ ...c, order: index }));
		});
	};

	/* ========== 삭제용 헬퍼 ========== */

	// 재귀적으로 모든 하위 카테고리 ID 수집
	const collectCategoryWithChildren = (rootId: string, all: Category[]) => {
		const toDelete = new Set<string>();
		const queue: string[] = [rootId];

		while (queue.length > 0) {
			const cid = queue.shift();
			if (!cid) continue;
			if (toDelete.has(cid)) continue;

			toDelete.add(cid);
			all.forEach((c) => {
				if (c.parentId === cid) queue.push(c.id);
			});
		}
		return toDelete;
	};

	// type별 삭제 처리
	const deleteByTarget = (type: ContextTargetType, id: string) => {
		if (type === 'category') {
			const catIdSet = collectCategoryWithChildren(id, categories);

			// 카테고리 제거
			setCategories((prev) => prev.filter((c) => !catIdSet.has(c.id)));

			// 노트 제거 + activeNoteId 보정
			setNotes((prev) => {
				const filtered = prev.filter(
					(n) => n.categoryId === null || !catIdSet.has(n.categoryId)
				);
				return filtered;
			});

			// 삭제된 대상이 activeNote였을 때만 보정
			if (activeNoteId && catIdSet.has(activeCategoryId ?? '')) {
				setActiveNoteId(null);
			}

			// activeCategory 삭제 시 보정
			if (activeCategoryId && catIdSet.has(activeCategoryId)) {
				setActiveCategoryId(null);
			}
		} else {
			// 노트 삭제
			setNotes((prev) => {
				const filtered = prev.filter((n) => n.id !== id);
				if (id === activeNoteId) {
					setActiveNoteId(filtered[0]?.id ?? '');
				}
				return filtered;
			});
		}
	};

	const deleteCategoryWithServer = async (categoryId: string) => {
		try {
			// 1️⃣ 서버 삭제
			await categoriesApi.deleteCategory(categoryId);

			// 2️⃣ 기존 로컬 삭제 재사용
			deleteByTarget('category', categoryId);
		} catch (e) {
			console.error('[Category] 서버 삭제 실패', e);
			alert('카테고리 삭제에 실패했습니다.');
		}
	};

	/* ========== 노트 내용 업데이트 ========== */

	const updateNoteContent = (noteId: string, html: string) => {
		setNotes((prev) =>
			prev.map((note) =>
				note.id === noteId
					? { ...note, content: html, updatedAt: Date.now() }
					: note
			)
		);
	};

	const syncNoteContentToServer = async (noteId: string) => {
		const note = notesRef.current.find((n) => n.id === noteId);
		if (!note || note.isLocalOnly) return;
		if (!note.hasContentLoaded) return;
		if (note.content == null) return;

		try {
			const res = await notesApi.updateNote(noteId, {
				contentHtml: note.content,
			});

			setNotes((prev) =>
				prev.map((n) =>
					n.id === noteId ? { ...n, updatedAt: res.updatedAt } : n
				)
			);
		} catch (e) {
			console.error('[Note] 서버 저장 실패', e);
		}
	};

	useEffect(() => {
		if (!isLoaded) return;

		const interval = setInterval(() => {
			const id = activeNoteIdRef.current;
			if (id) syncNoteContentToServer(id);
		}, 5000);

		return () => clearInterval(interval);
	}, [isLoaded]);

	const saveNow = () => {
		if (!activeNoteId) return;
		console.log('[ManualSave] 저장 버튼 클릭');
		syncNoteContentToServer(activeNoteId);
	};

	/* ========== 첫 로드시 localStorage 데이터 로드 ========== */
	useEffect(() => {
		const init = async () => {
			console.log('[INIT] start');
			try {
				// 1️⃣ 카테고리 서버 조회
				const serverCategories = await categoriesApi.getCategories();

				const normalizeCategories = (rawCategories: any[]) =>
					rawCategories.map((c) => ({
						...c,
						id: String(c.id),
						parentId:
							c.parentId === null || c.parentId === undefined
								? null
								: String(c.parentId),
						order: typeof c.order === 'number' ? c.order : 0,
					}));

				const normalizedCategories = normalizeCategories(serverCategories);
				console.log('[INIT] normalizedCategories', normalizedCategories);
				setCategories(normalizedCategories);

				// 2️⃣ 노트 서버 조회 (미분류 포함)
				const uncategorizedNotes = await notesApi.getNotes(); // categoryId 없음 → 미분류만

				const categoryNotesList = await Promise.all(
					normalizedCategories.map((c) => notesApi.getNotes(c.id)) // 카테고리별로 조회
				);

				const mergedNotes = [
					...uncategorizedNotes,
					...categoryNotesList.flat(),
				];

				// 혹시 중복 대비 (id 기준)
				const uniqueNotes = Array.from(
					new Map(mergedNotes.map((n) => [n.id, n])).values()
				);

				console.log('[INIT] mergedNotes', uniqueNotes);
				setNotes(uniqueNotes);

				// 3️⃣ active 상태는 기존 로컬 기준 유지
				const loaded = loadAll();

				let nextActiveCategoryId: string | null = null;
				let nextActiveNoteId: string | null = null;

				// ✅ 우선순위 0) 이미 화면에서 선택된(active) 값이 있다면 그걸 최우선으로 유지
				// (RecordPage Retry / QuizPage review 등에서 query param으로 먼저 setActiveNoteId가 들어오는 케이스)
				const existingActiveNoteId = activeNoteIdRef.current;
				const existingActiveCategoryId = activeCategoryIdRef.current;

				if (
					existingActiveCategoryId &&
					normalizedCategories.some((c) => c.id === existingActiveCategoryId)
				) {
					nextActiveCategoryId = existingActiveCategoryId;
				}

				if (
					existingActiveNoteId &&
					uniqueNotes.some((n) => n.id === existingActiveNoteId)
				) {
					nextActiveNoteId = existingActiveNoteId;
				}

				// 1️⃣ 로컬 active가 유효하면 그걸 사용
				if (
					nextActiveCategoryId == null &&
					loaded?.activeCategoryId &&
					serverCategories.some((c) => c.id === loaded.activeCategoryId)
				) {
					nextActiveCategoryId = loaded.activeCategoryId;
				} else if (uniqueNotes.length > 0) {
					const firstNoteCategoryId = uniqueNotes[0].categoryId ?? null; // 이미 string|null 일 가능성
					const strCategoryId = firstNoteCategoryId
						? String(firstNoteCategoryId)
						: null;

					if (
						strCategoryId &&
						normalizedCategories.some((c) => c.id === strCategoryId)
					) {
						nextActiveCategoryId = strCategoryId;
					} else {
						nextActiveCategoryId = null;
					}
				}

				// activeNote도 동일한 방식
				if (
					nextActiveNoteId == null &&
					loaded?.activeNoteId &&
					uniqueNotes.some((n) => n.id === loaded.activeNoteId)
				) {
					nextActiveNoteId = loaded.activeNoteId;
				} else {
					if (nextActiveNoteId == null) {
						nextActiveNoteId = uniqueNotes[0]?.id
							? String(uniqueNotes[0].id)
							: null;
					}
				}

				setActiveCategoryId(nextActiveCategoryId);
				setActiveNoteId(nextActiveNoteId);
			} catch (e) {
				console.error('[useNoteData] 초기 로딩 실패', e);

				// 🔴 fallback: 로컬
				const loaded = loadAll();
				if (loaded) {
					setCategories(loaded.categories ?? []);
					setNotes(loaded.notes ?? []);
					setActiveNoteId(loaded.activeNoteId ?? null);

					setActiveCategoryId(loaded.activeCategoryId ?? null);
				}
			} finally {
				requestAnimationFrame(() => {
					setIsLoaded(true);
				});
			}
		};

		init();
	}, []);

	/* ========== 컨텍스트 메뉴 외부 클릭 ========== */
	useEffect(() => {
		if (!contextMenu) return;

		const handleMouseDown = (e: MouseEvent) => {
			if (
				contextMenuRef.current &&
				!contextMenuRef.current.contains(e.target as Node)
			) {
				setContextMenu(null);
			}
		};

		const handleScroll = () => setContextMenu(null);

		window.addEventListener('mousedown', handleMouseDown);
		window.addEventListener('scroll', handleScroll, true);

		return () => {
			window.removeEventListener('mousedown', handleMouseDown);
			window.removeEventListener('scroll', handleScroll, true);
		};
	}, [contextMenu]);

	/* ========== 이름 수정 input 포커스 ========== */
	useEffect(() => {
		if (editingItem && editingInputRef.current) {
			const input = editingInputRef.current;
			input.focus();
			input.select();
		}
	}, [editingItem]);

	/* ========== 이름 수정 완료 ========== */
	const finishEditing = async () => {
		if (!editingItem) return;

		const trimmed = editingText.trim() || DEFAULT_TITLE;

		if (editingItem.type === 'category') {
			// 1️⃣ UI 즉시 반영 (UX 우선)
			setCategories((prev) =>
				prev.map((cat) =>
					cat.id === editingItem.id ? { ...cat, name: trimmed } : cat
				)
			);

			// 2️⃣ 서버 반영
			try {
				await categoriesApi.updateCategory(editingItem.id, trimmed);
			} catch (e) {
				console.error('[Category] 이름 수정 실패', e);
				alert('카테고리 이름 저장에 실패했습니다.');
				// (선택) 실패 시 다시 수정 상태로 돌릴 수도 있음
			}
		} else {
			// 🔹 노트 이름 수정
			const noteId = editingItem.id;

			// 1️⃣ UI 즉시 반영
			setNotes((prev) =>
				prev.map((note) =>
					note.id === noteId
						? { ...note, name: trimmed, updatedAt: Date.now() }
						: note
				)
			);

			// 2️⃣ 서버 반영
			try {
				const res = await notesApi.updateNote(noteId, {
					title: trimmed,
				});

				setNotes((prev) =>
					prev.map((note) =>
						note.id === noteId ? { ...note, updatedAt: res.updatedAt } : note
					)
				);
			} catch (e) {
				console.error('[Note] 제목 수정 실패', e);
				alert('노트 제목 저장에 실패했습니다.');
			}
		}

		setEditingItem(null);
	};

	/* ========== 우클릭 메뉴 열기 ========== */
	const openContextMenu = (
		event: React.MouseEvent<HTMLElement>,
		targetType: ContextTargetType,
		targetId: string
	) => {
		event.preventDefault();
		event.stopPropagation();

		setContextMenu({
			x: event.clientX,
			y: event.clientY,
			targetType,
			targetId,
		});
	};

	/* ========== 컨텍스트 메뉴 동작 + 삭제 모달 적용 ========== */
	const handleContextMenuItemClick = (action: 'rename' | 'todo' | 'delete') => {
		if (!contextMenu) return;

		if (action === 'rename') {
			if (contextMenu.targetType === 'category') {
				const target = categories.find((c) => c.id === contextMenu.targetId);
				if (target) {
					setEditingItem({ type: 'category', id: target.id });
					setEditingText(target.name);
				}
			} else {
				const target = notes.find((n) => n.id === contextMenu.targetId);
				if (target) {
					setEditingItem({ type: 'note', id: target.id });
					setEditingText(target.name);
				}
			}
			setContextMenu(null);
			return;
		}

		if (action === 'delete') {
			setDeleteTarget({
				type: contextMenu.targetType,
				id: contextMenu.targetId,
			});
			setIsDeleteModalOpen(true);
			setContextMenu(null);
			return;
		}

		console.log('context action:', action);
		setContextMenu(null);
	};

	/* ========== 삭제 모달 핸들러 ========== */
	const handleConfirmDelete = async () => {
		if (!deleteTarget) return;

		if (deleteTarget.type === 'category') {
			deleteCategoryWithServer(deleteTarget.id);
		} else {
			try {
				// 1️⃣ 서버 삭제
				await notesApi.deleteNote(deleteTarget.id);

				// 2️⃣ 기존 로컬 삭제 로직 재사용
				deleteByTarget('note', deleteTarget.id);
			} catch (e) {
				console.error('[Note] 삭제 실패', e);
				alert('노트 삭제에 실패했습니다.');
			}
		}

		setIsDeleteModalOpen(false);
		setDeleteTarget(null);
	};

	const handleCancelDelete = () => {
		setIsDeleteModalOpen(false);
		setDeleteTarget(null);
	};

	const deleteTitle =
		deleteTarget?.type === 'category' ? '카테고리 삭제' : '노트 삭제';

	const deleteDescription =
		deleteTarget?.type === 'category'
			? '이 카테고리를 삭제하면, 하위에 포함된 모든 카테고리와 노트가 함께 삭제됩니다. 정말로 삭제하시겠습니까?'
			: '이 노트를 정말로 삭제하시겠습니까? 삭제 후에는 되돌릴 수 없습니다.';

	/* ========== 카테고리/노트 이동/추가 ========== */

	const handleCategoryClick = (id: string) => {
		setActiveCategoryId(id);
	};

	const handleEnterCategory = (id: string) => {
		setActiveCategoryId(id);

		const firstNote = notes.find((n) => n.categoryId === id);
		setActiveNoteId(firstNote?.id ?? null);
	};

	const handleCategoryBackClick = () => {
		const current = categories.find((c) => c.id === activeCategoryId);

		const parentId = current?.parentId ?? null;

		setActiveCategoryId(parentId); // ✅ 반드시 바꾼다
		setActiveNoteId(null); // ✅ 노트는 초기화
	};

	// ⚠️ 중요: QuizPage/RecordPage에서 query param 기반으로 호출될 수 있고,
	// useEffect dependency로도 사용되므로 "함수 레퍼런스가 매 렌더마다 바뀌지 않게" 고정한다.
	const handleNoteClick = useCallback((noteId: string) => {
		if (noteId === activeNoteIdRef.current) return;
		setActiveNoteId(noteId);
	}, []);

	const handleAddCategory = async () => {
		try {
			// 1️⃣ 서버에 카테고리 생성
			const newCategory = await categoriesApi.createCategory(DEFAULT_TITLE);

			// 2️⃣ 카테고리 state 반영
			setCategories((prev) => {
				console.log('[REPLACE] before', prev);
				const next = [...prev, newCategory];
				console.log('[REPLACE] after', next);
				return next.sort((a, b) => a.order - b.order);
			});

			// 3️⃣ 하위 노트 1개 자동 생성 (기존 UX 유지)
			const createdNote = await notesApi.createNote(
				DEFAULT_TITLE,
				newCategory.id
			);

			// 4️⃣ notes state 반영
			setNotes((prev) => [
				...prev.map((n) => ({ ...n, active: false })),
				createdNote,
			]);

			// 5️⃣ 카테고리 이름 바로 수정 UX 유지
			setEditingItem({ type: 'category', id: newCategory.id });
			setEditingText('');
		} catch (e) {
			console.error('[useNoteData] 카테고리 생성 실패', e);
			alert('카테고리 생성에 실패했습니다.');
		}
	};

	const handleAddNote = async () => {
		const tempId = `temp-note-${Date.now()}`;
		const targetCategoryId = activeCategoryId;

		const siblingCount = notes.filter((n) =>
			activeCategoryId === null
				? n.categoryId === null
				: n.categoryId === activeCategoryId
		).length;

		console.log('[ADD NOTE] targetCategoryId', targetCategoryId);

		// 1️⃣ 로컬 즉시 생성 (기존 로직 유지)
		const newNote: NoteItem = {
			id: tempId,
			name: DEFAULT_TITLE,
			active: true,
			categoryId: targetCategoryId,
			content: '',
			isLocalOnly: true,
			order: siblingCount,
			updatedAt: Date.now(),
		};

		setNotes((prev) => [
			...prev.map((n) => ({ ...n, active: false })),
			newNote,
		]);
		setActiveNoteId(tempId);
		setActiveCategoryId(targetCategoryId);
		setEditingItem({ type: 'note', id: tempId });
		setEditingText('');

		// 2️⃣ 서버 생성 (백그라운드)
		try {
			const created = await notesApi.createNote(
				DEFAULT_TITLE,
				targetCategoryId === null ? undefined : targetCategoryId
			);
			console.log('[CREATE] server created note', created);

			// 3️⃣ tempId → 서버 id 치환
			setNotes((prev) =>
				prev.map((n) =>
					n.id === tempId
						? {
								...n,
								...created,
								isLocalOnly: false,
						  }
						: n
				)
			);

			// 4️⃣ active / editing 대상도 교체
			setActiveNoteId(created.id);
			setEditingItem({ type: 'note', id: created.id });
		} catch (e) {
			console.error('[Note] 생성 실패', e);
			alert('노트 생성에 실패했습니다.');
		}
	};

	/* ========== Quiz Highlight ========== */

	const handleSaveQuizHighlights = async (
		noteId: string,
		highlights: QuizHighlight[]
	) => {
		// 1) UI 먼저 반영 (optimistic)
		setNotes((prev) =>
			prev.map((note) =>
				note.id !== noteId ? note : { ...note, highlightList: highlights }
			)
		);

		// 2) 서버 동기화 (temp/local 노트는 제외)
		if (noteId.startsWith('temp-note-')) return;
		const note = notesRef.current.find((n) => n.id === noteId);
		if (!note || note.isLocalOnly) return;

		const isServerId = (id: string) => /^\d+$/.test(id);

		// 같은 highlight(동일 client id)가 여러 번 POST되는 것을 방지
		const inFlight = (keywordCreateInFlightRef.current[noteId] ??=
			new Set<string>());

		const newHighlights = highlights.filter(
			(h) => !isServerId(h.id) && !inFlight.has(h.id)
		);
		if (newHighlights.length === 0) return;

		try {
			// 생성 시작 마킹 (중복 POST 방지)
			newHighlights.forEach((h) => inFlight.add(h.id));

			const results = await Promise.allSettled(
				newHighlights.map((h) =>
					keywordApi.createKeyword(noteId, {
						keywordText: h.text,
						startOffset: h.startOffset,
						endOffset: h.endOffset,
					})
				)
			);

			const createdMap = new Map<
				string,
				{
					id: number;
					keywordText: string;
					startOffset: number;
					endOffset: number;
				}
			>();

			results.forEach((r, idx) => {
				if (r.status === 'fulfilled') {
					createdMap.set(newHighlights[idx].id, r.value);
				}
			});

			if (createdMap.size === 0) return;

			const updatedHighlights = highlights.map((h) => {
				if (isServerId(h.id)) return h;
				const res = createdMap.get(h.id);
				if (!res) return h; // 일부만 성공했을 수 있음
				return {
					...h,
					id: String(res.id),
					text: res.keywordText,
					startOffset: res.startOffset,
					endOffset: res.endOffset,
				};
			});

			setNotes((prev) =>
				prev.map((n) =>
					n.id !== noteId ? n : { ...n, highlightList: updatedHighlights }
				)
			);
		} catch (e) {
			console.error('[Keyword] 생성 실패', e);
			alert(handleApiError(e));
		} finally {
			// 생성 완료 마킹 해제 (성공/실패 모두)
			newHighlights.forEach((h) => inFlight.delete(h.id));
		}
	};

	const handleRemoveQuizHighlight = async (
		noteId: string,
		keywordId: string
	) => {
		// 1) UI 먼저 반영 (optimistic)
		setNotes((prev) =>
			prev.map((note) =>
				note.id !== noteId
					? note
					: {
							...note,
							highlightList: (note.highlightList ?? []).filter(
								(h) => h.id !== keywordId
							),
					  }
			)
		);

		// 2) 서버 삭제 (temp/local 노트 또는 아직 서버 id 없는 키워드는 제외)
		if (noteId.startsWith('temp-note-')) return;
		const note = notesRef.current.find((n) => n.id === noteId);
		if (!note || note.isLocalOnly) return;
		if (!/^\d+$/.test(keywordId)) return;

		try {
			await keywordApi.deleteKeyword(noteId, keywordId);
		} catch (e) {
			console.error('[Keyword] 삭제 실패', e);
			alert(handleApiError(e));

			// 실패 시 서버 상태로 재동기화
			try {
				const keywords = await keywordApi.getKeywords(noteId);
				setNotes((prev) =>
					prev.map((n) =>
						n.id !== noteId ? n : { ...n, highlightList: keywords }
					)
				);
			} catch (e2) {
				console.error('[Keyword] 재조회 실패', e2);
			}
		}
	};

	return {
		categories,
		setCategories,
		notes,
		setNotes,
		isLoaded,
		activeNoteId,
		setActiveNoteId,
		activeCategoryId,
		setActiveCategoryId,
		contextMenu,
		setContextMenu,
		contextMenuRef,
		editingItem,
		setEditingItem,
		editingText,
		setEditingText,
		editingInputRef,
		finishEditing,
		openContextMenu,
		handleContextMenuItemClick,

		// 삭제 모달 관련
		isDeleteModalOpen,
		deleteTitle,
		deleteDescription,
		handleConfirmDelete,
		handleCancelDelete,

		// 구조 네비게이션
		handleCategoryClick,
		handleEnterCategory,
		handleCategoryBackClick,
		handleAddCategory,
		handleAddNote,
		handleNoteClick,

		// Quiz Highlight 조작
		handleRemoveQuizHighlight,
		handleSaveQuizHighlights,

		// 드래그 이동 관련
		handleNoteDragStart,
		handleNoteDragEnd,
		handleDropToCategory,
		handleDropToRoot,
		handleDragOver,

		reorderNotes,
		reorderCategories,
		handleCategoryDragStart,
		handleCategoryDragEnd,

		dragNoteId,
		dragCategoryId,

		// 데이터 저장
		updateNoteContent,
		saveNow,
	};
}
