// Share links: your added spots and edited hours and "how full" values, packed
// into a link a friend can open and import. There's no server: everything is in
// the part of the link after "#", which browsers never send to the website.

const SHARE_LINK_PREFIX = "share=";
// Limits that keep a link a reasonable length and stop a strange link from
// flooding someone's map.
const SHARE_MAX_SPOTS = 50;
const SHARE_MAX_EDITS = 100;

// Text → base64url (letters, digits, "-" and "_", safe in a link). Works for any
// characters, including accents and emoji in spot names.
function toBase64Url(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(encoded) {
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

// Whether there's anything worth sharing.
function hasSomethingToShare({ addedSpots, editedHours, editedFullness }) {
  return addedSpots.length > 0 || Object.keys(editedHours).length > 0 || Object.keys(editedFullness).length > 0;
}

// The "#share=…" part of a link for this spot data.
function encodeShare({ addedSpots, editedHours, editedFullness }) {
  const payload = { version: 1, addedSpots, editedHours, editedFullness };
  return `#${SHARE_LINK_PREFIX}${toBase64Url(JSON.stringify(payload))}`;
}

// Reads the spot data from a link's "#share=…" part, or returns null if there
// isn't one or it's broken. Everything is checked the same way as data saved on
// this device, so a tampered link can't put bad data on someone's map.
function decodeShare(hash) {
  const text = String(hash ?? "").replace(/^#/, "");
  if (!text.startsWith(SHARE_LINK_PREFIX)) return null;
  let payload;
  try {
    payload = JSON.parse(fromBase64Url(text.slice(SHARE_LINK_PREFIX.length)));
  } catch {
    return null;
  }
  if (!payload || typeof payload !== "object" || payload.version !== 1) return null;
  const firstEntries = (object) => Object.fromEntries(Object.entries(object).slice(0, SHARE_MAX_EDITS));
  const shared = {
    addedSpots: parseAddedSpots(JSON.stringify(payload.addedSpots ?? [])).slice(0, SHARE_MAX_SPOTS),
    editedHours: firstEntries(parseSpotHours(JSON.stringify(payload.editedHours ?? {}))),
    editedFullness: firstEntries(parseSpotFullness(JSON.stringify(payload.editedFullness ?? {}))),
  };
  return hasSomethingToShare(shared) ? shared : null;
}

// Two spots with the same name this close together are the same place, even if
// two people each added it themselves.
const SAME_SPOT_METERS = 100;

function spotNameKey(name) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

// Whether a shared spot is already on your map: the same spot (it keeps its id
// when shared), or one with the same name nearby.
function isAlreadyOnMap(spot, mySpots, measure) {
  return mySpots.some(
    (mine) =>
      mine.id === spot.id || (spotNameKey(mine.name) === spotNameKey(spot.name) && measure(mine, spot) <= SAME_SPOT_METERS),
  );
}

// The shared spots that aren't on your map yet.
function newSharedSpots(mySpots, sharedSpots, measure) {
  return sharedSpots.filter((spot) => !isAlreadyOnMap(spot, mySpots, measure));
}

// Adds shared spot data to yours: only spots that aren't already on your map
// are added (yours are left as they are), and shared hours and "how full"
// values replace yours for those spots. measure(a, b) gives the meters between
// two places. Returns the result and what changed.
function mergeShared(mine, shared, measure) {
  const newSpots = newSharedSpots(mine.addedSpots, shared.addedSpots, measure);
  const editedSpots = new Set([...Object.keys(shared.editedHours), ...Object.keys(shared.editedFullness)]);
  return {
    merged: {
      addedSpots: [...mine.addedSpots, ...newSpots],
      editedHours: { ...mine.editedHours, ...shared.editedHours },
      editedFullness: { ...mine.editedFullness, ...shared.editedFullness },
    },
    summary: {
      added: newSpots.length,
      alreadyOnMap: shared.addedSpots.length - newSpots.length,
      edited: editedSpots.size,
    },
  };
}

// ---- Schedule links ----
// Your classes and custom blocks, for someone to see on their Week calendar for
// a while. The person who opens one never saves it; see app.js.

const SCHEDULE_LINK_PREFIX = "schedule=";
const SCHEDULE_NAME_MAX = 30;
const SCHEDULE_MAX_ITEMS = 40;
// A schedule link stops working after this long, so an old link in a group chat
// doesn't show an outdated schedule.
const SCHEDULE_LINK_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

// The "#schedule=…" part of a link. Only what the calendar needs is included.
function encodeSchedule({ name, classes, blocks }, now = Date.now()) {
  const payload = {
    version: 1,
    name: name.trim().slice(0, SCHEDULE_NAME_MAX),
    createdAt: now,
    classes: classes.map(({ course, buildingId, room, days, time, lengthMinutes }) => ({
      course,
      buildingId,
      room,
      days,
      time,
      lengthMinutes,
    })),
    blocks: blocks.map(({ name: blockName, days, time, lengthMinutes }) => ({ name: blockName, days, time, lengthMinutes })),
  };
  return `#${SCHEDULE_LINK_PREFIX}${toBase64Url(JSON.stringify(payload))}`;
}

function isValidDays(days) {
  return Array.isArray(days) && days.length > 0 && days.every((day) => Number.isInteger(day) && day >= 0 && day <= 6);
}

// A shared class, checked: its building must be one the app knows.
function isValidSharedClass(entry, isKnownBuilding) {
  return (
    entry &&
    typeof entry.course === "string" &&
    entry.course.length <= 40 &&
    typeof entry.room === "string" &&
    entry.room.length <= 12 &&
    isKnownBuilding(entry.buildingId) &&
    isValidDays(entry.days) &&
    isClockTime(entry.time) &&
    Number.isFinite(entry.lengthMinutes) &&
    entry.lengthMinutes >= 5 &&
    entry.lengthMinutes <= 600
  );
}

// Reads a schedule from a link's "#schedule=…" part. Returns the schedule,
// { expired: true } for a link older than SCHEDULE_LINK_DAYS, or null when
// there isn't one or it's broken.
function decodeSchedule(hash, isKnownBuilding, now = Date.now()) {
  const text = String(hash ?? "").replace(/^#/, "");
  if (!text.startsWith(SCHEDULE_LINK_PREFIX)) return null;
  let payload;
  try {
    payload = JSON.parse(fromBase64Url(text.slice(SCHEDULE_LINK_PREFIX.length)));
  } catch {
    return null;
  }
  if (!payload || payload.version !== 1 || !Number.isFinite(payload.createdAt)) return null;
  if (now - payload.createdAt > SCHEDULE_LINK_DAYS * DAY_MS) return { expired: true };
  const name = typeof payload.name === "string" && payload.name.trim() ? payload.name.trim().slice(0, SCHEDULE_NAME_MAX) : "A friend";
  const classes = (Array.isArray(payload.classes) ? payload.classes : [])
    .filter((entry) => isValidSharedClass(entry, isKnownBuilding))
    .slice(0, SCHEDULE_MAX_ITEMS);
  const blocks = (Array.isArray(payload.blocks) ? payload.blocks : [])
    .filter((block) => block && blockError({ ...block, color: DEFAULT_BLOCK_COLOR }) === "")
    .map(({ name: blockName, days, time, lengthMinutes }) => ({ name: blockName, days, time, lengthMinutes }))
    .slice(0, SCHEDULE_MAX_ITEMS);
  if (classes.length === 0 && blocks.length === 0) return null;
  return { name, classes, blocks, createdAt: payload.createdAt };
}

// "4 classes and 1 block"
function describeSchedule({ classes, blocks }) {
  const parts = [];
  if (classes.length > 0) parts.push(`${classes.length} class${classes.length === 1 ? "" : "es"}`);
  if (blocks.length > 0) parts.push(`${blocks.length} block${blocks.length === 1 ? "" : "s"}`);
  return parts.join(" and ");
}

// "2 study spots and edits for 3 spots". With newSpotCount, it also says how many
// of the spots are new to you: "3 study spots (1 new to you) and …".
function describeShare(shared, newSpotCount = null) {
  const parts = [];
  const spots = shared.addedSpots.length;
  if (spots > 0) {
    const fresh = newSpotCount === null || newSpotCount === spots ? "" : ` (${newSpotCount === 0 ? "all already on your map" : `${newSpotCount} new to you`})`;
    parts.push(`${spots} study spot${spots === 1 ? "" : "s"}${fresh}`);
  }
  const edited = new Set([...Object.keys(shared.editedHours), ...Object.keys(shared.editedFullness)]).size;
  if (edited > 0) parts.push(`edits for ${edited} spot${edited === 1 ? "" : "s"}`);
  return parts.join(" and ");
}
