import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../firebase';

export type AiPurpose =
  | 'food_image' | 'activity_image' | 'food_text' | 'activity_estimate'
  | 'workout_plan' | 'gym_calories' | 'weekly_review' | 'progress_review';

type AiInput = string | Array<
  | { type: 'text'; text: string }
  | { type: 'image'; mime_type: 'image/jpeg'; data: string }
>;

const functions = getFunctions(app, 'asia-southeast1');
const leanLogAi = httpsCallable<{ purpose: AiPurpose; input: AiInput }, { text: string }>(functions, 'leanLogAi');

export const runLeanLogAi = async (purpose: AiPurpose, input: AiInput): Promise<string> => {
  const result = await leanLogAi({ purpose, input });
  if (!result.data?.text) throw new Error('LeanLog AI returned an empty response.');
  return result.data.text;
};
