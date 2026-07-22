import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../LoginPage/style/auth.css';
import Logo from '../../png/Logo.png';

// API 서비스 import
import { authApi, handleApiError } from '../../services/api/authApi';

// 비밀번호 강도 타입 정의
type PasswordStrength = 'none' | 'weak' | 'medium' | 'strong';

const SignupPage: React.FC = () => {
  const navigate = useNavigate();

  // 사용자 입력 정보
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  // 이메일 인증 관련 상태
  const [hasRequestedCode, setHasRequestedCode] = useState(false); // 인증코드 요청 여부
  const [code, setCode] = useState(''); // 사용자가 입력한 인증번호
  const [verifyStatus, setVerifyStatus] = useState<'idle' | 'success' | 'fail'>(
    'idle'
  ); // 인증 상태

  // 로딩 상태
  const [isLoadingCode, setIsLoadingCode] = useState(false); // 인증코드 전송 중
  const [isVerifying, setIsVerifying] = useState(false); // 인증번호 확인 중
  const [isSubmitting, setIsSubmitting] = useState(false); // 회원가입 제출 중

  // 비밀번호 관련 상태
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [passwordStrength, setPasswordStrength] =
    useState<PasswordStrength>('none');

  // 에러 메시지 관리
  const [errors, setErrors] = useState({
    name: '',
    email: '',
    code: '',
    password: '',
    passwordConfirm: '',
  });

  // 비밀번호 불일치 여부
  const passwordError =
    passwordConfirm !== '' && password !== '' && password !== passwordConfirm;

  // 비밀번호 강도 계산 함수
  const evaluatePasswordStrength = (pw: string): PasswordStrength => {
    if (!pw) return 'none';
    if (pw.length < 8) return 'weak';

    const hasNumber = /[0-9]/.test(pw);
    const hasSpecial = /[^A-Za-z0-9]/.test(pw);

    if (hasNumber && !hasSpecial) return 'medium';
    if (hasNumber && hasSpecial) return 'strong';

    return 'weak';
  };

  const getStrengthLabel = (strength: PasswordStrength) => {
    switch (strength) {
      case 'weak':
        return '비밀번호 강도: 약함';
      case 'medium':
        return '비밀번호 강도: 보통';
      case 'strong':
        return '비밀번호 강도: 강함';
      default:
        return '';
    }
  };

  // 이메일 인증코드 요청
  const handleRequestCode = async () => {
    // 이메일 입력 여부 확인
    if (!email.trim()) {
      setErrors((prev) => ({ ...prev, email: '이메일을 입력해주세요.' }));
      return;
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setErrors((prev) => ({ ...prev, email: '올바른 이메일 형식이 아닙니다.' }));
      return;
    }

    setIsLoadingCode(true);
    setErrors((prev) => ({ ...prev, email: '', code: '' }));

    try {
      // API 호출: 인증코드 요청
      const response = await authApi.requestVerificationCode({
        email,
        purpose: 'SIGNUP',
      });

      // 인증코드 요청 성공 시 상태 업데이트
      setHasRequestedCode(true);
      setVerifyStatus('idle');
      setCode('');

      alert(response.message || '인증코드가 발송되었습니다.');
    } catch (error: any) {
      const errorMessage = handleApiError(error);
      setErrors((prev) => ({ ...prev, email: errorMessage }));
    } finally {
      setIsLoadingCode(false);
    }
  };

  // 인증확인
  const handleVerify = async () => {
    // 인증번호 입력 여부 확인
    if (!code.trim()) {
      setErrors((prev) => ({ ...prev, code: '인증번호를 입력해주세요.' }));
      return;
    }

    // 인증코드 요청 여부 확인
    if (!hasRequestedCode) {
      setErrors((prev) => ({
        ...prev,
        code: '인증요청을 먼저 진행해주세요.',
      }));
      return;
    }

    setIsVerifying(true);
    setErrors((prev) => ({ ...prev, code: '' }));

    try {
      // API 호출: 인증번호 확인
      const response = await authApi.verifyCode({
        email,
        code,
        purpose: 'SIGNUP',
      });

      if (response.verified) {
        setVerifyStatus('success');
        setErrors((prev) => ({ ...prev, code: '' }));
      } else {
        setVerifyStatus('fail');
        setErrors((prev) => ({
          ...prev,
          code: '인증번호가 올바르지 않습니다.',
        }));
      }
    } catch (error) {
      setVerifyStatus('fail');
      const errorMessage = handleApiError(error);
      setErrors((prev) => ({ ...prev, code: errorMessage }));
    } finally {
      setIsVerifying(false);
    }
  };

  // 회원가입 제출
  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const newErrors = {
      name: '',
      email: '',
      code: '',
      password: '',
      passwordConfirm: '',
    };

    let hasError = false;

    // 이름 검증
    if (!name.trim()) {
      newErrors.name = '이름을 입력해주세요.';
      hasError = true;
    }

    // 이메일 검증
    if (!email.trim()) {
      newErrors.email = '이메일을 입력해주세요.';
      hasError = true;
    }

    // 인증 여부 검증
    if (!hasRequestedCode) {
      newErrors.code = '인증요청을 먼저 진행해주세요.';
      hasError = true;
    } else if (verifyStatus !== 'success') {
      newErrors.code = '인증번호를 확인해주세요.';
      hasError = true;
    }

    // 비밀번호 / 비밀번호 확인 체크
    if (!password.trim() || !passwordConfirm.trim()) {
      newErrors.password = '';
      newErrors.passwordConfirm = '비밀번호를 입력해주세요.';
      hasError = true;
    } else if (password !== passwordConfirm) {
      newErrors.password = '';
      newErrors.passwordConfirm = '비밀번호가 일치하지 않습니다.';
      hasError = true;
    }

    setErrors(newErrors);
    if (hasError) return;

    setIsSubmitting(true);

    try {
      // API 호출: 회원가입
      await authApi.signup({
        name,
        email,
        password,
        code,
      });

      alert('회원가입이 완료되었습니다!');
      navigate('/');
    } catch (error) {
      alert(handleApiError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==================== UI 관련 변수 ====================
  const emailButtonClass = `reset-inline-button${
    hasRequestedCode ? ' reset-inline-button--outline' : ''
  }`;
  const emailButtonLabel = hasRequestedCode ? '재요청' : '인증요청';

  const verifyButtonClass =
    'reset-inline-button' +
    (verifyStatus === 'success'
      ? ' reset-inline-button--success'
      : verifyStatus === 'fail'
      ? ' reset-inline-button--error'
      : '');

  const verifyButtonLabel =
    verifyStatus === 'success'
      ? '인증완료'
      : verifyStatus === 'fail'
      ? '인증실패'
      : '인증확인';

  // 버튼 비활성화 조건
  const isEmailButtonDisabled = isLoadingCode || !email.trim();
  const isVerifyButtonDisabled =
    isVerifying || !code.trim() || verifyStatus === 'success';

  return (
    <div className="auth-root">
      <div className="auth-wrapper">
        {/* 왼쪽 로고 */}
        <div className="auth-logo-area">
          <img src={Logo} alt="Logo" className="auth-logo-img" />
        </div>

        {/* 오른쪽 회원가입 폼 */}
        <div className="reset-form-area">
          <form className="reset-form" onSubmit={handleSignup}>
            {/* 이름 */}
            <div className="reset-row">
              <label className="reset-label">이름</label>
              <input
                className={`reset-input ${errors.name ? 'input-error' : ''}`}
                placeholder="이름을 입력하세요."
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <p className="error-message">{errors.name}</p>

            {/* 이메일 */}
            <div className="reset-row">
              <label className="reset-label">이메일</label>
              <div className="reset-row-input">
                <input
                  className={`reset-input ${errors.email ? 'input-error' : ''}`}
                  placeholder="사용 가능한 이메일을 입력해 주세요."
                  value={email}
                  onChange={(e) => {
                    const v = e.target.value;
                    setEmail(v);

                    // ✅ 이메일이 바뀌면 인증 상태 초기화
                    setHasRequestedCode(false);
                    setVerifyStatus('idle');
                    setCode('');
                    setErrors((prev) => ({ ...prev, email: '', code: '' }));
                  }}
                />
                <button
                  type="button"
                  className={emailButtonClass}
                  onClick={handleRequestCode}
                  disabled={isEmailButtonDisabled}
                >
                  {isLoadingCode ? '전송중...' : emailButtonLabel}
                </button>
              </div>
            </div>
            <p className="error-message">{errors.email}</p>

            {/* 인증번호 */}
            <div className="reset-row">
              <label className="reset-label">인증번호</label>
              <div className="reset-row-input">
                <input
                  className={`reset-input ${errors.code ? 'input-error' : ''}`}
                  placeholder="인증번호 6자리"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    if (verifyStatus !== 'idle') setVerifyStatus('idle');
                    setErrors((prev) => ({ ...prev, code: '' }));
                  }}
                />
                <button
                  type="button"
                  className={verifyButtonClass}
                  onClick={handleVerify}
                  disabled={isVerifyButtonDisabled}
                >
                  {isVerifying ? '확인중...' : verifyButtonLabel}
                </button>
              </div>
            </div>
            <p className="error-message">{errors.code}</p>

            {/* 비밀번호 */}
            <div className="reset-row">
              <label className="reset-label">비밀번호</label>

              <input
                type="password"
                className={`reset-input ${
                  errors.passwordConfirm || passwordError ? 'input-error' : ''
                }`}
                placeholder="영문/숫자/특수문자 포함 8자 이상"
                value={password}
                onChange={(e) => {
                  const value = e.target.value;
                  setPassword(value);
                  setPasswordStrength(evaluatePasswordStrength(value));
                }}
              />

              {passwordStrength !== 'none' && (
                <p
                  className={`password-strength password-strength--${passwordStrength}`}
                >
                  {getStrengthLabel(passwordStrength)}
                </p>
              )}

              <p className="error-message">{errors.password}</p>

              <div className="reset-input-with-icon">
                <input
                  type="password"
                  className={`reset-input ${
                    errors.passwordConfirm || passwordError ? 'input-error' : ''
                  }`}
                  placeholder="비밀번호 확인"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                />

                {password &&
                  passwordConfirm &&
                  !passwordError &&
                  !errors.passwordConfirm && (
                    <span className="reset-check-icon">✓</span>
                  )}
              </div>

              <p className="error-message">{errors.passwordConfirm}</p>
            </div>

            {/* 회원가입 버튼 */}
            <div className="reset-submit-wrap">
              <button className="reset-submit-button" disabled={isSubmitting}>
                {isSubmitting ? '처리중...' : '회원가입'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
