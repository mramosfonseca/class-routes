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

// Adds shared spot data to yours: new spots are added, a spot you already have
// (same id, from an earlier link) is updated, and shared hours and "how full"
// values replace yours for those spots. Returns the result and what changed.
function mergeShared(mine, shared) {
  const addedSpots = [...mine.addedSpots];
  let added = 0;
  let updated = 0;
  for (const spot of shared.addedSpots) {
    const index = addedSpots.findIndex((existing) => existing.id === spot.id);
    if (index === -1) {
      addedSpots.push(spot);
      added += 1;
    } else {
      addedSpots[index] = spot;
      updated += 1;
    }
  }
  const editedSpots = new Set([...Object.keys(shared.editedHours), ...Object.keys(shared.editedFullness)]);
  return {
    merged: {
      addedSpots,
      editedHours: { ...mine.editedHours, ...shared.editedHours },
      editedFullness: { ...mine.editedFullness, ...shared.editedFullness },
    },
    summary: { added, updated, edited: editedSpots.size },
  };
}

// "2 study spots and edits for 3 spots", for the import banner.
function describeShare(shared) {
  const parts = [];
  const spots = shared.addedSpots.length;
  if (spots > 0) parts.push(`${spots} study spot${spots === 1 ? "" : "s"}`);
  const edited = new Set([...Object.keys(shared.editedHours), ...Object.keys(shared.editedFullness)]).size;
  if (edited > 0) parts.push(`edits for ${edited} spot${edited === 1 ? "" : "s"}`);
  return parts.join(" and ");
}
