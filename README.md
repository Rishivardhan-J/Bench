# Bench

Bench is an intelligent, high-performance web application designed to streamline the freelancer discovery process. By leveraging AI-assisted search and structured matching, Bench transforms conversational project briefs into precise candidate shortlists, minimizing manual filtering and accelerating the hiring workflow.

## Overview

The application is built with a focus on rigorous design aesthetics, responsive data grids, and strict adherence to modern frontend engineering standards. It implements a fully interactive static UI integrated with a local TanStack Query architecture, robust testing suites, and hardened Firebase backend services.

Key features include:
- **AI Brief Extraction:** Automatically parses natural language project briefs into structured filtering criteria (skills, budget bands, and timeline) via the Google Gemini API.
- **Intelligent Shortlisting:** Generates concise, one-sentence relevance reasoning for candidates directly against the user's brief.
- **Dynamic Filtering & Sorting:** A robust, debounced filtering rail and in-memory sorting mechanisms for Relevance, Rate, Rating, and Response Time.
- **Production-Ready Security:** Protected by Firebase App Check (ReCaptcha V3), robust backend rate limiting (Firestore-backed transactions), and strict PII-scrubbing before logging.
- **Error Monitoring:** Comprehensive error tracking via Sentry, capturing frontend exceptions and backend failures.
- **Automated Testing:** Covered by a full testing suite including unit/component tests via Vitest & React Testing Library, and End-to-End smoke tests via Playwright.

## Technology Stack

- **Framework:** React 18 with Vite
- **Language:** TypeScript (Strict Mode)
- **Styling:** Tailwind CSS v3 (Custom Theme Extension)
- **State Management:** TanStack Query (React Query) & React Context
- **Routing:** React Router v6
- **Backend Services:** Firebase (Firestore, Functions, Auth, App Check)
- **AI Integration:** Google Gemini API (`gemini-1.5-flash`) via Firebase Callable Functions
- **Testing:** Vitest, React Testing Library, Playwright E2E
- **Monitoring:** Sentry

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- Firebase CLI (`npm install -g firebase-tools`)

### Installation

1. Clone the repository and navigate into the project directory.
2. Install the client dependencies:
   ```bash
   npm install
   ```
3. Navigate to the functions directory and install backend dependencies:
   ```bash
   cd functions
   npm install
   ```
4. Return to the project root:
   ```bash
   cd ..
   ```

### Configuration

Copy the example environment variables file and configure your settings:

```bash
cp .env.example .env.local
```

For local development, the application relies on the Firebase Emulator Suite. Ensure your `functions/.env` contains a valid `GEMINI_API_KEY` to test the AI capabilities.

### Running Locally

To run the application locally, you will need two terminal sessions.

**Terminal 1: Start the Firebase Emulators**
```bash
cd functions
npm run serve
```
*Alternatively, you can run `firebase emulators:start` from the project root.*

**Terminal 2: Start the Vite Development Server**
```bash
npm run dev
```

The application will be available at `http://localhost:5173`.

### Testing

**Unit & Component Tests (Vitest)**
```bash
npm run test
```

**End-to-End Tests (Playwright)**
```bash
npx playwright test
```

## Architecture & Design Constraints

This project adheres strictly to the defined UI specifications:
- **Zero Arbitrary Values:** All spacing, typography, and radii rely exclusively on the extended Tailwind configuration.
- **Monochrome Dominance:** The accent blue is restricted to highly intentional interactive states, such as verified badges, selected filters, and focus rings.
- **Accessibility (A11y):** Implements dynamic `aria-live` regions, structured focus traps for modals, skip-to-main links, and strictly formatted ARIA tags.
- **Security & Integrity:** API keys and direct interactions with the generative AI models are restricted entirely to the Firebase Functions backend, ensuring zero leakage into the client bundle. All callable functions are shielded by App Check and strict rate limiters.

## License

All rights reserved.
