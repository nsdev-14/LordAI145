# LORD AI — Autonomous Intelligence Layer

LORD is an advanced, autonomous AI application designed to function as the central intelligence layer of your platform. It features real-time monitoring, persistent chat history, and voice-activated assistance.

## 🚀 Key Features

- **Autonomous AI Mission**: LORD is programmed to manage, monitor, and optimize the entire application.
- **Persistent Chat History**: Conversations are saved locally for a fast, private single-operator experience.
- **Real-Time Monitoring**: Integrated health tracking with the `HealthHud` component, monitoring API, DB, and Auth status.
- **Voice Interface**: Wake-word activation ("Hey Lord") with text-to-speech and speech-to-text capabilities.
- **Application Awareness**: LORD understands current route, metrics, and history to provide contextual assistance.

## 🛠 Tech Stack

- **Frontend**: Vite + React + Tailwind CSS
- **Routing**: TanStack Router
- **State Management**: TanStack Start + Context API
- **AI Integration**: AI SDK through Lovable AI
- **Backend**: Lovable Cloud for managed services; browser storage for personal workspace data
- **Voice**: OpenWakeWord + Web Speech API

## 📦 Getting Started

### Prerequisites

- Bun 1.3+

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/nagasatwik145/lord-ai.git
   cd lord-ai
   ```

2. Install dependencies:

   ```bash
   bun install
   ```

3. Start the development server:
   ```bash
   bun run dev
   ```

Lovable AI and Lovable Cloud credentials are provisioned securely by the platform; do not add private API keys to source files.

## 📂 Project Structure

- `src/components/lord`: Core LORD UI components (AppShell, HealthHud, ChatSidebar).
- `src/lib/monitoring-service.ts`: Global application health monitoring.
- `src/routes/api/chat.ts`: Validated streaming AI backend.
- `src/routes/chat.tsx`: Main chat interface with history management.

## 📜 License

MIT
