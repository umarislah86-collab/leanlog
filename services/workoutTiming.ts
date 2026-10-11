export function remainingRestSeconds(deadline: number | null, now = Date.now()): number {
  return deadline === null ? 0 : Math.max(0, Math.ceil((deadline - now) / 1000));
}

export function isTimedExercise(name: string): boolean {
  const normalized = name.toLowerCase();
  // Strength rows are repetitions; only explicit rowing cardio is timed.
  if (/\b(row|rows|rowing|rower|ergometer)\b/.test(normalized)) {
    return /\b(rowing machine|row machine|rower|ergometer|rowing cardio|cardio row|rowing erg)\b/.test(normalized);
  }
  return /\b(treadmill|cardio|plank|run|running|jog|jogging|walk|walking|cycle|cycling|bike|elliptical|skip|skipping|jump rope|farmer|hold|carry|lari|berjalan|basikal)\b/.test(normalized);
}
