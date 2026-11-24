// University Housing's all-you-care-to-eat dining halls, shown as their own map
// layer. Names, addresses and meals come from housing.illinois.edu/dine/locations
// (read 2026-11-23). Housing's site does not list their hours (it points to the
// Illinois app), so hours start unset and the user fills them in from each popup.
// Map locations are placed by hand from the street addresses.

// Dates when the halls are closed no matter their usual hours. On Nov 23, 2026,
// Housing's menu page showed every hall as "Closed ⋅ Closed for the next two
// weeks." with no reopening date, so this closure runs two weeks from that day.
const DINING_BREAK_CLOSURE = {
  from: "2026-11-23",
  until: "2026-12-06",
  source: 'Housing\'s menu page on Nov 23, 2026: "Closed for the next two weeks."',
};

const DINING_HALLS = [
  { id: "dining-ikenberry", name: "Ikenberry Dining Center", address: "301 E. Gregory Dr., Champaign", lat: 40.1037, lng: -88.2353, meals: "Breakfast, lunch, late lunch and dinner", closures: [DINING_BREAK_CLOSURE] },
  { id: "dining-isr", name: "ISR Dining Center", address: "1010 W. Illinois St., Urbana", lat: 40.1106, lng: -88.2222, meals: "Breakfast, lunch, late lunch and dinner", closures: [DINING_BREAK_CLOSURE] },
  { id: "dining-lar", name: "Lincoln/Allen Dining Hall", address: "1005 S. Lincoln Ave., Urbana", lat: 40.1046, lng: -88.2191, meals: "Lunch and dinner, with a Kosher Kitchen", closures: [DINING_BREAK_CLOSURE] },
  { id: "dining-par", name: "PAR Dining Hall", address: "906 W. College Ct., Urbana", lat: 40.1025, lng: -88.2222, meals: "Breakfast, lunch and dinner", closures: [DINING_BREAK_CLOSURE] },
];

// A date as "YYYY-MM-DD" in local time, which compares correctly as text.
function isoDate(date) {
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// The app's day tabs are days of the week; this gives the real date a tab
// stands for: that weekday (0 = Sunday) in the Monday–Sunday week containing today.
function dateInWeekOf(today, day) {
  const daysSinceMonday = (today.getDay() + 6) % 7;
  const daysFromMonday = (day + 6) % 7;
  return isoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysSinceMonday + daysFromMonday));
}

// The closure covering a date, or null if the hall is not closed that day.
function closureOn(hall, date) {
  return hall.closures.find((closure) => date >= closure.from && date <= closure.until) ?? null;
}

// "Sun, Dec 6" for a "YYYY-MM-DD" date.
function formatShortDate(date) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

// Whether a dining hall is open at an hour on the spots' 0–30 hour scale:
// "break" during a closure, otherwise "unset" until the user gives it hours,
// then "open" or "closed".
function diningHallStatus(hours, hour, closure = null) {
  if (closure) return "break";
  if (!hours) return "unset";
  return isSpotOpen(hours, hour) ? "open" : "closed";
}
