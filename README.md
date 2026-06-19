# ⚡ ClassPulse

ClassPulse is an ultra-premium, high-fidelity, mobile-first SaaS dashboard designed for smart attendance tracking and shared academic schedule synchronization. Rebranded with a state-of-the-art dual-theme color system and full Progressive Web App (PWA) integration, ClassPulse allows students and educators to manage timetables and monitor attendance metrics through a clean, glassmorphic workspace.

---

## 🎨 Design Language & Theme Identity

ClassPulse is engineered with a dynamic, CSS variable-driven theme engine that automatically adapts all typography, button gradients, charts, and glow effects to user preferences:

*   **☀️ Light Theme (Beige & Dark Grey)**:
    *   **Background**: Soothing Warm Beige (`#DDD0C8`)
    *   **Typography & Core Accents**: Sleek Dark Grey Charcoal (`#323232`)
*   **🌙 Dark Theme (Classic Obsidian Blue, Turquoise & Gold)**:
    *   **Background**: Deep Classic Obsidian Blue (`#0A1828`)
    *   **Accents & Glows**: Electric Turquoise (`#178582`)
    *   **Highlights**: Premium Gold Accent (`#BFA181`)

Every color value across the application is imported dynamically from variables defined in `src/index.css` root, ensuring zero hardcoded inline hex values in the markup.

---

## ✨ Features

- **📱 Progressive Web App (PWA)**: Downloadable on iOS and Android devices directly from your web browser, equipped with offline service worker caching and home-screen shortcut badges.
- **📊 Glassmorphic Dashboard Overview**:
  - **Dynamic Gauge**: Custom SVG circular rings representing overall attendance with transition stroke animations.
  - **30-Day Activity Heatmap**: Visual calendar-grid rendering color intensities based on attendance frequency.
  - **Smart Notification Flags**: Auto-prompts to quick-mark attendance for classes that recently ended.
- **🗓️ Subjects & Timetable Hub**:
  - **Split Layout Design**: Grid of subjects on the left; compact, real-time shared timetables on the right.
  - **Shared Timetables**: Build public/private schedules and sync changes in real-time. Students can join instantly using a unique 6-character access token.
- **📜 Chronological Logs**: Full audit logs of all registered attendance markings with support for quick edits and deletions.
- **🔐 Secure Firebase Auth**: Powered by Google Auth and standard Email/Password verification, validated against custom Firebase access control rules.

---

## 🛠️ Technology Stack

- **Framework**: React (v19) + Vite (v7) + React Router DOM (v7)
- **Styling**: Bootstrap (v5), Custom CSS Glassmorphism
- **Database & Identity**: Firebase Firestore, Firebase Authentication
- **Service Workers**: Vite PWA Plugin
- **Charts**: ChartJS + React Chartjs 2

---

## 🚀 Getting Started

Follow these steps to set up the project locally on your machine.

### Prerequisites
- **Node.js** (v18+ recommended)
- A **Firebase Project** with Firestore and Google Sign-in enabled.

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/kartikeya7609/attendance-tracker.git
   cd attendance-tracker
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the root directory and copy the format from `.env.example`:
   ```bash
   cp .env.example .env
   ```
   Populate it with your Firebase Web App credentials:
   ```env
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
   ```

### Development Execution

To start the local development server:
```bash
npm run dev
```
Open your browser and navigate to `http://localhost:5173`.

### Production Compiles

To compile and optimize the web application for production:
```bash
npm run build
```
The optimized bundle along with the generated PWA service worker files will compile to the `dist/` directory.

---

## 📁 Directory Structure

```text
├── eslint.config.js       # ESLint configuration rules
├── firestore.rules        # Security rules for Firestore database
├── index.html             # Main entry point HTML file
├── package.json           # Project manifest and web dependencies
├── src/
│   ├── App.css            # Global application overrides
│   ├── App.jsx            # Routing and core application skeleton
│   ├── index.css          # Core design tokens, global themes & glassmorphism utilities
│   ├── main.jsx           # Application mounting and bootstrap
│   ├── assets/            # Brand SVGs and static image resources
│   ├── components/        # Shared components (Modals, Custom Navigation, Private Router)
│   ├── contexts/          # React Contexts for global state (Auth, Theme)
│   ├── pages/             # Page views (Dashboard, History, Login, Subjects, Timetables)
│   └── services/          # Services for Firebase config and Firestore queries
├── vercel.json            # Vercel routing rewrites for React Router
└── vite.config.js         # Vite configuration with PWA plugin setup
```
