import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../LoginPage/style/auth.css';
import Logo from '../../png/Logo.png';

// ✅ API 로그인
import { authApi, handleApiError } from '../../services/api/authApi';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [errors, setErrors] = useState({
    email: '',
    password: '',
  });

  const [loginError, setLoginError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const newErrors = { email: '', password: '' };
    let hasError = false;

    setLoginError('');

    if (!email.trim()) {
      newErrors.email = '이메일을 입력해주세요.';
      hasError = true;
    }
    if (!password.trim()) {
      newErrors.password = '비밀번호를 입력해주세요.';
      hasError = true;
    }

    setErrors(newErrors);
    if (hasError) return;

    setIsSubmitting(true);

    try {
      const res = await authApi.login({ email, password });

      const user = (res as any).user ?? res;

      localStorage.setItem('userName', user?.name ?? '');
      if (user?.id != null) {
        localStorage.setItem('userId', String(user.id));
      }
      console.log('[login] saved userName:', user?.name);

      // 디버깅용(원하면 지워도 됨)
      console.log('[login] response:', res);
      console.log('[login] saved userName:', localStorage.getItem('userName'));

      navigate('/main', { replace: true });
    } catch (error: any) {
      setLoginError(handleApiError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-root">
      <div className="auth-wrapper">
        <div className="auth-logo-area">
          <img src={Logo} alt="Logo" className="auth-logo-img" />
        </div>

        <div className="auth-form-area">
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="input-wrapper">
              <input
                type="text"
                className={`auth-input ${errors.email ? 'input-error' : ''}`}
                placeholder="이메일을 입력하세요."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <p className="error-message">{errors.email}</p>
            </div>

            <div className="input-wrapper">
              <input
                type="password"
                className={`auth-input ${errors.password ? 'input-error' : ''}`}
                placeholder="비밀번호를 입력하세요."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="error-message">{errors.password || loginError}</p>
            </div>

            <button
              type="submit"
              className="auth-button"
              disabled={isSubmitting}
            >
              {isSubmitting ? '로그인 중...' : '로그인'}
            </button>
          </form>

          <div className="auth-link-box">
            <button
              type="button"
              className="auth-link-button"
              onClick={() => navigate('/signup')}
            >
              회원가입
            </button>

            <span className="auth-divider">|</span>

            <button
              type="button"
              className="auth-link-button"
              onClick={() => navigate('/reset-password')}
            >
              비밀번호를 잊으셨나요?
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
