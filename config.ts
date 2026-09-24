// Expo replaces EXPO_PUBLIC_* values at build time. Keep real API keys out of Git.
export const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';
