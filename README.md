# Techno Vibe: AI-Powered Adaptive DJ Controller

**Techno Vibe** is a real-time computer vision application that transforms a room's physical energy into a dynamic music experience. Using a combination of high-speed heuristic tracking and deep AI analysis, the system observes people in a scene and automatically selects the perfect soundtrack to match the "vibe."

---

## 🚀 Key Features

- **Dual-Layer Vision Analysis**: 
  - **MediaPipe**: Handles ultra-low latency person detection and motion tracking (60fps).
  - **Gemini 1.5 Flash**: Performs "Deep Vibe Checks" every 10 seconds to analyze interaction density and calibrate the overall energy level.
- **Adaptive Music Engine**: Automatically transitions between 5 preloaded energy levels (Ambient to Peak) based on real-time activity scores.
- **Real-Time Dashboard**: Visual feedback showing motion intensity, people count, and AI confidence levels.
- **Adaptive Mode (Auto-DJ)**: A hands-free experience where the AI takes full control of the track selection based on the crowd's movement.
- **Privacy-First Design**: The system analyzes physical signals (movement, speed, count) without using facial recognition or identifying individuals.

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS (Dark Mode / Industrial Aesthetic)
- **Animations**: Framer Motion
- **Vision**: MediaPipe Tasks (Object Detection)
- **AI**: Google Gemini 1.5 Flash (Vision-to-JSON)
- **Backend**: Express.js (Static Asset Serving)
- **Icons**: Lucide React

## 📂 Project Structure

- `/src/App.tsx`: The main controller handling the webcam feed, MediaPipe tracking, and UI state.
- `/src/services/geminiService.ts`: Integration with the Gemini API for high-level scene analysis.
- `/music/`: Directory containing the adaptive audio tracks (.mp3/.wav).
- `/server.ts`: Express server configured to serve the application and static music assets.

---

## 🚦 Getting Started

1. **Configure API Key**: Add your `GEMINI_API_KEY` to your environment variables.
2. **Install Dependencies**: `npm install`
3. **Run Development Server**: `npm run dev`
4. **Initialize**: Open the app, grant webcam permissions, and click "Initialize System."

---

*Built with ❤️ using Google AI Studio Build.*
<!-- chore: note 2026-06-18T12:31:04 -->
