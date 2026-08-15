import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ResultsTable } from './ResultsTable';
import { BrowserRouter } from 'react-router-dom';
import { ShortlistProvider } from '@/lib/providers/ShortlistContext';
import { AuthProvider } from '@/lib/providers/AuthContext';

// Mock Firebase
vi.mock('@/lib/firebase', () => ({
  auth: {},
  db: {},
  functions: {}
}));
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn(() => vi.fn()),
  GoogleAuthProvider: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  onSnapshot: vi.fn(() => vi.fn()),
  serverTimestamp: vi.fn(),
}));

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <AuthProvider>
      <ShortlistProvider>
        {children}
      </ShortlistProvider>
    </AuthProvider>
  </BrowserRouter>
);

describe('ResultsTable', () => {
  const defaultProps = {
    data: [],
    isLoading: false,
    isError: false,
    onRetry: vi.fn(),
    onClearFilters: vi.fn(),
    sortField: 'rating' as const,
    sortDirection: 'desc' as const,
    onChangeSort: vi.fn(),
    reasoningData: {},
  };

  it('renders loading state correctly', () => {
    render(<ResultsTable {...defaultProps} isLoading={true} />, { wrapper: Wrapper });
    expect(screen.getByText('Loading results...')).toBeInTheDocument();
  });

  it('renders error state correctly', () => {
    render(<ResultsTable {...defaultProps} isError={true} />, { wrapper: Wrapper });
    expect(screen.getByText(/Failed to load/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
  });

  it('renders empty state correctly', () => {
    render(<ResultsTable {...defaultProps} data={[]} />, { wrapper: Wrapper });
    expect(screen.getByText(/No matches/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Clear all filters/i })).toBeInTheDocument();
  });

  it('renders results correctly', () => {
    const mockData = [{
      id: '1',
      name: 'Test Freelancer',
      role: 'Developer',
      skills: ['React'],
      rateMin: 50,
      rateMax: 100,
      currency: 'USD',
      rating: 4.5,
      reviewCount: 10,
      responseTimeMinutes: 30,
      availability: 'available',
      bio: 'Bio',
      portfolioUrl: 'url',
      avatarUrl: '',
      verified: true,
      reviews: []
    }];

    render(<ResultsTable {...defaultProps} data={mockData as any} />, { wrapper: Wrapper });
    expect(screen.getByText('Test Freelancer')).toBeInTheDocument();
    // Currency format test (Intl formatting produces non-breaking space depending on locale, we can match regex)
    expect(screen.getByText(/\$50/)).toBeInTheDocument();
  });
});
