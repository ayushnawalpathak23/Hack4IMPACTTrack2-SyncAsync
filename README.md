<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/e8ecc9a5-f514-4247-ae6f-e5f5f57c1fa5

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set `MONGODB_URI` and `SESSION_SECRET` in `.env` for Passport local login/signup sessions.
3. Set `GROQ_API_KEY` in `.env` for AI report simplification and chat.
4. Optional: set `GOOGLE_CLOUD_API_KEY` for translation (`/api/translate`) and text-to-speech (`/api/tts`).
5. Run the app:
   `npm run dev`
