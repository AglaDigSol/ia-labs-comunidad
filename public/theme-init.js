(function () {
  try {
    var p = localStorage.getItem("theme") || "system";
    var d = p === "dark" || (p === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    var r = document.documentElement;
    r.dataset.theme = d ? "dark" : "light";
    r.classList.toggle("dark", d);
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.content = d ? "#0E1320" : "#F3F5F9";
  } catch {
    // Ignore storage or media-query errors in restricted environments.
  }
})();
