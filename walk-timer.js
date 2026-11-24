// Helpers for timing a walk and comparing it with the predicted walk time.

function formatElapsed(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

// ---- Location (GPS) during a walk ----

// You count as arrived once you're this close to the next class's building.
// Phone locations are often off by 5–20 m and the app's building locations are
// approximate, so this is generous.
const ARRIVAL_RADIUS_METERS = 50;
// How many readings in a row must be inside that radius, so one jumpy reading
// can't stop the timer early.
const ARRIVAL_READINGS_NEEDED = 2;
// Moves smaller than this are treated as the location jittering, not walking.
const MIN_STEP_METERS = 10;

// Takes the arrival state and the latest distance to the building, and returns
// the new state: how many readings in a row were close, and whether you've arrived.
function arrivalStep(state, metersToBuilding) {
  const closeReadings = metersToBuilding <= ARRIVAL_RADIUS_METERS ? state.closeReadings + 1 : 0;
  return { closeReadings, arrived: closeReadings >= ARRIVAL_READINGS_NEEDED };
}

// Adds a new reading to the distance walked so far. Returns the new total and
// the point to measure the next step from (small jittery moves are skipped).
function addWalkStep(walked, lastPoint, point, measure) {
  if (lastPoint === null) return { meters: walked, lastPoint: point };
  const step = measure(lastPoint, point);
  if (step < MIN_STEP_METERS) return { meters: walked, lastPoint };
  return { meters: walked + step, lastPoint: point };
}

// ---- Saved walks ----

// Walks shorter than this are treated as an accidental tap and not saved.
const MIN_SAVED_WALK_SECONDS = 30;
// A walk only counts for "on time" if you arrive in this window around the class
// start, on a day the class meets; timing a walk at another hour says nothing
// about getting to class.
const ON_TIME_WINDOW_BEFORE_MINUTES = 60;
const ON_TIME_WINDOW_AFTER_MINUTES = 30;

// Whether you got there by the time class started (both in minutes since midnight).
function isOnTime(arrivalMinute, classStartMinute) {
  return arrivalMinute <= classStartMinute;
}

// true (on time) or false (late) for a walk to a class, or null when the walk
// wasn't on the way to that class: another day, or far from its start time.
function walkOnTimeResult(arrivalMinute, arrivalDay, classDays, classStartMinute) {
  if (!classDays.includes(arrivalDay)) return null;
  const minutesFromStart = arrivalMinute - classStartMinute;
  if (minutesFromStart < -ON_TIME_WINDOW_BEFORE_MINUTES || minutesFromStart > ON_TIME_WINDOW_AFTER_MINUTES) return null;
  return isOnTime(arrivalMinute, classStartMinute);
}

// Reads saved walks, dropping any that are broken instead of failing the whole list.
function parseWalks(json) {
  let saved;
  try {
    saved = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(saved)) return [];
  return saved.filter(
    (walk) =>
      walk &&
      typeof walk.from === "string" &&
      typeof walk.to === "string" &&
      Number.isFinite(walk.seconds) &&
      walk.seconds > 0 &&
      (typeof walk.onTime === "boolean" || walk.onTime === null),
  );
}

// Your leaderboard numbers from your saved walks. Only walks timed on the way
// to class (onTime is true or false) count.
function walkStats(walks) {
  const counted = walks.filter((walk) => walk.onTime !== null);
  return { walks: counted.length, onTimeWalks: counted.filter((walk) => walk.onTime).length };
}

function compareWalk(predictedMinutes, actualSeconds) {
  const actualMinutes = Math.round(actualSeconds / 60);
  const difference = actualMinutes - predictedMinutes;
  const predicted = `the predicted ${predictedMinutes} min`;
  if (difference === 0) return `Took ${actualMinutes} min, right on ${predicted}.`;
  if (difference > 0) return `Took ${actualMinutes} min, ${difference} min longer than ${predicted}.`;
  return `Took ${actualMinutes} min, ${-difference} min faster than ${predicted}.`;
}
