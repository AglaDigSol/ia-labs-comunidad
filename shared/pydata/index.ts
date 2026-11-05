// Conjuntos de datos sintéticos para los ejercicios de Python de 01MIAR (temas 8 a 13) y el simulacro.
// Todo es TypeScript puro, determinista con la semilla y original: artículos genéricos, lugares y
// personas con nombres inventados y códigos de país del rango de uso privado.
//
// Cada generador devuelve el CSV (para escribirlo en la carpeta de trabajo con la API de archivos,
// p. ej. como ejercicio/caso1/ventas.csv) y los hechos para corregir cada paso de la limpieza, calculados
// aquí con la receta *_PIPELINE de pandas. Las pruebas (tests/pydata.test.ts) los comprueban con pandas de
// verdad cuando el python3 del sistema lo tiene.
//
//   dirtySales(seed, { rows, corruption, items, promo })  → ventas.csv y SalesFacts
//   incidents(seed, { rows, places, outOfRange, … })      → incidencias.csv, paises.csv e IncidentFacts
//   sensors(seed, { rows, sensors, k })                   → sensores.csv y SensorFacts
//   movieList(seed, n, hyphen) · grades(seed, n) · inventory(seed, n) → tablas pequeñas
export { countBy, isIsoDate, isNumeric, npRound, PANDAS_NA, sortedRecord, toCsv, type Table } from "./csv.ts";
export { BRANCHES, CATEGORIES, countryCodes, ITEMS, messy, PAYMENTS, personNames, placeNames, titles } from "./names.ts";
export {
  dirtySales,
  salesFacts,
  SALES_COLUMNS,
  SALES_NUMERIC,
  SALES_PIPELINE,
  SALES_TOKENS,
  type SalesColumn,
  type SalesDataset,
  type SalesFacts,
  type SalesOptions,
} from "./sales.ts";
export {
  incidentFacts,
  incidents,
  INCIDENT_COLUMNS,
  INCIDENTS_PIPELINE,
  LOOKUP_COLUMNS,
  type IncidentColumn,
  type IncidentDataset,
  type IncidentFacts,
  type IncidentOptions,
} from "./incidents.ts";
export { interpolateColumn, sensors, SENSORS_PIPELINE, type SensorDataset, type SensorFacts, type SensorOptions, type SensorProfile } from "./sensors.ts";
export { GRADE_COLUMNS, grades, INVENTORY_COLUMNS, inventory, movieList, type GradeFacts, type InventoryFacts, type MovieFacts } from "./small.ts";
