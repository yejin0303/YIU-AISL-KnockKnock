import { apiClient } from './authApi';
import type { Category } from '../../types/noteTypes';

/* ==================== API 응답 타입 ==================== */

interface CategoryApiItem {
  id: number;
  name: string;
  sortOrder: number;
}

interface GetCategoriesApiResponse {
  categories: CategoryApiItem[];
}

//생성
interface CreateCategoryResponse {
  id: number;
  name: string;
  sortOrder: number;
}

/* ==================== Reorder 타입 ==================== */

interface CategoryReorderItem {
  id: number;
  sortOrder: number;
}

interface CategoryReorderResponse {
  success: boolean;
  updatedCount: number;
}

/* ==================== Delete Response ==================== */

interface DeleteCategoryResponse {
  message: string;
}

/* ==================== 매핑 함수 ==================== */
/**
 * 서버 Category → 프론트 Category 변환
 * (number id → string id)
 */
function mapCategoryApiItemToCategory(item: CategoryApiItem): Category {
  return {
    id: String(item.id), // 🔥 중요: 프론트는 string
    name: item.name,
    parentId: null, // 서버 구조에 아직 없음
    order: item.sortOrder,
  };
}

/* ==================== API ==================== */

export const categoriesApi = {
  /**
   * 카테고리 전체 조회
   */
  getCategories: async (): Promise<Category[]> => {
    const response = await apiClient.get<GetCategoriesApiResponse>(
      '/categories'
    );
    return response.data.categories.map(mapCategoryApiItemToCategory);
  },

  /**
   * 카테고리 생성
   */

  createCategory: async (name: string): Promise<Category> => {
    const res = await apiClient.post<CreateCategoryResponse>('/categories', {
      name,
    });
    return mapCategoryApiItemToCategory(res.data);
  },

  /**
   * 카테고리 이름 수정
   */
  updateCategory: async (
    categoryId: string,
    name: string
  ): Promise<Category> => {
    const res = await apiClient.patch<CategoryApiItem>(
      `/categories/${categoryId}`,
      { name }
    );

    return mapCategoryApiItemToCategory(res.data);
  },

  /**
   * 카테고리 순서 일괄 변경 (드래그 앤 드롭 결과 반영)
   */
  reorderCategories: async (categories: Category[]): Promise<void> => {
    const payload: CategoryReorderItem[] = categories.map((cat, index) => ({
      id: Number(cat.id), // string → number
      sortOrder: index + 1,
    }));

    await apiClient.patch<CategoryReorderResponse>(
      '/categories/reorder',
      payload
    );
  },

  /**
   * 🗑 카테고리 삭제
   * - 하위 노트 및 연관 데이터는 백엔드에서 일괄 삭제
   */
  deleteCategory: async (categoryId: string): Promise<void> => {
    await apiClient.delete<DeleteCategoryResponse>(`/categories/${categoryId}`);
  },
};
