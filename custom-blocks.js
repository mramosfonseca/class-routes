// Custom blocks: things you put on your Week calendar that aren't classes,
// like gym, work or study time. They repeat every week on the days you pick
// and only show on the calendar; walks and meetups ignore them.

const BLOCK_NAME_MAX = 30;
const BLOCK_MIN_MINUTES = 5;
const BLOCK_MAX_MINUTES = 24 * 60;

// New blocks are white. Blocks made before that could be one of BLOCK_COLORS,
// and keep their color.
const DEFAULT_BLOCK_COLOR = "#ffffff";
const BLOCK_COLORS = [
  { name: "Gray", value: "#475569" },
  { name: "Green", value: "#15803d" },
  { name: "Teal", value: "#0f766e" },
  { name: "Purple", value: "#7e22ce" },
  { name: "Pink", value: "#be185d" },
  { name: "Brown", value: "#92400e" },
];

function isClockTime(time) {
  if (typeof time !== "string" || !/^\d{2}:\d{2}$/.test(time)) return false;
  const [hours, minutes] = time.split(":").map(Number);
  return hours < 24 && minutes < 60;
}

// Returns what is wrong with a block, or "" when it can be saved.
function blockError(block) {
  if (typeof block.name !== "string" || block.name.trim() === "") return "Give the block a name.";
  if (!Array.isArray(block.days) || block.days.length === 0) return "Pick at least one day.";
  if (!block.days.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)) return "Pick at least one day.";
  if (!isClockTime(block.time)) return "Enter a start time.";
  const length = block.lengthMinutes;
  if (!Number.isFinite(length) || length < BLOCK_MIN_MINUTES || length > BLOCK_MAX_MINUTES) {
    return `Length must be between ${BLOCK_MIN_MINUTES} and ${BLOCK_MAX_MINUTES} minutes.`;
  }
  const knownColor = block.color === DEFAULT_BLOCK_COLOR || BLOCK_COLORS.some((color) => color.value === block.color);
  if (!knownColor) return "Pick a color.";
  return "";
}

// Reads saved blocks, dropping any that are broken instead of failing the whole list.
function parseBlocks(json) {
  let saved;
  try {
    saved = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(saved)) return [];
  return saved.filter((block) => block && typeof block.id === "string" && blockError(block) === "");
}

// A day's blocks (0 = Sunday), earliest first.
function blocksOn(blocks, day) {
  return blocks.filter((block) => block.days.includes(day)).sort((a, b) => a.time.localeCompare(b.time));
}
