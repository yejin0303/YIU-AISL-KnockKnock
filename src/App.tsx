// src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './fonts/fonts.css';

import LoginPage from './pages/LoginPage/LoginPage';
import PasswordResetPage from './pages/PasswordResetPage/PasswordResetPage';
import SignupPage from './pages/SignupPage/SignupPage';
import Main from './pages/MainPage/Main';
import NotePage from './pages/NotePage/NotePage';
import QuizPage from './pages/QuizPage/QuizPage';
import MemorizePage from './pages/MemorizePage/Memorize.tsx';
import RecordPage from './pages/RecordPage/RecordPage';
import RecordSessionDetailPage from './pages/RecordPage/RecordSessionDetailPage';

function App() {
	return (
		<BrowserRouter>
			<Routes>
				{/* 로그인 (기본 페이지) */}
				<Route path="/" element={<LoginPage />} />

				{/* 메인 페이지 */}
				<Route path="/main" element={<Main />} />

				{/* 기능 페이지 */}
				<Route path="/note" element={<NotePage />} />
				<Route path="/memorize" element={<MemorizePage />} />
				<Route path="/quiz" element={<QuizPage />} />
				<Route path="/record" element={<RecordPage />} />
				<Route
					path="/record/session/:sessionId"
					element={<RecordSessionDetailPage />}
				/>

				{/* 결과 페이지 (추후 구현) */}
				<Route path="/result" element={<div>Result Page</div>} />

				{/* 인증 관련 */}
				<Route path="/reset-password" element={<PasswordResetPage />} />
				<Route path="/signup" element={<SignupPage />} />
			</Routes>
		</BrowserRouter>
	);
}

export default App;
