// Plantillas de la pestaña Python: ejercicios genéricos de 01MIAR (Python para la IA) con datos de
// juguete escritos en el propio código o en un archivo que la plantilla crea si no lo has subido.
// Nunca contienen, ni pretenden ser, la respuesta de una actividad evaluable.

export type TemplateId =
  | "blank"
  | "tipos"
  | "control"
  | "funciones"
  | "generadores"
  | "ficheros"
  | "numpy"
  | "vectorizacion"
  | "minmax"
  | "pandas"
  | "pandas-csv"
  | "seaborn"
  | "perceptron";

export type Template = { id: TemplateId; label: string; code: string };

const BLANK = String.raw`# Escribe aquí tu código Python. Ctrl/Cmd+Enter lo ejecuta.
`;

const MINMAX = String.raw`# Min-Max: escalar datos al intervalo [0, 1]
# Fórmula: x' = (x - min) / (max - min)
import numpy as np
import matplotlib.pyplot as plt

# Datos de ejemplo en línea: alturas en cm
x = np.array([152.0, 160.5, 171.2, 165.0, 180.3, 158.7, 175.4, 190.1])

# 1) A mano, con bucles: primero el mínimo y el máximo
minimo = x[0]
maximo = x[0]
for valor in x:
    if valor < minimo:
        minimo = valor
    if valor > maximo:
        maximo = valor

# Después, cada valor escalado (si max == min, la fórmula dividiría entre 0)
escalado_bucle = []
for valor in x:
    escalado_bucle.append((valor - minimo) / (maximo - minimo))
escalado_bucle = np.array(escalado_bucle)

# 2) Versión vectorizada con NumPy, para comprobar el resultado
escalado_np = (x - x.min()) / (x.max() - x.min())

print("Mínimo:", minimo, "| Máximo:", maximo)
print("Escalado (bucle):", np.round(escalado_bucle, 3))
print("Escalado (NumPy):", np.round(escalado_np, 3))
print("¿Coinciden?", np.allclose(escalado_bucle, escalado_np))
print("Rango final:", escalado_np.min(), "a", escalado_np.max())

# 3) Antes y después
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(8, 3))
ax1.bar(range(len(x)), x, color="tab:blue")
ax1.set_title("Antes (cm)")
ax2.bar(range(len(x)), escalado_np, color="tab:orange")
ax2.set_title("Después, en [0, 1]")
ax2.set_ylim(0, 1.05)
fig.tight_layout()
plt.show()
`;

const PERCEPTRON = String.raw`# PerceptronSimple: clasificador lineal entrenado con la regla del perceptrón
# Regla de actualización: w ← w + η(y − ŷ)x   (y el sesgo: b ← b + η(y − ŷ))
import numpy as np
import matplotlib.pyplot as plt


class PerceptronSimple:
    def __init__(self, eta=0.1, epocas=20):
        self.eta = eta
        self.epocas = epocas

    def fit(self, X, y):
        # Pesos y sesgo empiezan en cero
        self.w = np.zeros(X.shape[1])
        self.b = 0.0
        self.errores = []
        for _ in range(self.epocas):
            fallos = 0
            for xi, yi in zip(X, y):
                delta = self.eta * (yi - self.predict(xi))
                self.w = self.w + delta * xi
                self.b = self.b + delta
                fallos += int(delta != 0.0)
            self.errores.append(fallos)
        return self

    def predict(self, X):
        # Función escalón: 1 si w·x + b >= 0; si no, 0
        return np.where(np.dot(X, self.w) + self.b >= 0.0, 1, 0)


# Tabla de verdad AND
X = np.array([[0, 0], [0, 1], [1, 0], [1, 1]])
y = np.array([0, 0, 0, 1])

modelo = PerceptronSimple(eta=0.1, epocas=20).fit(X, y)
predicciones = modelo.predict(X)
exactitud = np.mean(predicciones == y)

print("Pesos w:", modelo.w)
print("Sesgo b:", round(float(modelo.b), 3))
print("Predicciones:", predicciones)
print("Exactitud:", exactitud)
print("Errores por época:", modelo.errores)

# Frontera de decisión: w1·x1 + w2·x2 + b = 0
fig, ax = plt.subplots(figsize=(4, 4))
for clase, color in [(0, "tab:red"), (1, "tab:blue")]:
    puntos = X[y == clase]
    ax.scatter(puntos[:, 0], puntos[:, 1], c=color, s=80, label=f"clase {clase}")
x1 = np.linspace(-0.5, 1.5, 50)
if modelo.w[1] != 0:
    ax.plot(x1, -(modelo.w[0] * x1 + modelo.b) / modelo.w[1], "k--", label="frontera")
ax.set_xlim(-0.5, 1.5)
ax.set_ylim(-0.5, 1.5)
ax.set_xlabel("x1")
ax.set_ylabel("x2")
ax.legend()
plt.show()
`;

const VECTORIZACION = String.raw`# Vectorización con NumPy: bucle de Python frente a operaciones vectorizadas
import time
import numpy as np

# Datos generados (semilla fija para repetir los resultados)
rng = np.random.default_rng(42)
n = 200_000
a = rng.random(n)
b = rng.random(n)

# 1) Producto escalar con un bucle de Python
t0 = time.perf_counter()
suma = 0.0
for i in range(n):
    suma += a[i] * b[i]
t_bucle = time.perf_counter() - t0

# 2) El mismo producto escalar, vectorizado
t0 = time.perf_counter()
suma_np = np.dot(a, b)
t_np = time.perf_counter() - t0

print(f"Bucle:  {suma:.6f} en {t_bucle * 1000:.1f} ms")
print(f"np.dot: {suma_np:.6f} en {t_np * 1000:.3f} ms")
print("¿Iguales?", np.isclose(suma, suma_np))
print(f"Aceleración aproximada: x{t_bucle / max(t_np, 1e-9):.0f}")

# 3) Broadcasting: centrar cada columna restando su media
M = rng.random((2_000, 50))
medias = M.mean(axis=0)  # forma (50,)

t0 = time.perf_counter()
centrada_bucle = np.empty_like(M)
for fila in range(M.shape[0]):
    for col in range(M.shape[1]):
        centrada_bucle[fila, col] = M[fila, col] - medias[col]
t_bucle2 = time.perf_counter() - t0

t0 = time.perf_counter()
centrada = M - medias  # (2000, 50) - (50,) -> (2000, 50)
t_broad = time.perf_counter() - t0

print(f"Centrar con bucles: {t_bucle2 * 1000:.1f} ms")
print(f"Centrar con broadcasting: {t_broad * 1000:.3f} ms")
print("¿Iguales?", np.allclose(centrada_bucle, centrada))
print("Medias tras centrar (≈ 0):", np.round(centrada.mean(axis=0)[:5], 12))
`;

const PANDAS = String.raw`# Limpieza de datos con pandas, paso a paso
import numpy as np
import pandas as pd

# Datos en línea: valores ausentes, una fila duplicada y edades guardadas como texto
df = pd.DataFrame({
    "alumno": ["Ana", "Luis", "Marta", "Luis", "Sara", "Pablo"],
    "edad": ["23", "31", None, "31", "27", "29"],
    "nota": [7.5, np.nan, 8.0, np.nan, 6.5, 9.0],
    "ciudad": ["Madrid", "Valencia", "Sevilla", "Valencia", None, "Bilbao"],
})
print("1) Datos originales")
print(df)
print(df.dtypes)
print("Ausentes por columna:")
print(df.isna().sum())

# 2) Quitar filas duplicadas
df = df.drop_duplicates()
print("\n2) Sin duplicados:", len(df), "filas")
print(df)

# 3) Convertir la edad de texto a número
df["edad"] = df["edad"].astype("float64")
print("\n3) Edad como número:", df["edad"].dtype)

# 4) Rellenar ausentes: la nota con la media y la edad con la mediana
df["nota"] = df["nota"].fillna(df["nota"].mean())
df["edad"] = df["edad"].fillna(df["edad"].median())
print("\n4) Tras fillna")
print(df)

# 5) Quitar las filas que siguen incompletas (sin ciudad)
df = df.dropna(subset=["ciudad"])
print("\n5) Tras dropna:", len(df), "filas")

# 6) La edad ya no tiene ausentes: puede ser entera
df["edad"] = df["edad"].astype(int)
print("\n6) Resultado final")
print(df)
print(df.dtypes)
print(df.describe())
`;

const GENERADORES = String.raw`# Generadores: producir valores bajo demanda con yield
import itertools
import sys


def cuenta_atras(n):
    # Cada yield entrega un valor y pausa la función hasta el siguiente next()
    while n > 0:
        yield n
        n -= 1


print("Cuenta atrás:", list(cuenta_atras(5)))
gen = cuenta_atras(3)
print("Con next():", next(gen), next(gen), next(gen))


def naturales():
    # Generador infinito: nunca termina, pero solo calcula lo que se pide
    n = 0
    while True:
        yield n
        n += 1


# itertools.islice toma solo los primeros elementos de un generador infinito
print("Primeros 10 naturales:", list(itertools.islice(naturales(), 10)))
pares = (n for n in naturales() if n % 2 == 0)
print("Primeros 5 pares:", list(itertools.islice(pares, 5)))

# Expresión generadora frente a lista: memoria
n = 100_000
lista = [x * x for x in range(n)]
generador = (x * x for x in range(n))
print("Tamaño de la lista:", sys.getsizeof(lista), "bytes")
print("Tamaño del generador:", sys.getsizeof(generador), "bytes")
print("¿Misma suma?", sum(lista) == sum(generador))

# Un generador se agota: la segunda pasada no produce nada
print("Segunda suma del generador:", sum(generador))
`;


const TIPOS = String.raw`# Tipos de datos básicos de Python
# type() dice el tipo de un valor; isinstance() comprueba si es de un tipo
entero = 42
real = 3.14
texto = "inteligencia artificial"
booleano = True
nada = None

for valor in [entero, real, texto, booleano, nada]:
    print(repr(valor), "->", type(valor).__name__)

# Conversiones explícitas
print(int("17") + 1, float("2,5".replace(",", ".")), str(3) + "3")
print("bool(0):", bool(0), "| bool(''):", bool(""), "| bool([0]):", bool([0]))

# Colecciones: lista (mutable), tupla (inmutable), conjunto (sin repetidos), diccionario (clave -> valor)
lista = [3, 1, 2, 3]
tupla = (3, 1, 2, 3)
conjunto = set(lista)
dic = {"asignatura": "Python", "creditos": 6}

lista.append(5)
print("lista:", lista, "| tupla:", tupla, "| conjunto:", conjunto)
print("dic:", dic, "| claves:", list(dic.keys()))

# Las cadenas se indexan y se cortan como las listas
print(texto[0], texto[-1], texto[:12], texto.upper(), len(texto))

# Igualdad (==) frente a identidad (is)
a = [1, 2]
b = [1, 2]
print("a == b:", a == b, "| a is b:", a is b)

# División entera, resto y potencia
print(7 / 2, 7 // 2, 7 % 2, 2 ** 10)
`;

const CONTROL = String.raw`# Control de flujo: if/elif/else, for, while, break y continue
notas = [4.5, 7.25, 9.0, 5.0, 3.75, 8.5]

# if / elif / else: calificación de cada nota
for nota in notas:
    if nota >= 9:
        calificacion = "Sobresaliente"
    elif nota >= 7:
        calificacion = "Notable"
    elif nota >= 5:
        calificacion = "Aprobado"
    else:
        calificacion = "Suspenso"
    print(f"{nota:>5} -> {calificacion}")

# enumerate da el índice y el valor; zip recorre dos listas a la vez
nombres = ["A", "B", "C", "D", "E", "F"]
for i, (nombre, nota) in enumerate(zip(nombres, notas), start=1):
    print(i, nombre, nota)

# while con break: primera nota suspensa
i = 0
while i < len(notas):
    if notas[i] < 5:
        print("Primera nota suspensa en la posición", i)
        break
    i += 1

# continue: suma solo las aprobadas
suma = 0
for nota in notas:
    if nota < 5:
        continue
    suma += nota
print("Suma de aprobadas:", suma)

# Comprensiones: la misma idea en una línea
aprobadas = [n for n in notas if n >= 5]
print("Aprobadas:", aprobadas, "| media:", round(sum(aprobadas) / len(aprobadas), 2))
`;

const FUNCIONES = String.raw`# Funciones: parámetros, valores por defecto, *args, **kwargs y lambdas


def area_rectangulo(base, altura=1.0):
    """Devuelve el área de un rectángulo (altura 1 si no se indica)."""
    return base * altura


print(area_rectangulo(3, 2), area_rectangulo(3), area_rectangulo(altura=4, base=2))


def estadisticas(*valores):
    # *valores recoge cualquier número de argumentos posicionales en una tupla
    n = len(valores)
    media = sum(valores) / n
    return min(valores), max(valores), media  # devolver una tupla


minimo, maximo, media = estadisticas(4, 8, 15, 16, 23, 42)
print("min:", minimo, "| max:", maximo, "| media:", round(media, 2))


def ficha(nombre, **datos):
    # **datos recoge los argumentos con nombre en un diccionario
    detalles = ", ".join(f"{k}={v}" for k, v in datos.items())
    return f"{nombre} ({detalles})"


print(ficha("Modelo", capas=3, activacion="relu"))

# lambda: función anónima de una expresión, útil como clave de ordenación
puntos = [(1, 5), (3, 1), (2, 8)]
print(sorted(puntos, key=lambda p: p[1]))


# Recursión: factorial
def factorial(n):
    return 1 if n <= 1 else n * factorial(n - 1)


print([factorial(k) for k in range(7)])

# Las funciones son valores: se pasan como argumento
print(list(map(abs, [-2, 3, -5])), list(filter(lambda x: x % 2 == 0, range(10))))
`;

const FICHEROS = String.raw`# Ficheros: leer y escribir texto en la carpeta de trabajo
# Sube tu propio «notas.txt» con «Subir archivo» (una línea por alumno: nombre;nota).
# Si no lo has subido, esta plantilla crea uno de ejemplo.
import os

NOMBRE = "notas.txt"

if not os.path.exists(NOMBRE):
    with open(NOMBRE, "w", encoding="utf-8") as f:
        f.write("Ana;7.5\nLuis;4.0\nMarta;9.25\nSara;6.0\n")
    print("No había", NOMBRE, "y se ha creado uno de ejemplo.")

# Leer línea a línea con with (el archivo se cierra solo)
alumnos = []
with open(NOMBRE, encoding="utf-8") as f:
    for numero, linea in enumerate(f, start=1):
        linea = linea.strip()
        if not linea:
            continue
        try:
            nombre, nota = linea.split(";")
            alumnos.append((nombre, float(nota.replace(",", "."))))
        except ValueError:
            print(f"Línea {numero} con formato incorrecto: {linea!r}")

print("Leídos:", alumnos)

# Escribir un archivo nuevo con el resultado
with open("resumen.txt", "w", encoding="utf-8") as f:
    for nombre, nota in sorted(alumnos, key=lambda a: a[1], reverse=True):
        estado = "aprobado" if nota >= 5 else "suspenso"
        f.write(f"{nombre}: {nota:.2f} ({estado})\n")

print(open("resumen.txt", encoding="utf-8").read())
print("Archivos en la carpeta:", sorted(os.listdir(".")))
# «resumen.txt» aparece en «Archivos»: puedes descargarlo.
`;

const NUMPY = String.raw`# NumPy básico: crear arrays, forma, indexado y operaciones
import numpy as np

a = np.array([1, 2, 3, 4, 5, 6])
print("a:", a, "| dtype:", a.dtype, "| shape:", a.shape)

# Cambiar la forma: 6 elementos -> matriz 2 x 3
M = a.reshape(2, 3)
print("M:\n", M)
print("Fila 0:", M[0], "| columna 1:", M[:, 1], "| elemento (1, 2):", M[1, 2])

# Arrays de construcción habitual
print(np.zeros((2, 2)), np.ones(3), np.arange(0, 1, 0.25), np.linspace(0, 1, 5), sep="\n")
print("Identidad:\n", np.eye(3))

# Operaciones elemento a elemento y por ejes
print("M * 2:\n", M * 2)
print("Suma total:", M.sum(), "| por columnas:", M.sum(axis=0), "| por filas:", M.sum(axis=1))

# Producto de matrices: (2 x 3) @ (3 x 2) -> (2 x 2)
print("M @ M.T:\n", M @ M.T)

# Máscaras booleanas: filtrar sin bucles
print("Pares de a:", a[a % 2 == 0])

# Números aleatorios reproducibles
rng = np.random.default_rng(0)
x = rng.normal(loc=10, scale=2, size=1000)
print(f"media ≈ {x.mean():.2f}, desviación ≈ {x.std():.2f}")
`;

const PANDAS_CSV = String.raw`# pandas con tu propio CSV
# Sube «datos.csv» con «Subir archivo» (con cabecera). Si no lo has subido, se crea uno de ejemplo
# con columnas grupo, horas y nota.
import os
import pandas as pd

NOMBRE = "datos.csv"
if not os.path.exists(NOMBRE):
    pd.DataFrame({
        "grupo": ["A", "A", "B", "B", "C", "C", "A", "B"],
        "horas": [2, 5, 1, 4, 3, 6, 4, 2],
        "nota": [5.5, 8.0, 4.0, 7.0, 6.5, 9.0, 7.5, 5.0],
    }).to_csv(NOMBRE, index=False)
    print("No había", NOMBRE, "y se ha creado uno de ejemplo.\n")

# sep=None con engine="python" detecta el separador (coma o punto y coma)
df = pd.read_csv(NOMBRE, sep=None, engine="python")
print("Forma:", df.shape)
print(df.head())
print("\nTipos de cada columna:")
print(df.dtypes)
print("\nResumen de las columnas numéricas:")
print(df.describe())

# Agrupar por la primera columna de texto, si la hay
texto = df.select_dtypes(include="object").columns
numeros = df.select_dtypes(include="number").columns
if len(texto) > 0 and len(numeros) > 0:
    print(f"\nMedia por «{texto[0]}»:")
    print(df.groupby(texto[0])[list(numeros)].mean().round(2))

# Guardar un resultado: aparece en «Archivos» para descargarlo
df.describe().to_csv("resumen.csv")
print("\nGuardado resumen.csv")
`;

const SEABORN = String.raw`# seaborn: gráficos estadísticos sobre un DataFrame de pandas
# Los datos se generan aquí (seaborn.load_dataset necesita internet y este entorno no lo tiene).
import numpy as np
import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt

rng = np.random.default_rng(7)
n = 120
df = pd.DataFrame({
    "grupo": rng.choice(["A", "B", "C"], size=n),
    "horas": rng.uniform(0, 10, size=n).round(1),
})
# La nota crece con las horas de estudio, con algo de ruido
df["nota"] = (3 + 0.6 * df["horas"] + rng.normal(0, 1, size=n)).clip(0, 10).round(2)
print(df.head())
print(df.groupby("grupo")["nota"].describe().round(2))

sns.set_theme(style="whitegrid")
fig, axes = plt.subplots(1, 2, figsize=(10, 4))

# Dispersión con recta de regresión
sns.regplot(data=df, x="horas", y="nota", ax=axes[0], scatter_kws={"s": 15})
axes[0].set_title("Nota frente a horas de estudio")

# Distribución por grupo
sns.boxplot(data=df, x="grupo", y="nota", ax=axes[1])
axes[1].set_title("Nota por grupo")

fig.tight_layout()
plt.show()
`;

export const TEMPLATES: readonly Template[] = Object.freeze([
  { id: "blank", label: "En blanco", code: BLANK },
  { id: "tipos", label: "Tipos de datos", code: TIPOS },
  { id: "control", label: "Control de flujo", code: CONTROL },
  { id: "funciones", label: "Funciones", code: FUNCIONES },
  { id: "generadores", label: "Generadores", code: GENERADORES },
  { id: "ficheros", label: "Ficheros", code: FICHEROS },
  { id: "numpy", label: "NumPy básico", code: NUMPY },
  { id: "vectorizacion", label: "Vectorización NumPy", code: VECTORIZACION },
  { id: "minmax", label: "Min-Max", code: MINMAX },
  { id: "pandas", label: "Limpieza con pandas", code: PANDAS },
  { id: "pandas-csv", label: "pandas con tu CSV", code: PANDAS_CSV },
  { id: "seaborn", label: "Gráficos con seaborn", code: SEABORN },
  { id: "perceptron", label: "PerceptronSimple", code: PERCEPTRON },
]);

export const templateById = (id: string): Template | undefined => TEMPLATES.find((t) => t.id === id);
