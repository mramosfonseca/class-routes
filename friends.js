// Friend groups: sample friends with class schedules, and the logic that finds
// free time a group shares and a study spot to meet at.
// The friends are made-up sample data until the app has real sharing.

// Days use JavaScript's numbering (0 = Sunday). Building ids come from buildings.js.
const SAMPLE_FRIENDS = [
  { id: "priya", name: "Priya", color: "#7c3aed", classes: [
    { course: "CS 225", buildingId: "siebel", days: [1, 3, 5], time: "09:00", lengthMinutes: 50 },
    { course: "MATH 257", buildingId: "altgeld", days: [1, 3, 5], time: "13:00", lengthMinutes: 50 },
    { course: "PHYS 211", buildingId: "loomis", days: [2, 4], time: "11:00", lengthMinutes: 75 },
  ] },
  { id: "jake", name: "Jake", color: "#0891b2", classes: [
    { course: "CS 124", buildingId: "foellinger", days: [1, 3, 5], time: "10:00", lengthMinutes: 50 },
    { course: "STAT 107", buildingId: "lincoln", days: [1, 3, 5], time: "14:00", lengthMinutes: 50 },
    { course: "ECE 120", buildingId: "ece", days: [2, 4], time: "14:00", lengthMinutes: 80 },
  ] },
  { id: "marcus", name: "Marcus", color: "#ea580c", classes: [
    { course: "CHEM 102", buildingId: "lincoln", days: [1, 3, 5], time: "08:00", lengthMinutes: 50 },
    { course: "ECON 102", buildingId: "library", days: [2, 4], time: "11:00", lengthMinutes: 80 },
    { course: "KIN 100", buildingId: "arc", days: [2, 4], time: "15:00", lengthMinutes: 50 },
  ] },
  { id: "lily", name: "Lily", color: "#db2777", classes: [
    { course: "RHET 105", buildingId: "lincoln", days: [1, 3, 5], time: "12:00", lengthMinutes: 50 },
    { course: "PSYC 100", buildingId: "foellinger", days: [2, 4], time: "09:30", lengthMinutes: 80 },
    { course: "ARTD 101", buildingId: "krannert", days: [1, 3], time: "15:00", lengthMinutes: 110 },
  ] },
  { id: "dev", name: "Dev", color: "#16a34a", classes: [
    { course: "CS 233", buildingId: "siebel", days: [1, 3, 5], time: "13:00", lengthMinutes: 50 },
    { course: "ECE 110", buildingId: "ece", days: [2, 4], time: "13:00", lengthMinutes: 80 },
  ] },
  { id: "sam", name: "Sam", color: "#ca8a04", classes: [
    { course: "MATH 241", buildingId: "altgeld", days: [1, 3, 5], time: "11:00", lengthMinutes: 50 },
    { course: "CS 128", buildingId: "siebel", days: [2, 4], time: "09:30", lengthMinutes: 75 },
  ] },
  { id: "ana", name: "Ana", color: "#2563eb", classes: [
    { course: "CS 173", buildingId: "siebel", days: [2, 4], time: "12:30", lengthMinutes: 75 },
    { course: "LING 100", buildingId: "lincoln", days: [1, 3, 5], time: "14:00", lengthMinutes: 50 },
  ] },
];

const SAMPLE_GROUPS = [
  { id: "study-squad", name: "Study Squad", memberIds: ["priya", "jake"], shown: true },
  { id: "floor-4-crew", name: "Floor 4 Crew", memberIds: ["marcus", "lily"], shown: false },
];

// Meetups are looked for across the whole day, and must be at least this long.
const MEETUP_DAY_START = 0;
const MEETUP_DAY_END = 24 * 60;
const MEETUP_MIN_MINUTES = 30;

function findFriend(id) {
  return SAMPLE_FRIENDS.find((friend) => friend.id === id);
}

function minutesOf(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function metersBetween(from, to) {
  const earthRadius = 6371000;
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(a));
}

// Each schedule is a list of classes. Returns the stretches of the day, in minutes
// since midnight, when nobody in any of the schedules has class.
function sharedFreeWindows(schedules, day) {
  const busy = schedules
    .flat()
    .filter((entry) => entry.days.includes(day))
    .map((entry) => [minutesOf(entry.time), minutesOf(entry.time) + entry.lengthMinutes])
    .sort((a, b) => a[0] - b[0]);

  const windows = [];
  let freeFrom = MEETUP_DAY_START;
  for (const [start, end] of busy) {
    if (start > freeFrom) windows.push({ start: freeFrom, end: Math.min(start, MEETUP_DAY_END) });
    freeFrom = Math.max(freeFrom, end);
  }
  windows.push({ start: freeFrom, end: MEETUP_DAY_END });
  return windows.filter((window) => window.end - window.start >= MEETUP_MIN_MINUTES);
}

// Splits a day's events (each with start and end minutes) into side-by-side lanes so
// that no two events in a lane overlap. Returns each event's lane and how many lanes there are.
// The Week view uses it to put your overlapping classes and blocks side by side.
function assignLanes(events) {
  const order = events.map((_, index) => index).sort((a, b) => events[a].start - events[b].start);
  const laneEnds = [];
  const lanes = new Array(events.length);
  for (const index of order) {
    let lane = laneEnds.findIndex((end) => end <= events[index].start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = events[index].end;
    lanes[index] = lane;
  }
  return { lanes, laneCount: Math.max(1, laneEnds.length) };
}

// Where someone is at a given minute: the building of their last class before it,
// or of their next class if they have not had one yet. Null if no class that day.
function whereIs(schedule, day, minute) {
  const today = schedule
    .filter((entry) => entry.days.includes(day))
    .sort((a, b) => minutesOf(a.time) - minutesOf(b.time));
  if (today.length === 0) return null;
  const before = today.filter((entry) => minutesOf(entry.time) < minute);
  const entry = before.length > 0 ? before[before.length - 1] : today[0];
  return BUILDINGS.find((building) => building.id === entry.buildingId) ?? null;
}

// Used as the meeting point when nobody in the group has class that day.
const MAIN_QUAD = { lat: 40.1075, lng: -88.2272 };
const MEETUP_STEP_MINUTES = 30;

// The open, not-packed study spot closest to the middle of where everyone is
// at a given minute, or null if every spot is closed or packed then.
function closestOpenSpot(schedules, day, minute) {
  const places = schedules.map((schedule) => whereIs(schedule, day, minute)).filter(Boolean);
  const middle =
    places.length === 0
      ? MAIN_QUAD
      : {
          lat: places.reduce((sum, place) => sum + place.lat, 0) / places.length,
          lng: places.reduce((sum, place) => sum + place.lng, 0) / places.length,
        };
  const hour = spotHour(Math.floor(minute / 60) % 24, minute % 60);
  let best = null;
  for (const spot of STUDY_SPOTS) {
    const status = spotStatus(spot, day, hour);
    if (status.level === "closed" || status.level === "packed") continue;
    const meters = metersBetween(middle, spot);
    if (!best || meters < best.meters) best = { spot, status, meters, minute };
  }
  return best;
}

// Where to meet during a free window: tries the start of the window, then every
// half hour after it, until some study spot is open with room.
function meetupSpot(schedules, day, start, end) {
  for (let minute = start; minute + MEETUP_STEP_MINUTES <= end || minute === start; minute += MEETUP_STEP_MINUTES) {
    const match = closestOpenSpot(schedules, day, minute);
    if (match) return match;
  }
  return null;
}
