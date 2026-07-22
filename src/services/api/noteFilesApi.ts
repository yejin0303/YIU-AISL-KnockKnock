import { apiClient } from './authApi';

/* ==================== API 응답 타입 ==================== */

export interface NoteFileApiResponse {
  id: number;
  noteId: number;
  originalName: string;
  storedPath: string; // 🔥 이미지 접근 URL
  fileSize: number;
  createdAt: string;
}

/* ==================== Delete API 응답 타입 ==================== */

export interface DeleteNoteFileResponse {
  message: string;
  fileId: number;
}

/* ==================== API ==================== */

export const noteFilesApi = {
  /**
   * 🖼 노트 이미지 업로드
   *
   * @param noteId - 이미지가 첨부될 노트 ID
   * @param file - 업로드할 이미지 파일
   * @returns 업로드된 파일 메타데이터 (storedPath 포함)
   */
  uploadNoteImage: async (
    noteId: string | number,
    file: File
  ): Promise<NoteFileApiResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    const res = await apiClient.post<NoteFileApiResponse>(
      `/notes/${noteId}/files`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    return res.data;
  },

  /**
   * 🗑 노트 이미지 파일 삭제
   *
   * @param noteId - 노트 ID
   * @param fileId - 삭제할 파일 ID
   * @returns 삭제 결과 메시지
   */
  deleteNoteImage: async (
    noteId: string | number,
    fileId: string | number
  ): Promise<DeleteNoteFileResponse> => {
    const res = await apiClient.delete<DeleteNoteFileResponse>(
      `/notes/${noteId}/files/${fileId}`
    );

    return res.data;
  },
};
