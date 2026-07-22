// src/pages/MainPage/Main.tsx
import { useEffect, useMemo, useState } from 'react';
import './Main.css';
import { useNavigate } from 'react-router-dom';

// 로고
import LogoImage from '/src/png/Logo.png';

// 회원탈퇴 모달
import DeleteAccountModal from '../../components/DeleteAccountModal/DeleteAccountModal';

// 노트 데이터 훅 (fallback 용)
import { useNoteData } from '../../hooks/useNoteData';

// ✅ API
import { notesApi } from '../../services/api/notesApi';
import { authApi, handleApiError } from '../../services/api/authApi';

function Main() {
  const navigate = useNavigate();

  // fallback용 노트
  const { notes } = useNoteData();

  // ✅ 사용자 이름: localStorage에서 가져오기
  const userName = localStorage.getItem('userName') || '사용자';

  // 드롭다운 열림/닫힘
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // 회원탈퇴 모달
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // ✅ 최근 노트 2개 (서버에서 가져온 값)
  const [recentNotes, setRecentNotes] = useState<
    { id: string; name: string }[]
  >([]);
  const [isLoadingRecent, setIsLoadingRecent] = useState(false);

  // id에서 타임스탬프 추출 (구버전 호환)
  function extractTimestampFromId(id: string): number | null {
    const match = id.match(/note-(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  // ✅ 서버 recent가 비어있을 때 fallback(훅 notes로 최근 2개)
  const fallbackRecentNotes = useMemo(() => {
    return [...notes]
      .sort((a, b) => {
        const timeA = a.updatedAt ?? extractTimestampFromId(a.id) ?? 0;
        const timeB = b.updatedAt ?? extractTimestampFromId(b.id) ?? 0;
        return timeB - timeA;
      })
      .slice(0, 2)
      .map((n) => ({ id: n.id, name: n.name }));
  }, [notes]);

  // ✅ 최근노트 API 호출
  useEffect(() => {
    let mounted = true;

    const fetchRecent = async () => {
      setIsLoadingRecent(true);
      try {
        const data = await notesApi.getRecentNotes(); // /notes/recent
        if (!mounted) return;

        // 서버에서 온 최근 노트
        const mapped = data
          .slice(0, 2)
          .map((n) => ({ id: n.id, name: n.name }));
        setRecentNotes(mapped);
      } catch (e) {
        // 에러 나면 fallback로 보여주게 recentNotes를 비워둠
        console.error('[Main] getRecentNotes failed:', e);
        if (!mounted) return;
        setRecentNotes([]);
      } finally {
        if (mounted) setIsLoadingRecent(false);
      }
    };

    fetchRecent();
    return () => {
      mounted = false;
    };
  }, []);

  // ✅ 화면에 보여줄 최근 노트: 서버값 우선, 없으면 fallback
  const visibleRecentNotes =
    recentNotes.length > 0 ? recentNotes : fallbackRecentNotes;

  // ✅ 로그아웃
  const handleLogout = () => {
    setIsMenuOpen(false);

    // 저장된 로그인 정보 삭제
    localStorage.removeItem('userName');
    localStorage.removeItem('token');

    navigate('/', { replace: true });
  };

  // ✅ 회원탈퇴 (서버 + 프론트 정리)
  const handleDeleteAccount = async () => {
    try {
      await authApi.deleteUser(); // DELETE /auth/user (세션 기반이면 쿠키 같이 감)

      // 프론트 저장값 정리
      localStorage.removeItem('userName');
      localStorage.removeItem('token');

      alert('회원탈퇴가 처리되었습니다.');
      navigate('/', { replace: true });
    } catch (e) {
      alert(handleApiError(e));
    }
  };

  return (
    <>
      <DeleteAccountModal
        isOpen={isDeleteModalOpen}
        onCancel={() => setIsDeleteModalOpen(false)}
        onConfirm={async () => {
          setIsDeleteModalOpen(false);
          await handleDeleteAccount();
        }}
      />

      <div className="main-zoom-wrapper">
        <div className="main-container">
          {/* 왼쪽 패널 */}
          <section className="left-panel">
            <img src={LogoImage} alt="logo" className="logo-img" />

            {/* 유저 드롭다운 */}
            <div
              className="user-dropdown"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <span className="user-name-text">{userName}님 !</span>
              <span className="user-hello-text">안녕하세요</span>
              <img
                src="/assets/icons/dropdown-icon.png"
                alt="open menu"
                className="dropdown-icon"
              />
            </div>

            {/* 드롭다운 메뉴 */}
            {isMenuOpen && (
              <ul className="menu-list">
                <li className="menu-item" onClick={handleLogout}>
                  <img
                    src="/assets/icons/logout-icon.png"
                    className="menu-icon"
                    alt="logout"
                  />
                  로그아웃
                </li>

                <li
                  className="menu-item"
                  onClick={() => {
                    setIsMenuOpen(false);
                    navigate('/reset-password');
                  }}
                >
                  <img
                    src="/assets/icons/resetpw-icon.png"
                    className="menu-icon"
                    alt="reset pw"
                  />
                  비밀번호 재설정
                </li>

                <li
                  className="menu-item"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsDeleteModalOpen(true);
                  }}
                >
                  <img
                    src="/assets/icons/delete-icon.png"
                    className="menu-icon"
                    alt="delete user"
                  />
                  회원 탈퇴
                </li>
              </ul>
            )}
          </section>

          {/* 오른쪽 카드 4개 */}
          <section className="right-panel">
            {/* 1) Write a notebook */}
            <article
              className="card"
              onClick={() => navigate('/note')}
              style={{ cursor: 'pointer' }}
            >
              <div className="card-header">
                <div className="card-icon-box">
                  <img
                    src="/assets/icons/Rectangle-icon.png"
                    className="card-icon-bg"
                    alt=""
                  />
                  <img
                    src="/assets/icons/write-icon.png"
                    alt="Write a notebook"
                    className="card-icon"
                  />
                </div>
                <h3 className="card-title">Write a notebook</h3>
              </div>

              <p className="card-subtitle">최근 노트</p>

              {isLoadingRecent ? (
                <p className="card-desc">- 불러오는 중...</p>
              ) : visibleRecentNotes.length > 0 ? (
                visibleRecentNotes.map((note) => (
                  <p key={note.id} className="card-desc">
                    - {note.name}
                  </p>
                ))
              ) : (
                <p className="card-desc">- 노트가 없습니다</p>
              )}

              <button
                className="more-button"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate('/note');
                }}
              >
                <span>add more</span>
                <img
                  src="/assets/icons/arrow_forward-icon.png"
                  className="more-button-icon"
                  alt="more"
                />
              </button>
            </article>

            {/* 2) Memorization typing */}
            <article
              className="card"
              onClick={() => navigate('/memorize')}
              style={{ cursor: 'pointer' }}
            >
              <div className="card-header">
                <div className="card-icon-box">
                  <img
                    src="/assets/icons/Rectangle-icon.png"
                    className="card-icon-bg"
                    alt=""
                  />
                  <img
                    src="/assets/icons/memorization-icon.png"
                    alt="memorization typing"
                    className="card-icon"
                  />
                </div>
                <h3 className="card-title">Memorization typing</h3>
              </div>

              <p className="card-subtitle">타자 암기 모드</p>

              <p className="card-desc">
                자신이 정리한 노트나 파일을 업로드 해
                <br />
                typing을 하며 암기하세요!
              </p>
              <p className="card-desc">
                손으로 필기하며 하는 암기보다 훨씬
                <br />
                효율적인 경험일거에요!
              </p>

              <button className="more-button">
                <span>add more</span>
                <img
                  src="/assets/icons/arrow_forward-icon.png"
                  className="more-button-icon"
                  alt="more"
                />
              </button>
            </article>

            {/* 3) Quiz */}
            <article
              className="card"
              onClick={() => navigate('/quiz')}
              style={{ cursor: 'pointer' }}
            >
              <div className="card-header">
                <div className="card-icon-box">
                  <img
                    src="/assets/icons/Rectangle-icon.png"
                    className="card-icon-bg"
                    alt=""
                  />
                  <img
                    src="/assets/icons/quiz-icon.png"
                    alt="Quiz"
                    className="card-icon"
                  />
                </div>
                <h3 className="card-title">Quiz</h3>
              </div>

              <p className="card-subtitle">퀴즈 모드</p>

              <p className="card-desc">공부한 내용, 이제 퀴즈로 확인해봐요!</p>
              <p className="card-desc">
                내가 표시한 키워드가 문제로 나오고,
                <br />
                틀린 건 자동으로 기록돼서 복습까지 완벽해요!
              </p>

              <button className="more-button" onClick={() => navigate('/quiz')}>
                <span>add more</span>
                <img
                  src="/assets/icons/arrow_forward-icon.png"
                  className="more-button-icon"
                  alt="more"
                />
              </button>
            </article>

            {/* 4) Record */}
            <article
              className="card"
              onClick={() => navigate('/record')}
              style={{ cursor: 'pointer' }}
            >
              <div className="card-header">
                <div className="card-icon-box">
                  <img
                    src="/assets/icons/Rectangle-icon.png"
                    className="card-icon-bg"
                    alt=""
                  />
                  <img
                    src="/assets/icons/record-icon.png"
                    alt="Record"
                    className="card-icon"
                  />
                </div>
                <h3 className="card-title">Record</h3>
              </div>

              <p className="card-subtitle">학습 기록</p>
              <p className="card-desc">- 카테고리별 정답률</p>
              <p className="card-desc">- 내 퀴즈 히스토리</p>

              <button className="more-button">
                <span>add more</span>
                <img
                  src="/assets/icons/arrow_forward-icon.png"
                  className="more-button-icon"
                  alt="more"
                />
              </button>
            </article>
          </section>
        </div>
      </div>
    </>
  );
}

export default Main;
