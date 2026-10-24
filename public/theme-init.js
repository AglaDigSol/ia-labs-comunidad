// Aplica el tema guardado antes de pintar la página (evita el destello claro en modo oscuro).
// Es un fichero externo para cumplir la CSP (script-src 'self', sin scripts inline).
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
    // almacenamiento no disponible: tema del sistema
  }
})();
