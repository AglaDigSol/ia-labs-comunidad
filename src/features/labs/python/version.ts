// Versión de Pyodide, en un módulo aparte y sin nada más: la importan la configuración (que va en el
// chunk de entrada de la app anfitriona, vía configureLabs) y packages.ts. Así la lista de wheels
// extra se queda en el chunk perezoso de la pestaña Python.

/** Versión de Pyodide (y de su npm). Python 3.12.7: los cuadernos del curso declaran 3.12. */
export const PYODIDE_VERSION = "0.27.7";
export const PYODIDE_PYTHON = "3.12.7";
