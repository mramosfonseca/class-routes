// Study spots on campus and a sample model of how full each one is.
// Locations are real; seat counts and crowd levels are made-up sample data
// until the app has a real source for them.

// Hours use a 0–24 clock, with times past midnight written as 24+ (26 = 2 AM).
const STUDY_SPOTS = [
  { id: "siebel-basement", name: "Siebel Center basement lounge", type: "lounge", lat: 40.113906, lng: -88.224778, seats: 60, open: 6, close: 26, quiet: false, outlets: true, food: true, note: "Couches and whiteboards near the café. Busy with CS project groups in the afternoon." },
  { id: "eceb-nooks", name: "ECEB second floor nooks", type: "lounge", lat: 40.115, lng: -88.2286, seats: 30, open: 7, close: 24, quiet: true, outlets: true, food: false, note: "Small tables along the windows, easy to miss if you only use the main atrium." },
  { id: "cif", name: "CIF open study areas", type: "atrium", lat: 40.1128, lng: -88.2283, seats: 90, open: 7, close: 23, quiet: false, outlets: true, food: false, note: "Bright open seating between classrooms. Empties out once evening classes end." },
  { id: "beckman", name: "Beckman Institute atrium", type: "atrium", lat: 40.1158, lng: -88.2273, seats: 45, open: 7, close: 22, quiet: true, outlets: true, food: true, busyFactor: 0.8, note: "Tall, calm atrium with a café. Few undergrads think to go here." },
  { id: "grainger", name: "Grainger Engineering Library", type: "library", big: true, lat: 40.11239, lng: -88.226782, seats: 900, open: 8, close: 26, quiet: true, outlets: true, food: false, note: "The big engineering library. Upper floors fill up during exam weeks." },
  { id: "loomis", name: "Loomis Lab lounge", type: "lounge", lat: 40.1108, lng: -88.2232, seats: 20, open: 7, close: 22, quiet: false, outlets: false, food: false, note: "A handful of tables near the physics help rooms." },
  { id: "union", name: "Illini Union courtyard and lounges", type: "lounge", lat: 40.109378, lng: -88.227206, seats: 150, open: 7, close: 24, quiet: false, outlets: true, food: true, note: "Plenty of seats and food; noise depends on what events are running." },
  { id: "math-library", name: "Mathematics Library", type: "library", lat: 40.109389, lng: -88.228306, seats: 80, open: 8, close: 22, quiet: true, outlets: false, food: false, note: "A beautiful reading room inside Altgeld Hall. Silent and rarely crowded before midterms." },
  { id: "natural-history", name: "Natural History Building benches", type: "lobby", lat: 40.1094, lng: -88.2262, seats: 25, open: 7, close: 21, quiet: true, outlets: false, food: false, note: "Quiet benches in the renovated halls. Better for reading than laptops." },
  { id: "noyes", name: "Chemistry reading area", type: "library", lat: 40.1084, lng: -88.2262, seats: 40, open: 8, close: 20, quiet: true, outlets: true, food: false, note: "Small and focused, close to the chem classrooms." },
  { id: "lincoln", name: "Lincoln Hall lobby", type: "lobby", lat: 40.1065, lng: -88.22874, seats: 25, open: 7, close: 22, quiet: false, outlets: true, food: false, note: "Tables outside the theater. Crowded at class change, calm otherwise." },
  { id: "ricker", name: "Ricker Library", type: "library", lat: 40.103, lng: -88.2287, seats: 50, open: 9, close: 21, quiet: true, outlets: true, food: false, note: "Architecture and art library with big tables for spreading out." },
  { id: "krannert", name: "Krannert Center lobby", type: "lobby", lat: 40.1082, lng: -88.2244, seats: 70, open: 9, close: 22, quiet: true, outlets: true, food: true, busyFactor: 0.7, note: "Wide, quiet lobby during the day. Busier before evening performances." },
  { id: "bif", name: "BIF atrium", type: "atrium", lat: 40.103703, lng: -88.230928, seats: 120, open: 7, close: 23, quiet: false, outlets: true, food: true, note: "Busy central atrium with group study rooms upstairs." },
  { id: "main-library", name: "Main Library", type: "library", big: true, lat: 40.105, lng: -88.22861, seats: 700, open: 8, close: 24, quiet: true, outlets: true, food: false, note: "The main research library, with several quiet reading rooms." },
  { id: "ugl", name: "Undergraduate Library", type: "library", big: true, lat: 40.1047, lng: -88.2277, seats: 600, open: 7, close: 26, quiet: false, outlets: true, food: true, note: "Open late, which makes it the default. Expect a crowd after 8 PM." },
  { id: "buell", name: "Temple Buell Hall ground floor", type: "atrium", lat: 40.1022, lng: -88.2281, seats: 35, open: 8, close: 22, quiet: false, outlets: true, food: false, note: "Gallery-style open space. Tables near the windows go first." },
  { id: "funk-aces", name: "Funk ACES Library", type: "library", lat: 40.1028, lng: -88.2253, seats: 350, open: 8, close: 24, quiet: true, outlets: true, food: false, note: "Large and often overlooked. Usually has space when UGL is full." },
  { id: "illini-grove", name: "Illini Grove picnic tables", type: "outdoor", lat: 40.1017, lng: -88.2208, seats: 40, open: 7, close: 20, quiet: true, outlets: false, food: false, note: "Shaded tables in the grove, weather permitting." },
  // Campus Rec buildings. Their hours change by day, so they have a weeklyHours
  // list (Sunday first, [opens, closes]); open/close are their Monday hours.
  // Hours: campusrec.illinois.edu/hours, regular Fall hours (Aug 24 – Dec 17),
  // read 2026-11-23. Break closures are not included. Seat counts are sample data.
  { id: "arc", name: "ARC Well-Being Lounge", type: "lounge", lat: 40.1014, lng: -88.236, seats: 120, open: 6, close: 23,
    weeklyHours: [[9, 22], [6, 23], [6, 23], [6, 23], [6, 23], [6, 22], [9, 22]],
    quiet: false, outlets: true, food: false, note: "Main-level lounge at the Activities and Recreation Center, with group tables, counter seats with built-in power, and two semi-private study pods." },
  // CRCE's location is placed by hand from its street address (1102 W Gregory Dr).
  { id: "crce", name: "CRCE Social Corridor", type: "lounge", lat: 40.1044, lng: -88.2217, seats: 40, open: 7, close: 23,
    weeklyHours: [[11, 18], [7, 23], [7, 23], [7, 23], [7, 23], [7, 21], [11, 18]],
    quiet: false, outlets: false, food: false, note: "Entrance-level hallway at Campus Recreation Center East with study and group work tables and couches." },
  { id: "cafe-paradiso", name: "Café Paradiso", type: "cafe", lat: 40.1056, lng: -88.2194, seats: 35, open: 7, close: 22, quiet: false, outlets: true, food: true, note: "Neighborhood café a short walk from the Quad. Buy something and settle in." },
];

const SPOT_TYPE_LABELS = { library: "Library", cafe: "Café", atrium: "Atrium", lounge: "Lounge", lobby: "Lobby", outdoor: "Outdoors" };

// Each type of spot has one or two busy peaks: [hour of the peak, how busy, how wide in hours].
const BUSY_PEAKS = {
  big: [[13, 0.5, 3], [20, 0.85, 2.4]],
  library: [[14, 0.35, 3], [20.5, 0.6, 2.2]],
  cafe: [[10.5, 0.7, 2], [15, 0.45, 2.5]],
  atrium: [[12, 0.8, 1.6], [16, 0.45, 2]],
  lounge: [[13, 0.5, 2.5], [21, 0.55, 2]],
  lobby: [[12.5, 0.5, 1.8], [18.5, 0.35, 1.5]],
  outdoor: [[13, 0.6, 2.2]],
};

const WEEKEND_BUSY_FACTOR = 0.6;

// The levels shown on the map, from emptiest to fullest.
const CROWD_LEVELS = {
  open: { label: "Plenty of room", color: "#16a34a" },
  filling: { label: "Filling up", color: "#ca8a04" },
  packed: { label: "Packed", color: "#dc2626" },
  closed: { label: "Closed", color: "#94a3b8" },
};

// Turns a clock time into the spot's 0–30 hour scale, so 1 AM counts as 25.
function spotHour(hours, minutes) {
  const hour = hours + minutes / 60;
  return hour < 5 ? hour + 24 : hour;
}

// Checks the hour on today's clock and a day either side, so hours that run
// past midnight (8 AM to 2 AM) or start after it (3 AM to 11 AM) both work.
function isSpotOpen(spot, hour) {
  return [hour - 24, hour, hour + 24].some((time) => time >= spot.open && time < spot.close);
}

// A spot's hours on a given day (0 = Sunday): its weekly schedule if it has one,
// unless the user edited its hours, which then apply every day.
function spotHoursOn(spot, day) {
  if (spot.weeklyHours && !spot.hasEditedHours) {
    const [open, close] = spot.weeklyHours[day];
    return { open, close };
  }
  return { open: spot.open, close: spot.close };
}

// The hours each built-in spot starts with, so edited hours can be reset.
const DEFAULT_SPOT_HOURS = Object.fromEntries(
  STUDY_SPOTS.map((spot) => [spot.id, { open: spot.open, close: spot.close }]),
);

// Turns two "HH:MM" times into opening hours. A closing time at or before the
// opening time means it closes after midnight. Returns { error } when they can't work.
function hoursFromTimes(openTime, closeTime) {
  if (!openTime || !closeTime) return { error: "Enter both an opening and a closing time." };
  const toHour = (time) => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours + minutes / 60;
  };
  const open = toHour(openTime);
  let close = toHour(closeTime);
  if (close === open) return { error: "Opening and closing times can't be the same." };
  if (close < open) close += 24;
  return { open, close };
}

// The "HH:MM" value a time box needs to show an hour from the spot scale.
function timeValueOf(hour) {
  const totalMinutes = Math.round((hour % 24) * 60);
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
}

// Reads saved hours ({ spotId: { open, close } }), dropping any that don't make sense.
function parseSpotHours(json) {
  let saved;
  try {
    saved = JSON.parse(json);
  } catch {
    return {};
  }
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};
  const valid = {};
  for (const [id, hours] of Object.entries(saved)) {
    const { open, close } = hours ?? {};
    if (Number.isFinite(open) && Number.isFinite(close) && open >= 0 && open < 24 && close > open && close <= open + 24) {
      valid[id] = { open, close };
    }
  }
  return valid;
}

function isValidPercent(percent) {
  return Number.isFinite(percent) && percent >= 0 && percent <= 100;
}

// Reads saved percents ({ spotId: percentFull }), dropping any outside 0–100.
function parseSpotFullness(json) {
  let saved;
  try {
    saved = JSON.parse(json);
  } catch {
    return {};
  }
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};
  return Object.fromEntries(Object.entries(saved).filter(([, percent]) => isValidPercent(percent)));
}

// Gives every built-in spot the percent full the user set, or none so the
// sample model decides.
function applySpotFullness(editedFullness) {
  for (const spot of STUDY_SPOTS) {
    spot.fixedPercentFull = editedFullness[spot.id];
  }
}

// Gives every built-in spot its edited hours, or its original hours if it has none.
function applySpotHours(editedHours) {
  for (const spot of STUDY_SPOTS) {
    const hours = editedHours[spot.id] ?? DEFAULT_SPOT_HOURS[spot.id];
    spot.open = hours.open;
    spot.close = hours.close;
    spot.hasEditedHours = Boolean(editedHours[spot.id]);
  }
}

// A repeatable pseudo-random number in [0, 1) for a given text, so the
// sample crowd levels wiggle a little without changing on every redraw.
function seededRandom(text) {
  let hash = 2166136261;
  for (const character of text) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  let t = (hash >>> 0) + 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// Fraction of seats taken (0–1), or null when the spot is closed. Day uses 0 = Sunday.
function spotOccupancy(spot, day, hour) {
  if (!isSpotOpen(spotHoursOn(spot, day), hour)) return null;
  // A percent the user set replaces the sample model while the spot is open.
  if (Number.isFinite(spot.fixedPercentFull)) return spot.fixedPercentFull / 100;
  let busy = 0.08;
  for (const [peakHour, height, width] of BUSY_PEAKS[spot.big ? "big" : spot.type]) {
    busy += height * Math.exp(-((hour - peakHour) ** 2) / (2 * width * width));
  }
  busy *= spot.busyFactor ?? 1;
  if (day === 0 || day === 6) busy *= WEEKEND_BUSY_FACTOR;
  busy += (seededRandom(`${spot.id}:${day}:${Math.round(hour * 2)}`) - 0.5) * 0.14;
  return Math.min(0.98, Math.max(0.03, busy));
}

// The color level for a fraction of seats taken (0–1). Every spot, built-in or
// added, uses these same cutoffs.
function crowdLevelFor(occupancy) {
  if (occupancy < 0.55) return "open";
  if (occupancy < 0.82) return "filling";
  return "packed";
}

// How full a spot is right now: its crowd level, the number of free seats,
// and the percent of seats taken.
function spotStatus(spot, day, hour) {
  const occupancy = spotOccupancy(spot, day, hour);
  if (occupancy === null) return { level: "closed", freeSeats: 0, percentFull: null };
  // The color comes from the rounded percent shown to the user, so "55% full"
  // is never green even when the exact number is 54.8%.
  const percentFull = Math.round(occupancy * 100);
  return {
    level: crowdLevelFor(percentFull / 100),
    freeSeats: Math.round(spot.seats * (1 - occupancy)),
    percentFull,
  };
}

function formatSpotHour(hour) {
  const totalMinutes = Math.round(hour * 60);
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  const suffix = hours >= 12 ? "PM" : "AM";
  return `${((hours + 11) % 12) + 1}${minutes ? `:${String(minutes).padStart(2, "0")}` : ""} ${suffix}`;
}
