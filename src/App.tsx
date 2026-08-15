import { Routes, Route } from 'react-router-dom'
import { SearchPage } from '@/features/search/SearchPage'
import { FreelancerDetail } from '@/features/shortlist/FreelancerDetail'

function App() {
  return (
    <div className="min-h-screen bg-bg text-text tabular-nums font-sans">
      {/* Top Bar */}
      <header className="w-full border-b border-border bg-bg sticky top-0 z-50">
        <div className="max-w-[1280px] mx-auto px-24 h-64 flex items-center justify-center">
          <span className="text-[20px] font-semibold text-text leading-[1.2]">Bench</span>
        </div>
      </header>

      <main className="pb-64">
        <Routes>
          <Route path="/" element={<SearchPage />} />
          <Route path="/freelancer/:id" element={<FreelancerDetail />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
