// Textos de la interfaz en español (idioma por defecto). Para añadir otro idioma, crea un fichero con
// las mismas claves (por ejemplo en.ts, tipado como Messages) y regístralo en src/i18n/index.ts.
// Pendiente: los textos internos de los laboratorios, las flashcards y la calculadora siguen en sus
// componentes; se irán moviendo aquí (ver CONTRIBUTING.md, «Textos e idiomas»).
export const es = {
  app: {
    name: "IA Labs · Comunidad",
    tagline: "Laboratorios del Máster en IA",
    disclaimer:
      "Proyecto comunitario de estudiantes del Máster en IA. No oficial ni afiliado a la Universidad Internacional de Valencia (VIU).",
    licenses: "Código abierto (MIT) y contenido CC BY 4.0",
    contribute: "Contribuye en GitHub",
    loading: "Cargando…",
  },
  nav: {
    main: "Principal",
    skip: "Saltar al contenido",
    home: "Inicio",
    homeShort: "Inicio",
    labs: "Laboratorios",
    labsShort: "Labs",
    flashcards: "Flashcards",
    flashcardsShort: "Tarjetas",
    calendar: "Calendario",
    calendarShort: "Agenda",
    grades: "Notas",
    gradesShort: "Notas",
    settings: "Ajustes",
    settingsShort: "Ajustes",
  },
  home: {
    title: "Inicio",
    intro: "Qué viene ahora y por dónde seguir.",
    continueTitle: "Continuar",
    lastLab: "Último laboratorio:",
    lastExercise: "Último ejercicio:",
    continueAction: "Continuar",
    firstVisit: "Aún no has abierto ningún laboratorio en este dispositivo. Empieza por la simbología: cómo se lee cada símbolo en clase.",
    startAction: "Empezar por Simbología",
    reviewTitle: "Repaso de hoy",
    nextTitle: "Próximo en el calendario",
    communityTitle: "Comunidad",
    communityText: "El espacio de la comunidad de estudiantes del máster.",
    communityAction: "Abrir la comunidad",
  },
  theme: {
    label: "Tema",
    light: "Claro",
    system: "Sistema",
    dark: "Oscuro",
  },
  settings: {
    title: "Ajustes",
    themeTitle: "Tema",
    cardsTitle: "Flashcards",
    newPerDay: "Nuevas por día",
    newPerDayHelp: (def: number) =>
      `Tarjetas nuevas que cada mazo te presenta al día (por defecto, ${def}). Si un mazo se queda sin nuevas por hoy, puedes pedir 5 más desde la lista de mazos.`,
    newPerDayError: (min: number, max: number) => `Escribe un número entero entre ${min} y ${max}.`,
    dataTitle: "Mis datos",
    dataIntro:
      "Tus flashcards, su calendario de repaso, tus notas y tus preferencias se guardan solo en este navegador. No se envían a ningún servidor. Exporta una copia para pasarlas a otro dispositivo o por si borras los datos del navegador.",
    export: "Exportar mis datos",
    import: "Importar mis datos",
    importFileLabel: "Archivo de copia (JSON)",
    importMode: "Al importar",
    importMerge: "Combinar con los datos actuales",
    importReplace: "Sustituir todos los datos actuales",
    exported: (n: string) => `Copia descargada: ${n}.`,
    imported: (n: string) => `Importados ${n}.`,
    skipped: (n: string) => ` Descartados por no ser válidos: ${n}.`,
    tooBig: (mb: number) => `El archivo es demasiado grande (máximo ${mb} MB).`,
    invalidFile: "El archivo no es una copia válida de IA Labs · Comunidad.",
    entries: (n: number) => (n === 1 ? "1 dato" : `${n} datos`),
    clear: "Borrar mis datos",
    clearTitle: "¿Borrar todos tus datos?",
    clearBody:
      "Se borran tus flashcards, su calendario, tus notas y tus preferencias de este navegador. No se puede deshacer: exporta antes una copia si la quieres conservar.",
    clearConfirm: "Borrar",
    cancel: "Cancelar",
    cleared: "Datos borrados.",
    privacyTitle: "Privacidad",
    privacyBody:
      "Sin analítica, sin rastreadores y sin recursos de terceros: todo se sirve desde este sitio. El sitio no usa cookies: tus datos se guardan solo en el almacenamiento local de este navegador.",
  },
  calendar: {
    title: "Calendario",
    notice: "Calendario orientativo, no oficial. Manda lo que publique OnCampus/Blackboard.",
  },
  grades: {
    notice: "Orientativa, no oficial; manda la guía docente vigente.",
    source: (citation: string, year: string, checked: string) =>
      `Pesos según ${citation} (curso ${year}), revisados el ${checked}.`,
  },
} as const;

type Widen<T> = T extends (...args: infer A) => infer R
  ? (...args: A) => R
  : T extends string
    ? string
    : { [K in keyof T]: Widen<T[K]> };

export type Messages = Widen<typeof es>;
