const STORAGE_KEY = "class-routes.classes";
const GROUPS_STORAGE_KEY = "class-routes.groups";
const ADDED_SPOTS_STORAGE_KEY = "class-routes.added-spots";
const SPOT_HOURS_STORAGE_KEY = "class-routes.spot-hours";
const SPOT_FULLNESS_STORAGE_KEY = "class-routes.spot-fullness";
const FOLDED_SECTIONS_STORAGE_KEY = "class-routes.folded-sections";
const BLOCKS_STORAGE_KEY = "class-routes.blocks";
const WALKING_SPEED_METERS_PER_SECOND = 1.35;
const MINUTES_FROM_ENTRANCE_TO_ROOM = 2;
const HOUR_HEIGHT_PX = 48;
const FIRST_VISIBLE_HOUR = 8;
// Matches the phone-width layout in style.css (max-width: 599px).
const PHONE_SCREEN = window.matchMedia("(max-width: 599px)");
const COLORS = ["#2563eb", "#db2777", "#16a34a", "#ea580c", "#7c3aed", "#0891b2", "#ca8a04"];

// Days use JavaScript's numbering (0 = Sunday), shown Monday first.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const SAMPLE_CLASSES = [
  { course: "CS 124", buildingId: "foellinger", room: "", days: [1, 3, 5], time: "10:00", lengthMinutes: 50 },
  { course: "MATH 241", buildingId: "altgeld", room: "314", days: [1, 3, 5], time: "11:00", lengthMinutes: 50 },
  { course: "CS 128", buildingId: "siebel", room: "1404", days: [2, 4], time: "09:30", lengthMinutes: 75 },
  { course: "ECE 110", buildingId: "ece", room: "1002", days: [2, 4], time: "13:00", lengthMinutes: 80 },
];

// When a popup opens near the map's edge, the map moves to fit it. This keeps
// popups clear of the zoom buttons (top left) and the add-spot button (top right).
L.Popup.mergeOptions({ autoPanPaddingTopLeft: L.point(50, 20), autoPanPaddingBottomRight: L.point(20, 20) });
const map = L.map("map").setView([40.1085, -88.2272], 16);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);
const routeLayer = L.layerGroup().addTo(map);
const spotLayer = L.layerGroup().addTo(map);
const diningLayer = L.layerGroup().addTo(map);
// Every clickable place on the map by id (study spots, added spots and dining
// halls), so a popup can be reopened after an edit.
const spotMarkers = new Map();

let classes = loadClasses();
let groups = loadGroups();
let addedSpots = loadAddedSpots();
// Opening hours the user changed, by spot id. Built-in spots take them on right away.
let editedHours = loadSaved(SPOT_HOURS_STORAGE_KEY, parseSpotHours);
applySpotHours(editedHours);
// How full the user set each built-in spot, by spot id. Spots without one use the sample model.
let editedFullness = loadSaved(SPOT_FULLNESS_STORAGE_KEY, parseSpotFullness);
applySpotFullness(editedFullness);
// Custom blocks on the Week calendar, and the one being edited in the form (if any).
let blocks = loadSaved(BLOCKS_STORAGE_KEY, parseBlocks);
let editingBlockId = null;
// The name and color of a spot waiting for a map click to place it.
let pendingSpot = null;
let selectedDay = new Date().getDay();
let spotFilters = { openOnly: true, quiet: false, outlets: false };
const ALL_FRIENDS_OPTION = "all";
let leaderboardGroupId = ALL_FRIENDS_OPTION;

// Older saves only had a building and a start time, so fill in the newer fields.
function upgradeClass(entry) {
  return {
    course: typeof entry.course === "string" ? entry.course : "",
    buildingId: entry.buildingId,
    room: typeof entry.room === "string" ? entry.room : "",
    days: Array.isArray(entry.days) ? entry.days : [1, 3, 5],
    time: entry.time,
    lengthMinutes: Number(entry.lengthMinutes) > 0 ? Number(entry.lengthMinutes) : 50,
  };
}

function loadClasses() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(saved)) {
      return saved.filter((entry) => findBuilding(entry.buildingId) && entry.time).map(upgradeClass);
    }
  } catch {
    // Storage unavailable or corrupted: fall back to the sample week.
  }
  return SAMPLE_CLASSES.map(upgradeClass);
}

function saveClasses() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(classes));
  } catch {
    // Storage unavailable: the schedule still works for this visit.
  }
}

function loadGroups() {
  try {
    const saved = JSON.parse(localStorage.getItem(GROUPS_STORAGE_KEY));
    if (Array.isArray(saved)) {
      return saved
        .filter((group) => typeof group.name === "string" && Array.isArray(group.memberIds))
        .map((group) => ({
          id: String(group.id),
          name: group.name,
          memberIds: group.memberIds.filter((id) => findFriend(id)),
          shown: group.shown === true,
        }))
        .filter((group) => group.memberIds.length > 0);
    }
  } catch {
    // Storage unavailable or corrupted: fall back to the sample groups.
  }
  return SAMPLE_GROUPS.map((group) => ({ ...group, memberIds: [...group.memberIds] }));
}

function saveGroups() {
  try {
    localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(groups));
  } catch {
    // Storage unavailable: groups still work for this visit.
  }
}

function loadAddedSpots() {
  try {
    return parseAddedSpots(localStorage.getItem(ADDED_SPOTS_STORAGE_KEY));
  } catch {
    // Storage unavailable: start with no added spots.
    return [];
  }
}

// Reads saved edits with their parser. If storage is unavailable (some private
// windows), the parser's empty result means every spot keeps its usual values.
function loadSaved(key, parse) {
  let json = null;
  try {
    json = localStorage.getItem(key);
  } catch {
    // Storage unavailable: parse(null) gives the empty result.
  }
  return parse(json);
}

function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable: the edit still applies for this visit.
  }
}

function saveSpotHours() {
  saveToStorage(SPOT_HOURS_STORAGE_KEY, editedHours);
}

function saveSpotFullness() {
  saveToStorage(SPOT_FULLNESS_STORAGE_KEY, editedFullness);
}

function saveAddedSpots() {
  try {
    localStorage.setItem(ADDED_SPOTS_STORAGE_KEY, JSON.stringify(addedSpots));
  } catch {
    // Storage unavailable: added spots still show for this visit.
  }
}

function namesList(names) {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function findBuilding(id) {
  return BUILDINGS.find((building) => building.id === id);
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function toMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatMinutes(totalMinutes) {
  const clamped = Math.max(0, totalMinutes) % (24 * 60);
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  const suffix = hours >= 12 ? "PM" : "AM";
  return `${((hours + 11) % 12) + 1}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function formatTime(time) {
  return formatMinutes(toMinutes(time));
}

function classLabel(entry) {
  return entry.course || findBuilding(entry.buildingId).name;
}

function classPlace(entry) {
  const building = findBuilding(entry.buildingId).name;
  return entry.room ? `${building} ${entry.room}` : building;
}

function colorFor(entry) {
  const key = entry.course || entry.buildingId;
  let hash = 0;
  for (const character of key) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return COLORS[hash % COLORS.length];
}

function classesOn(day) {
  return classes
    .filter((entry) => entry.days.includes(day))
    .sort((a, b) => a.time.localeCompare(b.time));
}

// Asks OpenStreetMap's walking router for a route; falls back to a straight-line estimate.
async function fetchWalkingRoute(from, to) {
  const url =
    "https://routing.openstreetmap.de/routed-foot/route/v1/foot/" +
    `${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Routing failed: ${response.status}`);
    const data = await response.json();
    const route = data.routes[0];
    return {
      path: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      meters: route.distance,
      seconds: route.distance / WALKING_SPEED_METERS_PER_SECOND,
      isEstimate: false,
    };
  } catch {
    // Paths are rarely straight, so pad the estimate by 30%.
    const meters = metersBetween(from, to) * 1.3;
    return {
      path: [
        [from.lat, from.lng],
        [to.lat, to.lng],
      ],
      meters,
      seconds: meters / WALKING_SPEED_METERS_PER_SECOND,
      isEstimate: true,
    };
  }
}

function describeDays(days) {
  return WEEK_ORDER.filter((day) => days.includes(day))
    .map((day) => DAY_SHORT[day])
    .join(" ");
}

function renderClassList() {
  const list = document.getElementById("class-list");
  list.innerHTML = "";
  if (classes.length === 0) {
    list.innerHTML = '<li class="empty">No classes yet. Add one below.</li>';
    return;
  }
  const sorted = classes.slice().sort((a, b) => classLabel(a).localeCompare(classLabel(b)));
  for (const entry of sorted) {
    const item = document.createElement("li");
    item.style.borderLeftColor = colorFor(entry);
    const start = toMinutes(entry.time);
    item.innerHTML =
      `<span class="class-info"><strong>${escapeHtml(classLabel(entry))}</strong>` +
      `<span>${describeDays(entry.days)} · ${formatMinutes(start)}–${formatMinutes(start + entry.lengthMinutes)}</span>` +
      `<span>${escapeHtml(classPlace(entry))}</span></span>`;
    const removeButton = document.createElement("button");
    removeButton.className = "remove";
    removeButton.textContent = "Remove";
    removeButton.setAttribute("aria-label", `Remove ${classLabel(entry)}`);
    removeButton.addEventListener("click", () => {
      classes = classes.filter((other) => other !== entry);
      saveClasses();
      render();
    });
    item.appendChild(removeButton);
    list.appendChild(item);
  }
}

function renderDayTabs() {
  const tabs = document.getElementById("day-tabs");
  tabs.innerHTML = "";
  for (const day of WEEK_ORDER) {
    const tab = document.createElement("button");
    tab.className = "day-tab";
    tab.textContent = DAY_SHORT[day];
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", String(day === selectedDay));
    tab.addEventListener("click", () => selectDay(day));
    tabs.appendChild(tab);
  }
  document.getElementById("selected-day-name").textContent = DAY_LONG[selectedDay];
}

// A "Start walk" button that times the walk and compares it with the prediction.
function createWalkTimer(predictedMinutes) {
  const timer = document.createElement("div");
  timer.className = "walk-timer";
  const button = document.createElement("button");
  button.type = "button";
  const readout = document.createElement("span");
  readout.setAttribute("aria-live", "polite");
  timer.append(button, readout);

  let startedAt = null;
  let tick = null;

  function showIdle() {
    button.textContent = startedAt === null ? "Start walk" : "Walk again";
  }

  button.addEventListener("click", () => {
    if (tick === null) {
      // Timing from a timestamp keeps it right even if the phone sleeps mid-walk.
      startedAt = Date.now();
      readout.textContent = "Walking… 0:00";
      button.textContent = "I've arrived";
      tick = setInterval(() => {
        if (!timer.isConnected) {
          clearInterval(tick);
          return;
        }
        readout.textContent = `Walking… ${formatElapsed((Date.now() - startedAt) / 1000)}`;
      }, 1000);
    } else {
      clearInterval(tick);
      tick = null;
      readout.textContent = compareWalk(predictedMinutes, (Date.now() - startedAt) / 1000);
      showIdle();
    }
  });
  showIdle();
  return timer;
}

let routeGeneration = 0;

async function renderRoutes() {
  const generation = ++routeGeneration;
  const status = document.getElementById("route-status");
  const legList = document.getElementById("leg-list");
  routeLayer.clearLayers();
  legList.innerHTML = "";

  const day = classesOn(selectedDay);
  day.forEach((entry, index) => {
    const building = findBuilding(entry.buildingId);
    L.marker([building.lat, building.lng])
      .bindTooltip(`${index + 1}. ${escapeHtml(classLabel(entry))} · ${formatTime(entry.time)}`)
      .addTo(routeLayer);
  });

  if (day.length < 2) {
    status.textContent =
      day.length === 0
        ? `No classes on ${DAY_LONG[selectedDay]}.`
        : `Only one class on ${DAY_LONG[selectedDay]}, so there are no walks between classes.`;
    if (day.length === 1) {
      const building = findBuilding(day[0].buildingId);
      map.setView([building.lat, building.lng], 17);
    }
    return;
  }
  status.textContent = "Finding walking routes…";

  const legs = await Promise.all(
    day.slice(1).map((entry, index) =>
      fetchWalkingRoute(findBuilding(day[index].buildingId), findBuilding(entry.buildingId)),
    ),
  );
  if (generation !== routeGeneration) return;

  legs.forEach((leg, index) => {
    const from = day[index];
    const to = day[index + 1];
    const color = colorFor(to);
    const walkMinutes = Math.max(1, Math.round(leg.seconds / 60));
    const roomMinutes = to.room ? MINUTES_FROM_ENTRANCE_TO_ROOM : 0;
    const leaveBy = toMinutes(to.time) - walkMinutes - roomMinutes;
    const previousEnds = toMinutes(from.time) + from.lengthMinutes;

    const line = L.polyline(leg.path, { color, weight: 5, opacity: 0.85 }).addTo(routeLayer);
    line.bindTooltip(`${walkMinutes} min walk`, { permanent: true, direction: "center" });

    const item = document.createElement("li");
    item.style.borderLeftColor = color;
    let timing = `Leave by ${formatMinutes(leaveBy)} for ${escapeHtml(classLabel(to))} at ${formatTime(to.time)}`;
    if (roomMinutes) timing += ` (includes ${roomMinutes} min to reach room ${escapeHtml(to.room)})`;
    item.innerHTML =
      `<strong>${escapeHtml(classPlace(from))} → ${escapeHtml(classPlace(to))}</strong>` +
      `<span>${walkMinutes} min walk · ${Math.round(leg.meters)} m${leg.isEstimate ? " (estimate)" : ""}</span>` +
      `<span>${timing}</span>`;
    if (previousEnds > leaveBy) {
      item.innerHTML += `<span class="warning">${escapeHtml(classLabel(from))} ends at ${formatMinutes(previousEnds)}, so you'll be about ${previousEnds - leaveBy} min late.</span>`;
    }
    item.appendChild(createWalkTimer(walkMinutes));
    legList.appendChild(item);
  });

  const anyEstimates = legs.some((leg) => leg.isEstimate);
  status.textContent = anyEstimates
    ? "Couldn't reach the routing service, so some walks are straight-line estimates."
    : "";
  // Frame the walks together with the study spots, so both are visible at once.
  const visibleLayers = [...routeLayer.getLayers(), ...spotLayer.getLayers()];
  map.fitBounds(L.featureGroup(visibleLayers).getBounds(), { padding: [30, 30] });
}

// The Week view shows only your own classes and blocks.
function renderWeek() {
  const week = document.getElementById("week");
  const today = new Date().getDay();
  // On phones only three days fit, starting at the day picked above.
  const days = weekDaysToShow(WEEK_ORDER, selectedDay, PHONE_SCREEN.matches);
  week.style.setProperty("--week-days", days.length);
  let html = '<div class="week-header"><div></div>';
  for (const day of days) {
    const classNames = ["week-day-name"];
    if (day === today) classNames.push("today");
    if (day === selectedDay) classNames.push("selected");
    html += `<button class="${classNames.join(" ")}" data-day="${day}" title="Show walks for ${DAY_LONG[day]}">${DAY_SHORT[day]}</button>`;
  }
  html += '</div><div class="week-body"><div class="week-hours">';
  for (let hour = 0; hour < 24; hour++) {
    html += `<div class="week-hour-label">${formatMinutes(hour * 60).replace(":00", "")}</div>`;
  }
  html += "</div>";
  const placement = (entry) => {
    const start = toMinutes(entry.time);
    const end = Math.min(24 * 60, start + entry.lengthMinutes);
    const top = (start / 60) * HOUR_HEIGHT_PX;
    const height = Math.max(18, ((end - start) / 60) * HOUR_HEIGHT_PX);
    return { start, end, top, height };
  };
  for (const day of days) {
    html += `<div class="week-day${day === today ? " today" : ""}">`;
    // Classes and blocks share lanes, so anything that overlaps sits side by side.
    const items = [
      ...classesOn(day).map((entry) => ({ entry, isBlock: false })),
      ...blocksOn(blocks, day).map((entry) => ({ entry, isBlock: true })),
    ];
    const { lanes, laneCount } = assignLanes(items.map(({ entry }) => placement(entry)));
    const laneWidth = 100 / laneCount;
    items.forEach(({ entry, isBlock }, index) => {
      const { start, end, top, height } = placement(entry);
      const position =
        `top:${top}px;height:${height}px;` +
        `left:calc(${lanes[index] * laneWidth}% + 2px);width:calc(${laneWidth}% - 4px)`;
      const times = `<span>${formatMinutes(start)}–${formatMinutes(end)}</span>`;
      html += isBlock
        ? `<button type="button" class="week-event custom-block${entry.color === DEFAULT_BLOCK_COLOR ? " white-block" : ""}" ` +
          `data-block-id="${escapeHtml(entry.id)}" ` +
          `title="Edit ${escapeHtml(entry.name)}" style="${position};background-color:${entry.color}">` +
          `<strong>${escapeHtml(entry.name)}</strong>${times}</button>`
        : `<button type="button" class="week-event" data-index="${classes.indexOf(entry)}" ` +
          `title="Show details for ${escapeHtml(classLabel(entry))}" style="${position};background:${colorFor(entry)}">` +
          `<strong>${escapeHtml(classLabel(entry))}</strong>${times}` +
          `<span>${escapeHtml(classPlace(entry))}</span></button>`;
    });
    html += "</div>";
  }
  html += "</div>";
  week.innerHTML = html;
  week.querySelectorAll(".week-event:not(.custom-block)").forEach((button) => {
    button.addEventListener("click", () => showClassDetails(classes[Number(button.dataset.index)]));
  });
  week.querySelectorAll(".custom-block").forEach((button) => {
    button.addEventListener("click", () => editBlock(button.dataset.blockId));
  });
  week.querySelectorAll(".week-day-name").forEach((button) => {
    button.addEventListener("click", () => {
      selectDay(Number(button.dataset.day));
      showView("map");
    });
  });
}

function showClassDetails(entry) {
  const dialog = document.getElementById("class-details");
  const start = toMinutes(entry.time);
  document.getElementById("class-details-title").textContent = classLabel(entry);
  document.getElementById("class-details-body").innerHTML =
    `<dt>Where</dt><dd>${escapeHtml(classPlace(entry))}</dd>` +
    `<dt>Meets on</dt><dd>${describeDays(entry.days)}</dd>` +
    `<dt>Time</dt><dd>${formatMinutes(start)}–${formatMinutes(start + entry.lengthMinutes)} ` +
    `(${entry.lengthMinutes} min)</dd>`;
  dialog.showModal();
}

function selectDay(day) {
  selectedDay = day;
  renderDayTabs();
  renderWeek();
  renderRoutes();
  renderSpots();
  renderMeetups();
}

// The hour the study-spot time picker is set to, on the spots' 0–30 hour scale.
function selectedSpotHour() {
  const [hours, minutes] = document.getElementById("spot-time").value.split(":").map(Number);
  return spotHour(hours, minutes);
}

function setSpotTimeToNow() {
  const now = new Date();
  const pad = (number) => String(number).padStart(2, "0");
  document.getElementById("spot-time").value = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

// One collapsible editor in a spot's popup ("Edit hours" or "Edit how full").
// Every editor shares this shape, so one set of page-wide listeners handles them all.
function spotEditor(kind, spotId, title, fieldsHtml, canReset, isOpen) {
  return (
    `<details class="spot-edit"${isOpen ? " open" : ""}><summary>${title}</summary>` +
    `<form class="spot-editor" data-kind="${kind}" data-spot-id="${escapeHtml(spotId)}" novalidate>` +
    fieldsHtml +
    `<p class="editor-message" role="status"></p>` +
    `<div class="editor-actions"><button type="submit">Save</button>` +
    (canReset ? `<button type="button" class="secondary" data-reset>Reset</button>` : "") +
    `</div></form></details>`
  );
}

// Hours may be missing for spots the user added. A note explains anything
// unusual, such as a weekly schedule being replaced by one set of hours.
function hoursEditor(spotId, hours, canReset, note) {
  const fields =
    `<div class="hours-row">` +
    `<label>Opens <input type="time" name="open" value="${hours ? timeValueOf(hours.open) : ""}" /></label>` +
    `<label>Closes <input type="time" name="close" value="${hours ? timeValueOf(hours.close) : ""}" /></label>` +
    `</div>` +
    (note ? `<p class="editor-note">${note}</p>` : "");
  return spotEditor("hours", spotId, "Edit hours", fields, canReset);
}

// "70% full · Filling up" with its color, shown next to the slider as it moves.
function percentPreview(percent) {
  const level = CROWD_LEVELS[crowdLevelFor(percent / 100)];
  return `<span class="swatch" style="background:${level.color}"></span>${percent}% full · ${level.label}`;
}

function fullnessEditor(spotId, percent, canReset, isOpen) {
  const fields =
    `<label>How full is it? <input type="range" name="percent" min="0" max="100" step="5" value="${percent}" /></label>` +
    `<p class="percent-preview">${percentPreview(percent)}</p>`;
  return spotEditor("fullness", spotId, "Edit how full", fields, canReset, isOpen);
}

// The editors at the bottom of every spot's popup. The confirmation line sits
// above them so it stays visible after an editor closes. openFullness starts
// "Edit how full" open, for a spot that was just added.
// includeFullness is false for dining halls, which only have hours.
function popupEditors(
  spotId,
  { hours, canResetHours, hoursNote, percent, canResetPercent, openFullness = false, includeFullness = true },
) {
  return (
    `<p class="spot-saved" role="status"></p>` +
    hoursEditor(spotId, hours, canResetHours, hoursNote) +
    (includeFullness ? fullnessEditor(spotId, percent, canResetPercent, openFullness) : "")
  );
}

const DINING_STATUS_LABELS = { open: "Open now", closed: "Closed now", unset: "Hours not set", break: "Closed" };

// A fork (left) and knife (right), drawn on a 24×24 grid. It takes its color
// from the surrounding text color, so CSS can color it by the hall's status.
const DINING_ICON_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
  '<path d="M5 2h1.4v6h1.1V2h1.4v6H10V2h1.4v6.5c0 1.6-1 2.8-2.4 3.2V22H7.4V11.7C6 11.3 5 10.1 5 8.5Z"/>' +
  '<path d="M17.8 2C15.9 2.6 14.5 5 14.5 8v5.5h1.8V22h1.6V2Z"/>' +
  "</svg>";

function diningPopup(hall, status, closure) {
  const hours = editedHours[hall.id];
  let statusLine = `<span class="dining-status dining-status-${status}">${DINING_STATUS_LABELS[status]}</span>`;
  if (closure) {
    // During a closure the usual hours (if set) are shown as what to expect afterward.
    statusLine +=
      ` through ${formatShortDate(closure.until)}` +
      (hours ? ` · Usually ${hoursText(hours).toLowerCase()}` : "") +
      `<br><small>${escapeHtml(closure.source)}</small>`;
  } else {
    statusLine += hours ? ` · ${hoursText(hours)}` : " · Set them with Edit hours below";
  }
  return (
    `<strong>${escapeHtml(hall.name)}</strong><br>` +
    statusLine +
    `<br><small>${escapeHtml(hall.meals)} · ${escapeHtml(hall.address)}</small>` +
    popupEditors(hall.id, {
      hours,
      canResetHours: Boolean(hours),
      hoursNote: "One opening and closing time per day; gaps between meals aren't shown yet.",
      includeFullness: false,
    })
  );
}

// Dining halls are their own map layer with a fork-and-knife marker: green when
// open at the chosen time, gray when closed (including dated closures such as a
// break), blue until their hours are set.
function renderDiningHalls() {
  diningLayer.clearLayers();
  for (const hall of DINING_HALLS) spotMarkers.delete(hall.id);
  if (!document.getElementById("show-dining").checked) return;
  const hour = selectedSpotHour();
  const date = dateInWeekOf(new Date(), selectedDay);
  for (const hall of DINING_HALLS) {
    const closure = closureOn(hall, date);
    const status = diningHallStatus(editedHours[hall.id], hour, closure);
    const icon = L.divIcon({
      className: `dining-marker dining-marker-${status}`,
      html: DINING_ICON_SVG,
      iconSize: [30, 30],
    });
    const marker = L.marker([hall.lat, hall.lng], { icon, title: hall.name })
      .bindPopup(diningPopup(hall, status, closure))
      .bindTooltip(`${escapeHtml(hall.name)}: ${DINING_STATUS_LABELS[status]}`)
      .addTo(diningLayer);
    spotMarkers.set(hall.id, marker);
  }
}

function hoursText(hours) {
  return hours ? `Open ${formatSpotHour(hours.open)}–${formatSpotHour(hours.close)}` : "Hours not set";
}

function spotPopup(spot, status) {
  const level = CROWD_LEVELS[status.level];
  const hours = spotHoursOn(spot, selectedDay);
  const setByYou = Number.isFinite(spot.fixedPercentFull) ? " (set by you)" : "";
  const seats =
    status.level === "closed"
      ? `Opens ${formatSpotHour(hours.open)}`
      : `${status.freeSeats} of ${spot.seats} seats free · ${status.percentFull}% full${setByYou}`;
  const features = [SPOT_TYPE_LABELS[spot.type], spot.quiet ? "Quiet" : "Lively", spot.outlets ? "Outlets" : "No outlets"];
  if (spot.food) features.push("Food allowed");
  const followsWeek = spot.weeklyHours && !spot.hasEditedHours;
  const hoursNote = editedHours[spot.id] ? " (edited)" : followsWeek ? ` on ${DAY_LONG[selectedDay]}s (varies by day)` : "";
  // While closed there is no current percent, so the slider starts in the middle.
  const percent = spot.fixedPercentFull ?? status.percentFull ?? 50;
  return (
    `<strong>${escapeHtml(spot.name)}</strong><br>` +
    `<span style="color:${level.color};font-weight:600">${level.label}</span> · ${seats}<br>` +
    `<small>${features.join(" · ")} · ${hoursText(hours)}${hoursNote}</small>` +
    `<p class="spot-note">${escapeHtml(spot.note)}</p>` +
    popupEditors(spot.id, {
      hours,
      canResetHours: Boolean(editedHours[spot.id]),
      hoursNote: followsWeek ? "Saving sets these hours for every day of the week. Reset brings back the weekly schedule." : "",
      percent,
      canResetPercent: Number.isFinite(spot.fixedPercentFull),
    })
  );
}

// A spot the user added is colored by how full they said it is while it is open,
// and gray outside the hours they set (if they set any).
function addedSpotLevel(spot, hour) {
  const hours = editedHours[spot.id];
  return hours && !isSpotOpen(hours, hour) ? "closed" : addedSpotCrowdLevel(spot);
}

// "Filling up · 70% full", or just "Closed" outside its hours.
function addedSpotFullness(spot, levelName) {
  const label = CROWD_LEVELS[levelName].label;
  return levelName === "closed" ? label : `${label} · ${spot.percentFull}% full`;
}

function addedSpotPopup(spot, levelName, openFullness = false) {
  const level = CROWD_LEVELS[levelName];
  const hours = editedHours[spot.id];
  return (
    `<strong>${escapeHtml(spot.name)}</strong><br>` +
    `<span style="color:${level.color};font-weight:600">${addedSpotFullness(spot, levelName)}</span> (added by you)<br>` +
    `<small>${hoursText(hours)}</small>` +
    // An added spot always has its own percent, so there is nothing to reset it to.
    popupEditors(spot.id, {
      hours,
      canResetHours: Boolean(hours),
      percent: spot.percentFull,
      canResetPercent: false,
      openFullness,
    })
  );
}

// A copy of an object without one key, used to forget a spot's edits on Reset.
function withoutKey(object, key) {
  const { [key]: _removed, ...rest } = object;
  return rest;
}

// Saves or clears a spot's hours, then redraws and reopens its popup.
function updateSpotHours(spotId, hours, message) {
  editedHours = hours ? { ...editedHours, [spotId]: hours } : withoutKey(editedHours, spotId);
  saveSpotHours();
  applySpotHours(editedHours);
  afterSpotEdit(spotId, message);
}

// Saves how full a spot is (null resets a built-in spot to the sample model),
// then redraws and reopens its popup.
function updateSpotFullness(spotId, percent, message) {
  const added = addedSpots.find((spot) => spot.id === spotId);
  if (added) {
    added.percentFull = percent;
    saveAddedSpots();
  } else {
    editedFullness = percent === null ? withoutKey(editedFullness, spotId) : { ...editedFullness, [spotId]: percent };
    saveSpotFullness();
    applySpotFullness(editedFullness);
  }
  afterSpotEdit(spotId, message);
}

// Redraws everything that depends on a spot, and reopens its popup with the
// editors closed and a message saying the change worked.
function afterSpotEdit(spotId, message) {
  renderSpots();
  renderMeetups();

  const marker = spotMarkers.get(spotId);
  let popup;
  if (marker) {
    marker.openPopup();
    popup = marker.getPopup();
  } else {
    // Filters can hide the dot, for example "Open only" once the spot is closed.
    const spot = STUDY_SPOTS.find((other) => other.id === spotId);
    if (!spot) return;
    popup = L.popup()
      .setLatLng([spot.lat, spot.lng])
      .setContent(spotPopup(spot, spotStatus(spot, selectedDay, selectedSpotHour())))
      .openOn(map);
  }
  // The popup was redrawn with the editors closed; show what changed above them.
  popup.getElement().querySelector(".spot-saved").textContent = message;
}

// Leaflet redraws a popup's contents whenever it reopens, sometimes without any
// event, so the popup editors are handled by listeners on the whole page instead
// of on each form. That way a redrawn form always works.
function setUpSpotEditing() {
  document.addEventListener("submit", (event) => {
    const form = event.target.closest(".spot-editor");
    if (!form) return;
    event.preventDefault();
    const spotId = form.dataset.spotId;
    if (form.dataset.kind === "fullness") {
      const percent = Number(form.elements.percent.value);
      updateSpotFullness(spotId, percent, `Saved: ${percent}% full.`);
      return;
    }
    const hours = hoursFromTimes(form.elements.open.value, form.elements.close.value);
    if (hours.error) {
      const message = form.querySelector(".editor-message");
      message.textContent = hours.error;
      message.classList.add("form-error");
      return;
    }
    updateSpotHours(spotId, hours, `Saved: ${hoursText(hours)}.`);
  });
  document.addEventListener("click", (event) => {
    const form = event.target.closest(".spot-editor");
    if (!form) return;
    if (event.target.closest("[data-reset]")) {
      if (form.dataset.kind === "fullness") updateSpotFullness(form.dataset.spotId, null, "How full reset to the usual pattern.");
      else updateSpotHours(form.dataset.spotId, null, "Hours reset.");
    } else if (event.target.matches('input[type="time"]')) {
      showTimePicker(event.target);
    }
  });
  // Moving the slider updates the color preview next to it.
  document.addEventListener("input", (event) => {
    if (!event.target.matches('.spot-editor input[name="percent"]')) return;
    event.target.closest(".spot-editor").querySelector(".percent-preview").innerHTML = percentPreview(
      Number(event.target.value),
    );
  });
}

function spotMatchesFilters(spot, status) {
  if (spotFilters.openOnly && status.level === "closed") return false;
  if (spotFilters.quiet && !spot.quiet) return false;
  if (spotFilters.outlets && !spot.outlets) return false;
  return true;
}

// Switches to the map and, on narrow screens where the map sits above the
// side panel, scrolls up to it so the user sees what changed.
function revealMap() {
  showView("map");
  const mapTop = document.getElementById("map").getBoundingClientRect().top;
  if (mapTop < 0 || mapTop > window.innerHeight / 2) {
    document.querySelector(".views").scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function showSpotOnMap(spotId) {
  revealMap();
  const marker = spotMarkers.get(spotId);
  if (!marker) return;
  map.setView(marker.getLatLng(), Math.max(map.getZoom(), 17));
  marker.openPopup();
}

function renderSpots() {
  const hour = selectedSpotHour();
  const showOnMap = document.getElementById("show-spots").checked;
  spotLayer.clearLayers();
  spotMarkers.clear();

  const statuses = STUDY_SPOTS.map((spot) => ({ spot, status: spotStatus(spot, selectedDay, hour) }));
  for (const { spot, status } of statuses) {
    if (!showOnMap || !spotMatchesFilters(spot, status)) continue;
    // Bigger spots get slightly bigger dots, so the huge libraries stand out.
    const radius = 7 + Math.min(6, Math.sqrt(spot.seats) / 5);
    const marker = L.circleMarker([spot.lat, spot.lng], {
      radius,
      color: "#ffffff",
      weight: 2,
      fillColor: CROWD_LEVELS[status.level].color,
      fillOpacity: 0.9,
    })
      .bindPopup(spotPopup(spot, status))
      .bindTooltip(`${escapeHtml(spot.name)}: ${CROWD_LEVELS[status.level].label}`)
      .addTo(spotLayer);
    spotMarkers.set(spot.id, marker);
  }
  renderAddedSpots(showOnMap);
  renderDiningHalls();

  const shown = statuses
    .filter(({ spot, status }) => spotMatchesFilters(spot, status))
    .sort((a, b) => b.status.freeSeats - a.status.freeSeats);
  const openCount = statuses.filter(({ status }) => status.level === "open").length;
  document.getElementById("spot-summary").textContent =
    `${DAY_LONG[selectedDay]} at ${formatSpotHour(hour)}: ${openCount} of ${STUDY_SPOTS.length} spots have plenty of room. ` +
    "Seat counts are sample data.";

  const list = document.getElementById("spot-list");
  list.innerHTML = "";
  if (shown.length === 0) {
    list.innerHTML = '<li class="empty">No spots match these filters at this time. Try turning a filter off.</li>';
    return;
  }
  for (const { spot, status } of shown) {
    const level = CROWD_LEVELS[status.level];
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "spot-item";
    button.style.borderLeftColor = level.color;
    button.innerHTML =
      `<strong>${escapeHtml(spot.name)}</strong>` +
      `<span>${level.label}${status.level === "closed" ? "" : ` · ${status.freeSeats} seats free`}</span>` +
      `<span>${SPOT_TYPE_LABELS[spot.type]}${spot.quiet ? " · Quiet" : ""}${spot.outlets ? " · Outlets" : ""}</span>`;
    button.addEventListener("click", () => showSpotOnMap(spot.id));
    item.appendChild(button);
    list.appendChild(item);
  }
}

// Spots the user added are colored by how full they said it is (gray outside any
// hours they set) and ignore the filters, since the app knows nothing about their
// quiet or outlets.
function renderAddedSpots(showOnMap) {
  const hour = selectedSpotHour();
  for (const spot of addedSpots) {
    if (!showOnMap) break;
    const levelName = addedSpotLevel(spot, hour);
    const level = CROWD_LEVELS[levelName];
    const marker = L.circleMarker([spot.lat, spot.lng], {
      radius: 9,
      color: "#0f172a",
      weight: 2,
      dashArray: "3 3",
      fillColor: level.color,
      fillOpacity: 0.9,
    })
      .bindPopup(addedSpotPopup(spot, levelName))
      .bindTooltip(`${escapeHtml(spot.name)}: ${addedSpotFullness(spot, levelName)} (added by you)`)
      .addTo(spotLayer);
    spotMarkers.set(spot.id, marker);
  }

  const list = document.getElementById("added-spot-list");
  list.innerHTML = "";
  if (addedSpots.length === 0) {
    list.innerHTML = '<li class="empty">None yet. Use "+ Add a study spot" on the map.</li>';
    return;
  }
  for (const spot of addedSpots) {
    const levelName = addedSpotLevel(spot, hour);
    const item = document.createElement("li");
    item.className = "added-spot";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "spot-item";
    button.style.borderLeftColor = CROWD_LEVELS[levelName].color;
    button.innerHTML = `<strong>${escapeHtml(spot.name)}</strong><span>${addedSpotFullness(spot, levelName)}</span>`;
    button.addEventListener("click", () => showSpotOnMap(spot.id));
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "remove";
    removeButton.textContent = "Remove";
    removeButton.setAttribute("aria-label", `Remove ${spot.name}`);
    removeButton.addEventListener("click", () => {
      addedSpots = addedSpots.filter((other) => other !== spot);
      saveAddedSpots();
      if (editedHours[spot.id]) {
        editedHours = withoutKey(editedHours, spot.id);
        saveSpotHours();
      }
      renderSpots();
    });
    item.append(button, removeButton);
    list.appendChild(item);
  }
}

// The add-spot form floats in the map's top-right corner. It has three states:
// closed (just the "+ Add a study spot" button), open (the form), and placing
// (a one-line banner, so the rest of the map is free to click).
function setUpAddSpotForm() {
  const control = document.getElementById("add-spot-control");
  const toggle = document.getElementById("add-spot-toggle");
  const form = document.getElementById("add-spot-form");
  const banner = document.getElementById("placing-banner");
  const message = document.getElementById("spot-form-message");
  const mapElement = document.getElementById("map");

  // Without these, clicking or scrolling on the panel would also reach the map
  // underneath: it would pan or zoom the map, or drop the spot under the panel.
  L.DomEvent.disableClickPropagation(control);
  L.DomEvent.disableScrollPropagation(control);
  const AddSpotControl = L.Control.extend({ onAdd: () => control });
  new AddSpotControl({ position: "topright" }).addTo(map);

  function showState(state) {
    toggle.hidden = state !== "closed";
    toggle.setAttribute("aria-expanded", String(state === "open"));
    form.hidden = state !== "open";
    banner.hidden = state !== "placing";
    mapElement.classList.toggle("placing-spot", state === "placing");
  }

  function showMessage(text, isError) {
    message.textContent = text;
    message.className = isError ? "form-error" : "status";
  }

  function cancelPlacing() {
    pendingSpot = null;
    showState("open");
  }

  toggle.addEventListener("click", () => {
    showMessage("", false);
    showState("open");
    document.getElementById("new-spot-name").focus();
  });
  document.getElementById("add-spot-close").addEventListener("click", () => showState("closed"));
  document.getElementById("cancel-placing").addEventListener("click", cancelPlacing);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && pendingSpot) cancelPlacing();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = document.getElementById("new-spot-name").value.trim().slice(0, ADDED_SPOT_NAME_MAX);
    const problem = addedSpotError(name, DEFAULT_ADDED_PERCENT);
    if (problem) {
      showMessage(problem, true);
      return;
    }
    pendingSpot = { name, percentFull: DEFAULT_ADDED_PERCENT };
    document.getElementById("placing-text").textContent = `Click the map where ${name} is.`;
    showState("placing");
    revealMap();
  });

  map.on("click", (event) => {
    if (!pendingSpot) return;
    const spot = {
      id: `added-${Date.now()}`,
      ...pendingSpot,
      lat: Number(event.latlng.lat.toFixed(6)),
      lng: Number(event.latlng.lng.toFixed(6)),
    };
    addedSpots.push(spot);
    saveAddedSpots();
    pendingSpot = null;
    form.reset();
    showState("closed");
    renderSpots();
    // Opening the new spot's details shows right away that it was added, with
    // "Edit how full" already open so the user can set it next. The popup is
    // built open (not opened afterward) so the map makes room for its full height.
    const marker = spotMarkers.get(spot.id);
    if (marker) {
      marker.setPopupContent(addedSpotPopup(spot, addedSpotLevel(spot, selectedSpotHour()), true));
      marker.openPopup();
    }
  });
}

// Opens the browser's time menu when the user clicks anywhere in a time box,
// not only on its small clock icon.
function openPickerOnClick(input) {
  input.addEventListener("click", () => showTimePicker(input));
}

function showTimePicker(input) {
  try {
    input.showPicker();
  } catch {
    // Some browsers have no picker menu; typing the time still works there.
  }
}

// Opens a spot's details on the map as of a given time, even if filters hide its dot.
function showSpotAt(spot, status) {
  revealMap();
  map.setView([spot.lat, spot.lng], Math.max(map.getZoom(), 17));
  L.popup().setLatLng([spot.lat, spot.lng]).setContent(spotPopup(spot, status)).openOn(map);
}

function renderGroups() {
  const list = document.getElementById("group-list");
  list.innerHTML = "";
  if (groups.length === 0) {
    list.innerHTML = '<li class="empty">No groups yet. Make one below.</li>';
    return;
  }
  for (const group of groups) {
    const item = document.createElement("li");
    const members = group.memberIds.map(findFriend);
    const toggle = document.createElement("label");
    toggle.className = "group-toggle";
    toggle.innerHTML =
      `<input type="checkbox" ${group.shown ? "checked" : ""} />` +
      `<span><strong>${escapeHtml(group.name)}</strong>` +
      `<span class="members">${members
        .map((friend) => `<span class="swatch" style="background:${friend.color}"></span>${escapeHtml(friend.name)}`)
        .join(" ")}</span></span>`;
    toggle.querySelector("input").addEventListener("change", (event) => {
      group.shown = event.target.checked;
      saveGroups();
      renderMeetups();
    });
    const removeButton = document.createElement("button");
    removeButton.className = "remove";
    removeButton.textContent = "Remove";
    removeButton.setAttribute("aria-label", `Remove group ${group.name}`);
    removeButton.addEventListener("click", () => {
      groups = groups.filter((other) => other !== group);
      saveGroups();
      render();
    });
    item.append(toggle, removeButton);
    list.appendChild(item);
  }
}

function formatWindow(window) {
  if (window.start === 0 && window.end === 24 * 60) return "All day";
  const end = window.end === 24 * 60 ? "midnight" : formatMinutes(window.end);
  return `${formatMinutes(window.start)}–${end}`;
}

function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

function renderMeetups() {
  document.getElementById("meetup-day-name").textContent = DAY_LONG[selectedDay];
  const list = document.getElementById("meetup-list");
  list.innerHTML = "";
  const shown = groups.filter((group) => group.shown);
  if (shown.length === 0) {
    list.innerHTML = '<li class="empty">Check a friend group above to see when you can meet up.</li>';
    return;
  }
  for (const group of shown) {
    const members = group.memberIds.map(findFriend);
    const schedules = [classes, ...members.map((friend) => friend.classes)];
    const windows = sharedFreeWindows(schedules, selectedDay);
    const people = namesList(["You", ...members.map((friend) => friend.name)]);
    if (windows.length === 0) {
      const item = document.createElement("li");
      item.innerHTML =
        `<strong>${escapeHtml(group.name)}</strong>` +
        `<span>No shared free time of ${MEETUP_MIN_MINUTES} min or more.</span>`;
      list.appendChild(item);
      continue;
    }
    for (const window of windows) {
      const item = document.createElement("li");
      item.style.borderLeftColor = members[0].color;
      item.innerHTML =
        `<strong>${escapeHtml(group.name)} · ${formatWindow(window)}</strong>` +
        `<span>${escapeHtml(people)} are free for ${formatDuration(window.end - window.start)}</span>`;
      const match = meetupSpot(schedules, selectedDay, window.start, window.end);
      if (match) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "secondary meetup-spot";
        const when = match.minute === window.start ? "" : ` from ${formatMinutes(match.minute)}`;
        button.textContent = `Meet at ${match.spot.name}${when} · ${match.status.freeSeats} seats free`;
        button.addEventListener("click", () => showSpotAt(match.spot, match.status));
        item.appendChild(button);
      } else {
        item.insertAdjacentHTML("beforeend", "<span>Every study spot is closed during this time.</span>");
      }
      list.appendChild(item);
    }
  }
}

function renderLeaderboard() {
  // Rebuild the group picker, since groups can be made or removed.
  const select = document.getElementById("leaderboard-group");
  if (!groups.some((group) => group.id === leaderboardGroupId)) leaderboardGroupId = ALL_FRIENDS_OPTION;
  select.innerHTML = `<option value="${ALL_FRIENDS_OPTION}">All friends</option>`;
  for (const group of groups) {
    const option = document.createElement("option");
    option.value = group.id;
    option.textContent = group.name;
    select.appendChild(option);
  }
  select.value = leaderboardGroupId;

  const group = groups.find((other) => other.id === leaderboardGroupId);
  const friends = group ? group.memberIds.map(findFriend) : SAMPLE_FRIENDS;
  const people = [
    { id: "you", name: "You", color: "var(--accent)", stats: SAMPLE_WALK_STATS.you },
    ...friends.map((friend) => ({ id: friend.id, name: friend.name, color: friend.color, stats: SAMPLE_WALK_STATS[friend.id] })),
  ];
  const ranked = rankPeople(people);
  const best = ranked[0].score || 1;

  const list = document.getElementById("leaderboard-list");
  list.innerHTML = "";
  for (const person of ranked) {
    const item = document.createElement("li");
    if (person.id === "you") item.className = "me";
    item.innerHTML =
      `<span class="place">${person.place}</span>` +
      `<span class="who"><span class="swatch" style="background:${person.color}"></span>${escapeHtml(person.name)}</span>` +
      `<span class="value">${describeOnTime(person.stats)}</span>` +
      `<span class="bar" style="width:${Math.round((person.score / best) * 100)}%;background:${person.color}"></span>`;
    list.appendChild(item);
  }
}

function setUpLeaderboard() {
  document.getElementById("leaderboard-group").addEventListener("change", (event) => {
    leaderboardGroupId = event.target.value;
    renderLeaderboard();
  });
}

function setUpGroupForm() {
  const friendBoxes = document.getElementById("new-group-friends");
  for (const friend of SAMPLE_FRIENDS) {
    const label = document.createElement("label");
    label.className = "day-checkbox";
    label.innerHTML =
      `<input type="checkbox" value="${friend.id}" />` +
      `<span class="swatch" style="background:${friend.color}"></span>${escapeHtml(friend.name)}`;
    friendBoxes.appendChild(label);
  }

  document.getElementById("new-group-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const error = document.getElementById("group-error");
    const name = document.getElementById("new-group-name").value.trim();
    const memberIds = [...friendBoxes.querySelectorAll("input:checked")].map((box) => box.value);
    if (!name) {
      error.textContent = "Give the group a name.";
      return;
    }
    if (memberIds.length === 0) {
      error.textContent = "Pick at least one friend.";
      return;
    }
    error.textContent = "";
    groups.push({ id: `group-${Date.now()}`, name, memberIds, shown: true });
    saveGroups();
    event.target.reset();
    render();
  });
}

function setUpSpotControls() {
  setSpotTimeToNow();
  openPickerOnClick(document.getElementById("spot-time"));
  const legend = document.getElementById("spot-legend");
  for (const level of Object.values(CROWD_LEVELS)) {
    const item = document.createElement("li");
    item.innerHTML = `<span class="swatch" style="background:${level.color}"></span>${level.label}`;
    legend.appendChild(item);
  }
  const diningItem = document.createElement("li");
  diningItem.innerHTML = `<span class="dining-legend">${DINING_ICON_SVG}</span>Dining hall`;
  legend.appendChild(diningItem);
  document.getElementById("spot-time").addEventListener("input", (event) => {
    if (event.target.value) renderSpots();
  });
  document.getElementById("spot-now").addEventListener("click", () => {
    setSpotTimeToNow();
    renderSpots();
  });
  document.getElementById("show-spots").addEventListener("change", renderSpots);
  document.getElementById("show-dining").addEventListener("change", renderDiningHalls);
  document.querySelectorAll(".spot-filters .chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const name = chip.dataset.filter;
      spotFilters = { ...spotFilters, [name]: !spotFilters[name] };
      chip.setAttribute("aria-pressed", String(spotFilters[name]));
      renderSpots();
    });
  });
}

// Each view's tab and the parts of the page that belong to it.
// The List tab (Switch C) only shows on phones, where it shows the side panel
// that style.css hides on every other tab. It keeps the map's parts turned on
// and lets the phone styles hide them, so if the screen becomes wide while on
// List, the map is still there beside the panel.
const VIEWS = {
  map: { tab: "map-tab", parts: ["spot-bar", "map"] },
  list: { tab: "list-tab", parts: ["spot-bar", "map"] },
  week: { tab: "week-tab", parts: ["block-form-details", "week"] },
  groups: { tab: "groups-tab", parts: ["groups-view"] },
  leaderboard: { tab: "leaderboard-tab", parts: ["leaderboard-view"] },
};

function showView(view) {
  const shownParts = VIEWS[view].parts;
  for (const [name, { tab, parts }] of Object.entries(VIEWS)) {
    document.getElementById(tab).setAttribute("aria-selected", String(name === view));
    for (const part of parts) document.getElementById(part).hidden = !shownParts.includes(part);
  }
  // style.css uses this to show the side panel only on the List tab on phones.
  document.body.dataset.view = view;
  if (view === "map") {
    map.invalidateSize();
  } else if (view === "week") {
    const week = document.getElementById("week");
    if (!week.dataset.scrolled) {
      week.scrollTop = FIRST_VISIBLE_HOUR * HOUR_HEIGHT_PX;
      week.dataset.scrolled = "true";
    }
  }
}

function render() {
  renderClassList();
  renderDayTabs();
  renderWeek();
  renderRoutes();
  renderSpots();
  renderGroups();
  renderMeetups();
  renderLeaderboard();
}

function setUpForm() {
  const select = document.getElementById("new-building");
  for (const building of BUILDINGS) {
    const option = document.createElement("option");
    option.value = building.id;
    option.textContent = building.name;
    select.appendChild(option);
  }

  openPickerOnClick(document.getElementById("new-time"));

  const dayBoxes = document.getElementById("new-days");
  for (const day of WEEK_ORDER) {
    const label = document.createElement("label");
    label.className = "day-checkbox";
    label.innerHTML = `<input type="checkbox" value="${day}" /> ${DAY_SHORT[day]}`;
    dayBoxes.appendChild(label);
  }

  document.getElementById("add-class-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const error = document.getElementById("form-error");
    const time = document.getElementById("new-time").value;
    const lengthMinutes = Number(document.getElementById("new-length").value);
    const days = [...dayBoxes.querySelectorAll("input:checked")].map((box) => Number(box.value));

    if (days.length === 0) {
      error.textContent = "Pick at least one day.";
      return;
    }
    if (!time) {
      error.textContent = "Enter a start time.";
      return;
    }
    if (!Number.isFinite(lengthMinutes) || lengthMinutes < 5 || lengthMinutes > 600) {
      error.textContent = "Length must be between 5 and 600 minutes.";
      return;
    }
    error.textContent = "";

    classes.push({
      course: document.getElementById("new-course").value.trim(),
      buildingId: select.value,
      room: document.getElementById("new-room").value.trim(),
      days,
      time,
      lengthMinutes,
    });
    saveClasses();
    event.target.reset();
    render();
  });
}

function saveBlocks() {
  saveToStorage(BLOCKS_STORAGE_KEY, blocks);
}

function showBlockMessage(text, isError) {
  const message = document.getElementById("block-message");
  message.textContent = text;
  message.className = isError ? "form-error" : "status";
}

// Puts the block form back to "Add" mode with empty fields.
function resetBlockForm() {
  editingBlockId = null;
  document.getElementById("block-form").reset();
  document.getElementById("block-form-title").textContent = "Add a block (gym, work, study time…)";
  document.getElementById("block-submit").textContent = "Add block";
  document.getElementById("block-remove").hidden = true;
  document.getElementById("block-cancel").hidden = true;
}

// Loads a block into the form to change or remove it, and opens the form.
function editBlock(blockId) {
  const block = blocks.find((other) => other.id === blockId);
  if (!block) return;
  editingBlockId = block.id;
  document.getElementById("block-name").value = block.name;
  document.querySelectorAll("#block-days input").forEach((box) => {
    box.checked = block.days.includes(Number(box.value));
  });
  document.getElementById("block-time").value = block.time;
  document.getElementById("block-length").value = block.lengthMinutes;
  document.getElementById("block-form-title").textContent = `Editing ${block.name}`;
  document.getElementById("block-submit").textContent = "Save changes";
  document.getElementById("block-remove").hidden = false;
  document.getElementById("block-cancel").hidden = false;
  showBlockMessage("", false);
  const details = document.getElementById("block-form-details");
  details.open = true;
  details.scrollIntoView({ behavior: "smooth", block: "nearest" });
  document.getElementById("block-name").focus();
}

function setUpBlockForm() {
  const dayBoxes = document.getElementById("block-days");
  for (const day of WEEK_ORDER) {
    const label = document.createElement("label");
    label.className = "day-checkbox";
    label.innerHTML = `<input type="checkbox" value="${day}" /> ${DAY_SHORT[day]}`;
    dayBoxes.appendChild(label);
  }
  openPickerOnClick(document.getElementById("block-time"));

  document.getElementById("block-form").addEventListener("submit", (event) => {
    event.preventDefault();
    // New blocks are white; a block being edited keeps the color it already has.
    const editing = blocks.find((other) => other.id === editingBlockId);
    const block = {
      id: editingBlockId ?? `block-${Date.now()}`,
      name: document.getElementById("block-name").value.trim().slice(0, BLOCK_NAME_MAX),
      days: [...dayBoxes.querySelectorAll("input:checked")].map((box) => Number(box.value)),
      time: document.getElementById("block-time").value,
      lengthMinutes: Number(document.getElementById("block-length").value),
      color: editing?.color ?? DEFAULT_BLOCK_COLOR,
    };
    const problem = blockError(block);
    if (problem) {
      showBlockMessage(problem, true);
      return;
    }
    const wasEditing = editingBlockId !== null;
    blocks = wasEditing ? blocks.map((other) => (other.id === block.id ? block : other)) : [...blocks, block];
    saveBlocks();
    resetBlockForm();
    showBlockMessage(wasEditing ? `Saved ${block.name}.` : `Added ${block.name} to your week.`, false);
    renderWeek();
  });

  document.getElementById("block-remove").addEventListener("click", () => {
    const removed = blocks.find((block) => block.id === editingBlockId);
    blocks = blocks.filter((block) => block.id !== editingBlockId);
    saveBlocks();
    resetBlockForm();
    showBlockMessage(removed ? `Removed ${removed.name}.` : "", false);
    renderWeek();
  });

  document.getElementById("block-cancel").addEventListener("click", () => {
    resetBlockForm();
    showBlockMessage("", false);
  });
}

// Each side panel section folds open and closed from its title. The folded ones
// are remembered so the panel looks the same after a reload.
function setUpPanelSections() {
  const sections = document.querySelectorAll(".panel-section");
  const folded = new Set(loadSaved(FOLDED_SECTIONS_STORAGE_KEY, parseFoldedSections));
  for (const section of sections) {
    section.open = !folded.has(section.dataset.section);
    section.addEventListener("toggle", () => {
      const nowFolded = [...sections].filter((other) => !other.open).map((other) => other.dataset.section);
      saveToStorage(FOLDED_SECTIONS_STORAGE_KEY, nowFolded);
    });
  }
}

function parseFoldedSections(json) {
  try {
    const saved = JSON.parse(json);
    return Array.isArray(saved) ? saved.filter((name) => typeof name === "string") : [];
  } catch {
    return [];
  }
}

function setUpThemeToggle() {
  const toggle = document.getElementById("theme-toggle");
  // The words sit in their own span so phones can show only the icon;
  // the aria-label keeps the full name for screen readers either way.
  const showLabel = () => {
    const isDark = currentTheme() === "dark";
    const label = isDark ? "Light mode" : "Dark mode";
    toggle.innerHTML = `<span aria-hidden="true">${isDark ? "☀" : "☾"}</span><span class="theme-label"> ${label}</span>`;
    toggle.setAttribute("aria-label", `Switch to ${label.toLowerCase()}`);
    toggle.setAttribute("aria-pressed", String(isDark));
  };
  toggle.addEventListener("click", () => {
    setTheme(currentTheme() === "dark" ? "light" : "dark");
    showLabel();
  });
  // Keep the label right if the device switches themes while the page is open.
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", showLabel);
  showLabel();
}

for (const [name, { tab }] of Object.entries(VIEWS)) {
  document.getElementById(tab).addEventListener("click", () => showView(name));
}

setUpForm();
setUpSpotControls();
setUpAddSpotForm();
setUpSpotEditing();
setUpGroupForm();
setUpLeaderboard();
setUpThemeToggle();
setUpPanelSections();
setUpBlockForm();
// Turning a phone sideways (or resizing a window) can switch between the phone
// and wide layouts, which changes how many days the Week view shows. The List
// tab doesn't exist on wide screens (the panel is always beside the map), so
// leaving the phone layout while on it goes back to the map.
PHONE_SCREEN.addEventListener("change", () => {
  if (!PHONE_SCREEN.matches && document.body.dataset.view === "list") showView("map");
  renderWeek();
});
showView("map");
// The map only measures its box when asked, so it re-measures whenever the box
// changes size: after the phone layout settles, on rotation, or on resize.
// Without this, part of the map stays blank.
new ResizeObserver(() => map.invalidateSize()).observe(document.getElementById("map"));
render();
