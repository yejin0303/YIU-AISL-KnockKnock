import axios from 'axios';

// ==================== 환경 변수 설정 ====================
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

// axios 인스턴스 생성
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // 세션 쿠키 전송
});

console.log('[authApi] API_BASE_URL =', API_BASE_URL);

// ==================== 공통 헤더 주입 ====================
// NoteKeywordController 등 일부 API가 X-USER-ID 헤더를 요구함.
apiClient.interceptors.request.use((config) => {
  try {
    const userId = localStorage.getItem('userId');
    if (userId) {
      config.headers = config.headers ?? {};
      (config.headers as any)['X-USER-ID'] = userId;
    }
  } catch {
    // SSR/스토리지 접근 불가 상황 등에서는 무시
  }
  return config;
});

// ==================== 회원가입 관련 타입 ====================
export interface SignupApiRequest {
  name: string;
  email: string;
  password: string;
  code: string;
}

export interface SignupApiResponse {
  id: number;
  name: string;
  email: string;
}

// ==================== 이메일 인증 관련 타입 ====================
export interface EmailVerificationRequest {
  email: string;
  purpose: 'SIGNUP' | 'RESET_PASSWORD';
}

export interface EmailVerificationResponse {
  message: string;
}

export interface VerifyCodeRequest {
  email: string;
  purpose: 'SIGNUP' | 'RESET_PASSWORD';
  code: string;
}

export interface VerifyCodeResponse {
  verified: boolean;
}

// ==================== 로그인/비번재설정/회원탈퇴 타입 ====================
export interface LoginApiRequest {
  email: string;
  password: string;
}

export interface LoginUser {
  id: number;
  name: string;
  email: string;
  token?: string;
}

export interface LoginApiResponse {
  // 백엔드 LoginResponse 필드에 맞춰서 필요하면 수정
  id: number;
  name: string;
  email: string;
  // token이 있다면 추가해서 쓰면 됨
  token?: string;
  user: LoginUser;
}

export interface PasswordResetApiRequest {
  email: string;
  code: string;
  newPassword: string;
}

export interface MessageResponse {
  message: string;
}

// ==================== API 함수 ====================
export const authApi = {
  // 이메일 인증코드 발송
  requestVerificationCode: async (
    data: EmailVerificationRequest
  ): Promise<EmailVerificationResponse> => {
    const response = await apiClient.post(
      '/emails/verification-code/send',
      data
    );
    return response.data;
  },

  // 인증코드 검증
  verifyCode: async (data: VerifyCodeRequest): Promise<VerifyCodeResponse> => {
    const response = await apiClient.post(
      '/emails/verification-code/verify',
      data
    );
    return response.data;
  },

  // 회원가입
  signup: async (data: SignupApiRequest): Promise<SignupApiResponse> => {
    const response = await apiClient.post('/auth/signup', data);
    return response.data;
  },

  // ✅ 로그인
  login: async (data: LoginApiRequest): Promise<LoginApiResponse> => {
    const response = await apiClient.post('/auth/login', data);
    return response.data;
  },

  // ✅ 비밀번호 재설정
  resetPassword: async (
    data: PasswordResetApiRequest
  ): Promise<MessageResponse> => {
    const response = await apiClient.post('/auth/password/reset', data);
    return response.data;
  },

  // ✅ 회원탈퇴
  deleteUser: async (): Promise<MessageResponse> => {
    const response = await apiClient.delete('/auth/user');
    return response.data;
  },
};

// ==================== 에러 핸들링 ====================
export const handleApiError = (error: any): string => {
  if (axios.isAxiosError(error) && !error.response) {
    return '서버에 연결할 수 없습니다. (서버 실행/CORS/주소 확인)';
  }

  if (axios.isAxiosError(error)) {
    const data: any = error.response?.data;
    const message = data?.message || data?.error;

    if (message) return message;

    switch (error.response?.status) {
      case 400:
        return '잘못된 요청입니다. (요청 값/DTO 검증 실패 가능)';
      case 401:
        return '인증이 필요합니다.';
      case 403:
        return '요청이 거부되었습니다. (권한/CSRF/CORS 확인)';
      case 404:
        return 'API 주소를 찾을 수 없습니다. (엔드포인트 확인)';
      case 409:
        return '이미 존재하는 정보입니다.';
      case 500:
        return '서버 내부 오류입니다. (백엔드 로그 확인 필요)';
      default:
        return `요청 실패 (status: ${error.response?.status})`;
    }
  }

  return '알 수 없는 오류가 발생했습니다.';
};
