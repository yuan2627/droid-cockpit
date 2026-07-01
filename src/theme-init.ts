try {
  const theme = localStorage.getItem("droid-cockpit-theme");
  const resolved = theme === "system"
    ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : theme === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", resolved);
} catch {
  document.documentElement.setAttribute("data-theme", "light");
}
