import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../LoginPage/style/auth.css';
import Logo from '../../png/Logo.png';

import { authApi, handleApiError } from '../../services/api/authApi';

type PasswordStrength = 'none' | 'weak' | 'medium' | 'strong';

const PasswordResetPage: React.FC = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [hasRequestedCode, setHasRequestedCode] = useState(false);
  const [code, setCode] = useState('');
  const [verifyStatus, setVerifyStatus] = useState<'idle' | 'success' | 'fail'>(
    'idle'
  );

  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [passwordStrength, setPasswordStrength] =
    useState<PasswordStrength>('none');

  const [isLoadingCode, setIsLoadingCode] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [errors, setErrors] = useState({
    email: '',
    code: '',
    password: '',
    passwordConfirm: '',
  });

  const passwordError =
    passwordConfirm !== '' && password !== '' && password !== passwordConfirm;

  const isPasswordMatch =
    passwordConfirm !== '' &&
    password !== '' &&
    password === passwordConfirm &&
    !errors.passwordConfirm;

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

  // ✅ 인증요청 (API)
  const handleRequestCode = async () => {
    if (!email.trim()) {
      setErrors((prev) => ({ ...prev, email: '이메일을 입력해주세요.' }));
      return;
    }

    setIsLoadingCode(true);
    setErrors((prev) => ({ ...prev, email: '', code: '' }));

    try {
      const res = await authApi.requestVerificationCode({
        email,
        purpose: 'RESET_PASSWORD',
      });

      setHasRequestedCode(true);
      setVerifyStatus('idle');
      setCode('');

      alert(res.message || '인증코드가 발송되었습니다.');
    } catch (e: any) {
      setErrors((prev) => ({ ...prev, email: handleApiError(e) }));
    } finally {
      setIsLoadingCode(false);
    }
  };

  // ✅ 인증확인 (API)
  const handleVerify = async () => {
    if (!code.trim()) {
      setErrors((prev) => ({ ...prev, code: '인증번호를 입력해주세요.' }));
      return;
    }
    if (!hasRequestedCode) {
      setErrors((prev) => ({ ...prev, code: '먼저 인증요청을 진행해주세요.' }));
      return;
    }

    setIsVerifying(true);
    setErrors((prev) => ({ ...prev, code: '' }));

    try {
      const res = await authApi.verifyCode({
        email,
        code,
        purpose: 'RESET_PASSWORD',
      });

      if (res.verified) {
        setVerifyStatus('success');
      } else {
        setVerifyStatus('fail');
        setErrors((prev) => ({
          ...prev,
          code: '인증번호가 올바르지 않습니다.',
        }));
      }
    } catch (e: any) {
      setVerifyStatus('fail');
      setErrors((prev) => ({ ...prev, code: handleApiError(e) }));
    } finally {
      setIsVerifying(false);
    }
  };

  // ✅ 제출 (API)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors = {
      email: '',
      code: '',
      password: '',
      passwordConfirm: '',
    };

    let hasError = false;

    if (!email.trim()) {
      newErrors.email = '이메일을 입력해주세요.';
      hasError = true;
    }

    if (!hasRequestedCode) {
      newErrors.code = '인증요청을 먼저 진행해주세요.';
      hasError = true;
    } else if (verifyStatus !== 'success') {
      newErrors.code = '인증번호를 확인해주세요.';
      hasError = true;
    }

    if (!password.trim() || !passwordConfirm.trim()) {
      newErrors.passwordConfirm = '비밀번호를 입력해주세요.';
      hasError = true;
    } else if (password !== passwordConfirm) {
      newErrors.passwordConfirm = '비밀번호가 일치하지 않습니다.';
      hasError = true;
    }

    setErrors(newErrors);
    if (hasError) return;

    setIsSubmitting(true);

    try {
      const res = await authApi.resetPassword({
        email,
        code,
        newPassword: password,
      });

      alert(res.message || '비밀번호가 재설정되었습니다.');
      navigate('/', { replace: true });
    } catch (e: any) {
      alert(handleApiError(e));
    } finally {
      setIsSubmitting(false);
    }
  };

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

  const isEmailButtonDisabled = isLoadingCode || !email.trim();
  const isVerifyButtonDisabled =
    isVerifying || !code.trim() || verifyStatus === 'success';

  return (
    <div className="auth-root">
      <div className="auth-wrapper">
        <div className="auth-logo-area">
          <img src={Logo} alt="Logo" className="auth-logo-img" />
        </div>

        <div className="reset-form-area">
          <form className="reset-form" onSubmit={handleSubmit}>
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

                    // 이메일 변경 시 인증 상태 초기화
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

              <p className="error-message">{errors.email}</p>
            </div>

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

              <p className="error-message">{errors.code}</p>
            </div>

            {/* 비밀번호 */}
            <div className="reset-row">
              <label className="reset-label">비밀번호 재설정</label>

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
                  placeholder="새 비밀번호 확인"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                />

                {!passwordError && isPasswordMatch && (
                  <span className="reset-check-icon">✔</span>
                )}
              </div>

              <p className="error-message">{errors.passwordConfirm}</p>
            </div>

            <div className="reset-submit-wrap">
              <button className="reset-submit-button" disabled={isSubmitting}>
                {isSubmitting ? '처리중...' : '완료'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PasswordResetPage;
