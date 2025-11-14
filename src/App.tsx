import { BrowserRouter, Routes, Route } from 'react-router-dom'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<div>Login Page</div>} />
        <Route path="/main" element={<div>Main Page</div>} />
        <Route path="/note" element={<div>Note Page</div>} />
        <Route path="/memorize" element={<div>Memorize Page</div>} />
        <Route path="/quiz" element={<div>Quiz Page</div>} />
        <Route path="/result" element={<div>Result Page</div>} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
