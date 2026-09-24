const { GoogleGenAI } = require('@google/genai');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');

initializeApp();

const geminiApiKey = defineSecret('GEMINI_API_KEY');
const ALLOWED_PURPOSES = new Set([
  'food_image', 'activity_image', 'food_text', 'activity_estimate',
  'workout_plan', 'gym_calories', 'weekly_review', 'progress_review',
]);
const DAILY_LIMIT = 100;

const validateInput = (input) => {
  if (typeof input === 'string') {
    if (!input.trim() || input.length > 12000) throw new HttpsError('invalid-argument', 'Invalid AI text input.');
    return;
  }
  if (!Array.isArray(input) || input.length < 1 || input.length > 4) {
    throw new HttpsError('invalid-argument', 'Invalid AI input.');
  }
  let totalSize = 0;
  for (const part of input) {
    if (!part || !['text', 'image'].includes(part.type)) throw new HttpsError('invalid-argument', 'Invalid AI input part.');
    if (part.type === 'text') {
      if (typeof part.text !== 'string' || part.text.length > 12000) throw new HttpsError('invalid-argument', 'AI text is too large.');
      totalSize += part.text.length;
    } else {
      if (part.mime_type !== 'image/jpeg' || typeof part.data !== 'string') throw new HttpsError('invalid-argument', 'Invalid image input.');
      totalSize += part.data.length;
    }
  }
  if (totalSize > 8_000_000) throw new HttpsError('invalid-argument', 'AI request is too large.');
};

const consumeQuota = async (uid) => {
  const day = new Date().toISOString().slice(0, 10);
  const ref = getFirestore().collection('aiUsage').doc(`${uid}_${day}`);
  await getFirestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const count = snap.exists ? Number(snap.data().count || 0) : 0;
    if (count >= DAILY_LIMIT) throw new HttpsError('resource-exhausted', 'Daily AI limit reached. Try again tomorrow.');
    tx.set(ref, { uid, day, count: count + 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
};

exports.leanLogAi = onCall({
  region: 'asia-southeast1',
  secrets: [geminiApiKey],
  timeoutSeconds: 120,
  memory: '512MiB',
  cors: true,
}, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Please sign in to use LeanLog AI.');
  const { purpose, input } = request.data || {};
  if (!ALLOWED_PURPOSES.has(purpose)) throw new HttpsError('invalid-argument', 'Unsupported AI operation.');
  validateInput(input);
  await consumeQuota(request.auth.uid);

  try {
    const ai = new GoogleGenAI({ apiKey: geminiApiKey.value() });
    const response = await ai.interactions.create({ model: 'gemini-3.6-flash', input });
    const text = (response.output_text || '').trim();
    if (!text) throw new Error('Empty AI response');
    return { text };
  } catch (error) {
    console.error('LeanLog AI failed', { purpose, uid: request.auth.uid, message: error?.message });
    throw new HttpsError('internal', 'LeanLog AI could not complete this request.');
  }
});
