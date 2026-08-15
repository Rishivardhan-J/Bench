import { Routes, Route, Link } from 'react-router-dom'
import { SearchPage } from '@/features/search/SearchPage'
import { FreelancerDetail } from '@/features/shortlist/FreelancerDetail'
import { ShortlistsPage } from '@/features/shortlist/ShortlistsPage'
import { SignInModal } from '@/components/ui/SignInModal'
import { Footer } from '@/components/layout/Footer'
import { PrivacyPage } from '@/pages/PrivacyPage'
import { TermsPage } from '@/pages/TermsPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { FreelancerLandingPage } from '@/features/freelancer/FreelancerLandingPage'
import { FreelancerProfilePage } from '@/features/freelancer/FreelancerProfilePage'
import { useAuth } from '@/lib/providers/AuthContext'
import { useState } from 'react'

function App() {
  const { currentUser, openSignInModal, signOut, isAuthLoading } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  return (
    <div className="min-h-screen bg-bg text-text tabular-nums font-sans relative flex flex-col">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-16 focus:left-16 focus:z-[100] focus:px-16 focus:py-8 focus:bg-surface-3 focus:text-text focus:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded-sm">
        Skip to main content
      </a>
      
      <SignInModal />
      
      {/* Top Bar */}
      <header className="w-full border-b border-border bg-bg sticky top-0 z-50">
        <div className="max-w-[1280px] mx-auto px-24 h-64 flex items-center justify-between">
          <Link to="/" className="text-[20px] font-semibold text-text leading-[1.2] focus:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded-sm">Bench</Link>
          
          <div className="flex items-center">
            {!isAuthLoading && (
              currentUser ? (
                <div className="relative">
                  <button 
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    aria-label="Account menu"
                    aria-expanded={isDropdownOpen}
                    className="w-32 h-32 rounded-full bg-surface-3 flex items-center justify-center text-meta font-medium text-text border border-border focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                  >
                    {currentUser.email ? currentUser.email.charAt(0).toUpperCase() : 'U'}
                  </button>
                  
                  {isDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-[60]" onClick={() => setIsDropdownOpen(false)}></div>
                      <div className="absolute right-0 top-full mt-8 w-[160px] bg-surface border border-border rounded-md shadow-sm z-[70] py-4 flex flex-col">
                        <Link 
                          to="/shortlists" 
                          onClick={() => setIsDropdownOpen(false)}
                          className="px-16 py-8 text-body text-text hover:bg-surface-2 transition-colors text-left focus:outline-none focus-visible:bg-surface-2"
                        >
                          Shortlists
                        </Link>
                        <button 
                          onClick={() => { signOut(); setIsDropdownOpen(false); }}
                          className="px-16 py-8 text-body text-text-dim hover:text-text hover:bg-surface-2 transition-colors text-left focus:outline-none focus-visible:bg-surface-2"
                        >
                          Sign out
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <button 
                  onClick={() => openSignInModal()}
                  className="text-body font-medium text-text-dim hover:text-text focus:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded-sm transition-colors"
                >
                  Sign in
                </button>
              )
            )}
          </div>
        </div>
      </header>

      <main id="main-content" className="pb-64 flex-1" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<SearchPage />} />
          <Route path="/freelancer/:id" element={<FreelancerDetail />} />
          <Route path="/shortlists" element={<ShortlistsPage />} />
          <Route path="/for-freelancers" element={<FreelancerLandingPage />} />
          <Route path="/freelancer-profile" element={<FreelancerProfilePage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>

      <Footer />
    </div>
  )
}

export default App
