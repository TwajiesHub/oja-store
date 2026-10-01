import { Route, Routes } from 'react-router-dom'

import Home from './pages/Home.jsx'

export default function App() {
  // Real routes arrive milestone by milestone; until then every path shows the placeholder.
  return (
    <Routes>
      <Route path="*" element={<Home />} />
    </Routes>
  )
}
