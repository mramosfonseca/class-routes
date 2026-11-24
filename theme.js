// Light and dark mode. This file loads in <head> so the saved choice applies
// before the page draws, and the page never flashes the wrong colors.
// With no saved choice, the page follows the device's own setting.

const THEME_KEY = "class-routes.theme";

function savedTheme() {
  try {
    const theme = localStorage.getItem(THEME_KEY);
    return theme === "light" || theme === "dark" ? theme : null;
  } catch {
    return null;
  }
}

function currentTheme() {
  const chosen = document.documentElement.dataset.theme;
  if (chosen) return chosen;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Storage unavailable: the theme still applies for this visit.
  }
}

const initialTheme = savedTheme();
if (initialTheme) document.documentElement.dataset.theme = initialTheme;
