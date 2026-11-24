// Layout helpers for the Week view.

// How many days fit side by side on a phone-width screen.
const PHONE_WEEK_DAYS = 3;

// Which days the Week view shows, in order: every day on wider screens, or on
// phones three days in a row starting at the selected one. Near the end of the
// week it shifts back so it always shows three (Sat → Fri, Sat, Sun).
function weekDaysToShow(weekOrder, selectedDay, isPhone) {
  if (!isPhone) return weekOrder;
  const index = Math.max(0, weekOrder.indexOf(selectedDay));
  const start = Math.min(index, weekOrder.length - PHONE_WEEK_DAYS);
  return weekOrder.slice(start, start + PHONE_WEEK_DAYS);
}
