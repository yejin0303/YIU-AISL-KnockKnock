import { useEffect } from 'react';
import { notesApi } from '../services/api/notesApi';
import type { NoteItem } from '../types/noteTypes';

interface Props {
  activeNoteId: string | null;
  notes: NoteItem[];
  setNotes: React.Dispatch<React.SetStateAction<NoteItem[]>>;
}

export function useNoteDetailSync({ activeNoteId, notes, setNotes }: Props) {
  useEffect(() => {
    if (!activeNoteId) return;
    if (activeNoteId.startsWith('temp-note-')) return;

    const localNote = notes.find((n) => n.id === activeNoteId);
    if (!localNote) return;
    if (localNote.isLocalOnly) return;
    if (localNote.hasContentLoaded) return;

    notesApi
      .getNoteDetail(activeNoteId)
      .then((serverNote) => {
        console.log('[DETAIL API RAW]', serverNote);

        setNotes((prev) =>
          prev.map((n) =>
            n.id === serverNote.id
              ? {
                  ...n,
                  ...serverNote,
                  content: serverNote.content ?? '',
                  hasContentLoaded: true,
                  isLocalOnly: false,
                }
              : n
          )
        );
      })
      .catch((e) => {
        console.error('[useNoteDetailSync] 상세 조회 실패', e);
      });
  }, [activeNoteId, notes]);
}
