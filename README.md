# LORD AI — Autonomous Intelligence Layer

LORD is an advanced, autonomous AI application designed to function as the central intelligence layer of your platform. It features real-time monitoring, persistent chat history, and voice-activated assistance.

## 🚀 Key Features

- **Autonomous AI Mission**: LORD is programmed to manage, monitor, and optimize the entire application.
- **Persistent Chat History**: Conversations are saved and restored using SQLite and Drizzle ORM.
- **Real-Time Monitoring**: Integrated health tracking with the `HealthHud` component, monitoring API, DB, and Auth status.
- **Voice Interface**: Wake-word activation ("Hey Lord") with text-to-speech and speech-to-text capabilities.
- **Application Awareness**: LORD understands current route, metrics, and history to provide contextual assistance.

## 🛠 Tech Stack

- **Frontend**: Vite + React + Tailwind CSS
- **Routing**: TanStack Router
- **State Management**: TanStack Start + Context API
- **AI Integration**: AI SDK (OpenRouter)
- **Database**: SQLite + Drizzle ORM
- **Voice**: OpenWakeWord + Web Speech API

## 📦 Getting Started

### Prerequisites

- Node.js (v18+)
- npm or pnpm

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/nagasatwik145/lord-ai.git
   cd lord-ai
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Configure environment variables:
   Create a `.env` file in the root directory:

   ```env
   OPENROUTER_API_KEY=your_api_key
   ```

4. Setup the database:

   ```bash
   npx drizzle-kit push
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

## 📂 Project Structure

- `src/components/lord`: Core LORD UI components (AppShell, HealthHud, ChatSidebar).
- `src/lib/db`: Database schema and queries.
- `src/lib/monitoring-service.ts`: Global application health monitoring.
- `src/routes/api/chat.ts`: Intelligent chat backend with persistence.
- `src/routes/chat.tsx`: Main chat interface with history management.

## 📜 License

MIT
