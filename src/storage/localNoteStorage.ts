// src/storage/localNoteStorage.ts
import type { Category, NoteItem } from '../types/noteTypes';

const STORAGE_KEY = 'note-app-data_v1';

export interface StoredData {
  categories: Category[];
  notes: NoteItem[];
  activeNoteId: string | null;
  activeCategoryId: string | null;
}

/** ------------------------------
 *  저장
 *  ------------------------------ */
export function saveAll(data: StoredData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('❌ localStorage 저장 실패:', err);
  }
}

/** ------------------------------
 *  로드
 *  ------------------------------ */
export function loadAll(): StoredData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    // 안전성 보장을 위해 기본값을 강제 삽입
    return {
      categories: parsed.categories ?? [],
      notes: parsed.notes ?? [],
      activeNoteId: parsed.activeNoteId ?? null,
      activeCategoryId: parsed.activeCategoryId ?? null,
    };
  } catch (err) {
    console.error('❌ localStorage 로드 실패:', err);
    return null;
  }
}

/** ------------------------------
 *  부분 업데이트 (Merge 방식)
 *  ------------------------------ */
export function updatePartial(partial: Partial<StoredData>) {
  const current = loadAll() ?? {
    categories: [],
    notes: [],
    activeNoteId: null,
    activeCategoryId: null,
  };

  const merged = { ...current, ...partial };
  saveAll(merged);
}
