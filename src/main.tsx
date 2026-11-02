import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import * as Sentry from '@sentry/react'
import { AuthProvider } from '@/lib/providers/AuthContext'
import { ShortlistProvider } from '@/lib/providers/ShortlistContext'
import { ToastProvider } from '@/components/ui/Toast'
import './styles/fonts.css'
import './index.css'
import App from './App.tsx'

// Error tracking only starts when a DSN is configured.
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.2,
    sendDefaultPii: false,
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <ShortlistProvider>
              <App />
            </ShortlistProvider>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
