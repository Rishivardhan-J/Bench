import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ShortlistProvider } from '@/lib/providers/ShortlistContext'
import './index.css'
import './styles/fonts.css'
import App from './App.tsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ShortlistProvider>
          <App />
        </ShortlistProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
