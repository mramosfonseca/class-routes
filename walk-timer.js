// Helpers for timing a walk and comparing it with the predicted walk time.

function formatElapsed(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function compareWalk(predictedMinutes, actualSeconds) {
  const actualMinutes = Math.round(actualSeconds / 60);
  const difference = actualMinutes - predictedMinutes;
  const predicted = `the predicted ${predictedMinutes} min`;
  if (difference === 0) return `Took ${actualMinutes} min, right on ${predicted}.`;
  if (difference > 0) return `Took ${actualMinutes} min, ${difference} min longer than ${predicted}.`;
  return `Took ${actualMinutes} min, ${-difference} min faster than ${predicted}.`;
}
