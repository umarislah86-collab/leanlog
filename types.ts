export type MealCategory = 'sarapan' | 'tengahari' | 'malam' | 'snek';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active';

export interface FoodItem {
  nama: string;
  kalori: number;
  protein: number;
  karbohidrat: number;
  lemak: number;
}

export interface FoodEntry {
  type: 'food';
  id: string;
  name: string;
  calories: number;
  imageUri?: string;
  time: string;
  date: string;
  items: FoodItem[];
  category: MealCategory;
}

export interface ActivityEntry {
  type: 'activity';
  id: string;
  name: string;
  duration: number;
  caloriesBurned: number;
  time: string;
  date: string;
}

export interface UserProfile {
  weight: number;
  height: number;
  age: number;
  gender: 'lelaki' | 'perempuan';
  activityLevel: ActivityLevel;
}

export interface WeightEntry {
  id: string;
  weight: number;
  date: string;
  note?: string;
}

export type GymGoal = 'kurus' | 'maintain' | 'muscle';
export type FitnessLevel = 'beginner' | 'intermediate' | 'advanced';

export interface GymSetup {
  goal: GymGoal;
  level: FitnessLevel;
  equipment: string[];
}

export interface ExerciseSet {
  reps: number;
  weight: number;
  done: boolean;
  warmup?: boolean;
  rpe?: number;
}

export interface WorkoutExercise {
  name: string;
  sets: ExerciseSet[];
  restSeconds: number;
}

export interface WorkoutDay {
  label: string;
  exercises: WorkoutExercise[];
}

export interface WorkoutPlan {
  id: string;
  createdAt: string;
  goal: GymGoal;
  level: FitnessLevel;
  equipment: string[];
  days: WorkoutDay[];
}

export interface GymSession {
  id: string;
  date: string;
  time: string;
  planDayLabel: string;
  exercises: { name: string; sets: ExerciseSet[]; notes?: string }[];
  durationMin: number;
  activityEntryId?: string;
  startedAt?: string;
  endedAt?: string;
  source?: 'coach' | 'health-merged';
  caloriesBurned?: number;
  readiness?: { energy: number; soreness: number; sleepMinutes: number };
  notes?: string;
}
