export type LocalUser = {
  name: string;
  email: string;
  password: string;
};

const USERS_KEY = 'mock_users';
const CURRENT_USER_KEY = 'mock_current_user';

// 유저 목록 가져오기
function getUsers(): LocalUser[] {
  const raw = localStorage.getItem(USERS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as LocalUser[];
  } catch {
    return [];
  }
}

// 유저 목록 저장
function saveUsers(users: LocalUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

// 회원가입
export function registerUser(user: LocalUser): {
  ok: boolean;
  message?: string;
} {
  const users = getUsers();
  const exists = users.some((u) => u.email === user.email);

  if (exists) {
    return { ok: false, message: '이미 사용 중인 이메일입니다.' };
  }

  users.push(user);
  saveUsers(users);

  // 자동 로그인처럼 현재 유저도 저장
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));

  return { ok: true };
}

// 로그인
export function loginUser(
  email: string,
  password: string
): { ok: boolean; user?: LocalUser; message?: string } {
  const users = getUsers();
  const found = users.find((u) => u.email === email && u.password === password);

  if (!found) {
    return { ok: false, message: '이메일 또는 비밀번호가 올바르지 않습니다.' };
  }

  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(found));
  return { ok: true, user: found };
}

// 비밀번호 재설정
export function resetPassword(
  email: string,
  newPassword: string
): { ok: boolean; message?: string } {
  const users = getUsers();
  const index = users.findIndex((u) => u.email === email);

  if (index === -1) {
    return { ok: false, message: '존재하지 않는 이메일입니다.' };
  }

  // 비밀번호 업데이트
  users[index].password = newPassword;
  saveUsers(users);

  // 현재 로그인 유저도 갱신
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(users[index]));

  return { ok: true };
}

// 현재 로그인 유저 가져오기
export function getCurrentUser(): LocalUser | null {
  const raw = localStorage.getItem(CURRENT_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LocalUser;
  } catch {
    return null;
  }
}

// 로그아웃
export function logoutUser() {
  localStorage.removeItem(CURRENT_USER_KEY);
}
