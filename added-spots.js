// Study spots people add themselves. Each has a percent full, set from its popup
// on the map, and its color follows from that with the same cutoffs as the
// built-in spots (see crowdLevelFor in study-spots.js).

const ADDED_SPOT_NAME_MAX = 40;
// New spots start here (green) until the user sets how full they are.
const DEFAULT_ADDED_PERCENT = 30;

// Spots saved before percentages existed only had a color; these stand in for it.
const PERCENT_FOR_OLD_LEVEL = { open: 30, filling: 70, packed: 90 };

// Returns what is wrong with a new spot, or "" when it can be added.
function addedSpotError(name, percentFull) {
  if (typeof name !== "string" || name.trim() === "") return "Give the spot a name.";
  if (!isValidPercent(percentFull)) {
    return "Set how full it is, from 0 to 100%.";
  }
  return "";
}

// The color level of a spot someone added, from how full they said it is.
function addedSpotCrowdLevel(spot) {
  return crowdLevelFor(spot.percentFull / 100);
}

// Reads saved spots, dropping any that are broken instead of failing the whole list.
// Spots saved with only a color get the matching percent.
function parseAddedSpots(json) {
  let saved;
  try {
    saved = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(saved)) return [];
  return saved
    .filter((spot) => spot && typeof spot === "object")
    .map((spot) => ({
      id: spot.id,
      name: spot.name,
      percentFull: spot.percentFull ?? PERCENT_FOR_OLD_LEVEL[spot.level],
      lat: spot.lat,
      lng: spot.lng,
    }))
    .filter(
      (spot) =>
        typeof spot.id === "string" &&
        addedSpotError(spot.name, spot.percentFull) === "" &&
        Number.isFinite(spot.lat) &&
        Number.isFinite(spot.lng),
    );
}
