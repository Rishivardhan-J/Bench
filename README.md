# Bench

Bench is an intelligent, high-performance web application designed to streamline the freelancer discovery process. By leveraging AI-assisted search and structured matching, Bench transforms conversational project briefs into precise candidate shortlists, minimizing manual filtering and accelerating the hiring workflow.

## Overview

The application is built with a focus on rigorous design aesthetics, responsive data grids, and strict adherence to modern frontend engineering standards. It currently implements a fully interactive static UI integrated with a local TanStack Query architecture and Firebase backend services.

Key features include:
- **AI Brief Extraction:** Automatically parses natural language project briefs into structured filtering criteria (skills, budget bands, and timeline) via the Google Gemini API.
- **Intelligent Shortlisting:** Generates concise, one-sentence relevance reasoning for candidates directly against the user's brief.
- **Dynamic Filtering & Sorting:** A robust, debounced filtering rail and in-memory sorting mechanisms for Relevance, Rate, Rating, and Response Time.
- **Review Summarization:** Condenses raw freelancer reviews into high-level sentiment summaries for quick evaluation.
- **Strict Design System:** Built using Tailwind CSS, enforcing a rigorous 4px spacing multiple scale and constrained typography tokens.

## Technology Stack

- **Framework:** React 18 with Vite
- **Language:** TypeScript (Strict Mode)
- **Styling:** Tailwind CSS v3 (Custom Theme Extension)
- **State Management:** TanStack Query (React Query) & React Context
- **Routing:** React Router v6
- **Backend Services:** Firebase (Firestore, Functions, Auth)
- **AI Integration:** Google Gemini API (`gemini-1.5-flash`) via Firebase Callable Functions

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

For local development, the application relies on the Firebase Emulator Suite. Ensure your `functions/index.js` contains a valid `GEMINI_API_KEY` in the environment if you intend to test the AI capabilities.

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

## Architecture & Design Constraints

This project adheres strictly to the defined UI specifications:
- **Zero Arbitrary Values:** All spacing, typography, and radii rely exclusively on the extended Tailwind configuration.
- **Monochrome Dominance:** The accent blue is restricted to highly intentional interactive states, such as verified badges, selected filters, and focus rings.
- **Progressive Layouts:** The filter rail collapses into a toggleable drawer on smaller screens, and the results table gracefully drops secondary columns to maintain legibility.
- **Security:** API keys and direct interactions with the generative AI models are restricted entirely to the Firebase Functions backend, ensuring zero leakage into the client bundle.

## License

All rights reserved.
