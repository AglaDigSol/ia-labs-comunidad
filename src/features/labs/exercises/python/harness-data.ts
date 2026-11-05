// Banco de pruebas, parte de datos (temas 6 a 13): comparar tablas de pandas, series y arrays de NumPy
// con tolerancia; comprobaciones con nombre (generador, perezoso, forma, columnas, tipos, sin NaN,
// orden, índice) y la inspección de figuras de matplotlib y seaborn (número de gráficos, tamaño, tipo
// de cada uno, barras y sus alturas, puntos, líneas, leyenda, títulos y nombres de los ejes).
//
// Es Python que se antepone al banco de harness.ts. No importa pandas, NumPy ni matplotlib: los usa
// solo si el código ya los cargó (sys.modules), así que los ejercicios de los temas 1 a 5 no pagan nada.
// Todo lo que vuelve a la página describe lo que hizo el código de la persona («tuyo»), nunca el valor
// esperado: las comprobaciones dicen «cumplida» o «no cumplida».
export const HARNESS_DATA_PY = String.raw`
import collections.abc as _abc, inspect as _inspect, itertools as _itertools

_NULO = object()

def _mod(nombre):
    return _sys.modules.get(nombre)

def _escalar(x):
    np = _mod("numpy")
    if np is not None and isinstance(x, np.generic):
        try:
            return x.item()
        except BaseException:
            return x
    return x

def _es_nulo(x):
    if x is None:
        return True
    if isinstance(x, float):
        return x != x
    pd = _mod("pandas")
    if pd is not None:
        try:
            r = pd.isna(x)
            return isinstance(r, bool) and r or type(r).__name__ == "bool_" and bool(r)
        except BaseException:
            return False
    return False

def _celda(v):
    v = _escalar(v)
    if _es_nulo(v):
        return _NULO
    if hasattr(v, "isoformat") and not isinstance(v, (int, float, str)):
        try:
            return v.isoformat()
        except BaseException:
            return v
    return v

def _numero(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool)

def _misma_celda(a, b, tol):
    if a is _NULO or b is _NULO:
        return a is b
    if _numero(a) and _numero(b):
        return _math.isclose(a, b, rel_tol=tol, abs_tol=tol)
    try:
        return bool(a == b)
    except BaseException:
        return False

def _etq(c):
    c = _escalar(c)
    if isinstance(c, float) and c.is_integer():
        c = int(c)
    if isinstance(c, tuple):
        return "(" + ", ".join(_etq(x) for x in c) + ")"
    return str(c)

def _clase(dt):
    k = getattr(dt, "kind", "O")
    if str(dt) == "category":
        return "categoría"
    return {"i": "entero", "u": "entero", "f": "real", "b": "booleano", "M": "fecha", "m": "duración", "c": "complejo"}.get(k, "texto")

def _es_tabla(x):
    pd = _mod("pandas")
    return pd is not None and isinstance(x, (pd.DataFrame, pd.Series))

def _es_serie(x):
    pd = _mod("pandas")
    return pd is not None and isinstance(x, pd.Series)

def _es_array(x):
    np = _mod("numpy")
    return np is not None and isinstance(x, np.ndarray)

def _forma(x):
    if _es_tabla(x) or _es_array(x):
        return tuple(int(n) for n in x.shape)
    if isinstance(x, (list, tuple, dict, set, str)):
        return (len(x),)
    return None

def _forma_txt(x):
    f = _forma(x)
    if f is None:
        return "sin forma (" + type(x).__name__ + ")"
    return "(" + ", ".join(str(n) for n in f) + (",)" if len(f) == 1 else ")")

def _tabla(x, op):
    serie = _es_serie(x)
    con_indice = op.get("index", serie)
    df = x.to_frame("__valor") if serie else x
    cols = [_etq(c) for c in df.columns]
    tipos = [_clase(dt) for dt in df.dtypes]
    filas = [[_celda(v) for v in fila] for fila in df.itertuples(index=False, name=None)]
    if con_indice:
        n = df.index.nlevels
        idx = [tuple(_celda(v) for v in i) if isinstance(i, tuple) else (_celda(i),) for i in df.index]
        filas = [list(i) + f for i, f in zip(idx, filas)]
        cols = ["__i" + str(k) for k in range(n)] + cols
        tipos = ["índice"] * n + tipos
    return cols, filas, tipos

def _clave_celda(c):
    if c is _NULO:
        return (0, "")
    if _numero(c):
        return (1, round(float(c), 6))
    return (2, str(c))

def _filas_iguales(fe, ft, tol):
    return len(fe) == len(ft) and all(len(a) == len(b) and all(_misma_celda(x, y, tol) for x, y in zip(a, b)) for a, b in zip(fe, ft))

def _mismo_multiconjunto(fe, ft, tol):
    orden = lambda filas: sorted(filas, key=lambda f: [_clave_celda(c) for c in f])
    return _filas_iguales(orden(fe), orden(ft), tol)

def _nombre_col(c):
    return "el índice" if c.startswith("__i") else "la columna '" + c + "'" if c != "__valor" else "los valores"

def _dif_tabla(e, t, op):
    if not _es_tabla(t) or _es_serie(e) != _es_serie(t):
        return {"clave": "tipo", "tuyo": type(t).__name__}
    if e.shape != t.shape:
        return {"clave": "forma", "tuyo": _forma_txt(t)}
    ce, fe, te = _tabla(e, op)
    ct, ft, tt = _tabla(t, op)
    if len(ce) != len(ct):
        return {"clave": "indice", "tuyo": str(t.index.nlevels) + " niveles"}
    if ce != ct:
        if sorted(ce) == sorted(ct) and len(set(ce)) == len(ce) and not op.get("columnOrder"):
            pos = [ct.index(c) for c in ce]
            ft = [[f[i] for i in pos] for f in ft]
            tt = [tt[i] for i in pos]
        else:
            return {"clave": "columnas", "tuyo": _repr([c for c in ct if not c.startswith("__i")])}
    if op.get("dtypes") and te != tt:
        return {"clave": "tipos", "tuyo": ", ".join(c + ": " + b for c, a, b in zip(ce, te, tt) if a != b and not c.startswith("__i"))}
    tol = op.get("tolerance", 1e-6)
    if _filas_iguales(fe, ft, tol):
        return None
    if _mismo_multiconjunto(fe, ft, tol):
        return {"clave": "orden"} if op.get("rowOrder", True) else None
    nulos = []
    for j, c in enumerate(ce):
        ne = sum(1 for f in fe if f[j] is _NULO)
        nt = sum(1 for f in ft if f[j] is _NULO)
        if ne != nt:
            nulos.append(("índice" if c.startswith("__i") else c) + ": " + str(nt))
    if nulos:
        return {"clave": "nulos", "tuyo": ", ".join(nulos)}
    if not op.get("rowOrder", True):
        return {"clave": "valores"}
    for i, (a, b) in enumerate(zip(fe, ft)):
        for j, (x, y) in enumerate(zip(a, b)):
            if not _misma_celda(x, y, tol):
                return {"clave": "valores", "donde": _nombre_col(ce[j]), "fila": i, "tuyo": "NaN" if y is _NULO else _repr(y)}
    return {"clave": "valores"}

def _dif_array(e, t, op):
    np = _mod("numpy")
    if not _es_array(t):
        return {"clave": "tipo", "tuyo": type(t).__name__}
    if e.shape != t.shape:
        return {"clave": "forma", "tuyo": _forma_txt(t)}
    if op.get("dtypes") and _clase(e.dtype) != _clase(t.dtype):
        return {"clave": "tipos", "tuyo": _clase(t.dtype)}
    tol = op.get("tolerance", 1e-6)
    try:
        fe = e.astype(float)
        ft = t.astype(float)
    except (TypeError, ValueError):
        return None if np.array_equal(e, t) else {"clave": "valores"}
    me, mt = np.isnan(fe), np.isnan(ft)
    if not np.array_equal(me, mt):
        return {"clave": "nulos", "tuyo": str(int(mt.sum()))}
    bien = np.isclose(fe, ft, rtol=tol, atol=tol) | me
    if bool(bien.all()):
        return None
    pos = tuple(int(i) for i in np.argwhere(~bien)[0])
    return {"clave": "valores", "donde": "la posición " + str(pos if len(pos) > 1 else pos[0]), "tuyo": _repr(_escalar(t[pos]))}

def _dif(e, t, op):
    """None si el valor de la persona (t) vale como el de la referencia (e); si no, un detalle."""
    e = _escalar(e)
    t = _escalar(t)
    if _es_tabla(e):
        return _dif_tabla(e, t, op)
    if _es_array(e):
        return _dif_array(e, t, op)
    if isinstance(e, (list, tuple)) and type(e) is type(t) and len(e) == len(t):
        for x, y in zip(e, t):
            d = _dif(x, y, op)
            if d is not None:
                return d
        return None
    if isinstance(e, dict) and isinstance(t, dict) and list(e.keys()) == list(t.keys()):
        for k in e:
            d = _dif(e[k], t[k], op)
            if d is not None:
                return d
        return None
    if _es_tabla(t) or _es_array(t):
        return {"clave": "tipo", "tuyo": type(t).__name__}
    return None if _igual(e, t) else {}

def _repr_datos(x):
    if _es_tabla(x):
        texto = type(x).__name__ + " " + _forma_txt(x) + "\n" + x.to_string(max_rows=8, max_cols=8)
    else:
        np = _mod("numpy")
        texto = "array " + _forma_txt(x) + "\n" + np.array2string(x, threshold=40, edgeitems=3)
    return texto if len(texto) <= 900 else texto[:899] + "…"

def _iterador(v):
    return isinstance(v, _abc.Iterator) and not isinstance(v, (str, bytes, _io.IOBase))

# ---------------------------------------------------------------- Figuras

def _figs():
    plt = _mod("matplotlib.pyplot")
    return set(plt.get_fignums()) if plt is not None else set()

def _finitos(xs):
    out = []
    for v in xs:
        try:
            f = float(v)
        except (TypeError, ValueError):
            continue
        if f == f and f not in (float("inf"), float("-inf")):
            out.append(round(f, 6))
    return out

def _describir_eje(a):
    from matplotlib.collections import PathCollection
    from matplotlib.container import BarContainer
    barras = []
    for c in a.containers:
        if isinstance(c, BarContainer):
            horizontal = getattr(c, "orientation", "vertical") == "horizontal"
            barras += _finitos([p.get_width() if horizontal else p.get_height() for p in c.patches])
    puntos = []
    for c in a.collections:
        if isinstance(c, PathCollection):
            for par in c.get_offsets().tolist():
                xy = _finitos(par)
                if len(xy) == 2:
                    puntos.append(tuple(xy))
    lineas = []
    if not barras:
        # Con barras, las líneas son las barras de error de seaborn: no cuentan.
        for l in a.get_lines():
            ys = _finitos(l.get_ydata())
            if ys:
                lineas.append(ys)
    leyenda = a.get_legend()
    tipos = [n for n, hay in (("dispersión", puntos), ("barras", barras), ("líneas", lineas)) if hay]
    return {
        "tipos": tipos,
        "barras": sorted(barras),
        "puntos": sorted(puntos),
        "lineas": sorted(lineas),
        "leyenda": [t.get_text() for t in leyenda.get_texts()] if leyenda is not None else [],
        "titulo": next((a.get_title(loc) for loc in ("center", "left", "right") if a.get_title(loc)), ""),
        "x": a.get_xlabel(),
        "y": a.get_ylabel(),
    }

def _describir_figura(fig):
    w, h = fig.get_size_inches()
    ejes = [_describir_eje(a) for a in fig.axes if a.get_label() != "<colorbar>"]
    sup = getattr(fig, "_suptitle", None)
    leyendas = [t.get_text() for lg in getattr(fig, "legends", []) for t in lg.get_texts()]
    return {"tamano": (round(float(w), 2), round(float(h), 2)), "ejes": ejes, "suptitulo": sup.get_text() if sup is not None else "", "leyendas": leyendas}

def _figuras_nuevas(antes, guardar):
    plt = _mod("matplotlib.pyplot")
    if plt is None:
        return []
    nuevas = [n for n in plt.get_fignums() if n not in antes]
    out = [_describir_figura(plt.figure(n)) for n in nuevas]
    if not guardar:
        for n in nuevas:
            plt.close(n)
    return out

def _num(n, uno, varios):
    return str(n) + " " + (uno if n == 1 else varios)

def _lista_corta(xs, n=12):
    xs = list(xs)
    texto = ", ".join(str(int(x) if isinstance(x, float) and x.is_integer() else x) for x in xs[:n])
    return texto + (", …" if len(xs) > n else "")

def _ejes_de(fig_e, fig_t, ch):
    k = ch.get("ejes")
    if k is None:
        if len(fig_e["ejes"]) != len(fig_t["ejes"]):
            return None
        return list(zip(fig_e["ejes"], fig_t["ejes"]))
    if k >= len(fig_e["ejes"]) or k >= len(fig_t["ejes"]):
        return None
    return [(fig_e["ejes"][k], fig_t["ejes"][k])]

def _cerca(a, b, tol=1e-6):
    return len(a) == len(b) and all(_math.isclose(x, y, rel_tol=tol, abs_tol=tol) for x, y in zip(a, b))

def _check_figura(tipo, ch, fe, ft):
    """(ok, tuyo) de una comprobación de figura; fe y ft son las figuras de la referencia y de la persona."""
    if tipo == "fig-una":
        return len(ft) == 1, _num(len(ft), "figura", "figuras")
    if not ft:
        return False, "tu código no deja ninguna figura abierta"
    if not fe:
        return None, None
    e, t = fe[0], ft[0]
    if tipo == "fig-tamano":
        w, h = t["tamano"]
        return _cerca(e["tamano"], t["tamano"], 0.01), _lista_corta([w]) + " × " + _lista_corta([h]) + " pulgadas"
    if tipo == "fig-ejes":
        return len(e["ejes"]) == len(t["ejes"]), _num(len(t["ejes"]), "gráfico", "gráficos")
    if tipo == "fig-leyenda" and ch.get("ejes") is None:
        # Sin un gráfico concreto: todas las leyendas de la figura juntas (también la de la figura).
        le = sorted(set(x for a in e["ejes"] for x in a["leyenda"]) | set(e["leyendas"]))
        lt = sorted(set(x for a in t["ejes"] for x in a["leyenda"]) | set(t["leyendas"]))
        return le == lt, ("leyenda: " + ", ".join(lt)) if lt else "sin leyenda"
    pares = _ejes_de(e, t, ch)
    if pares is None:
        return False, "tu figura tiene " + _num(len(t["ejes"]), "gráfico", "gráficos")
    if tipo == "fig-tipo":
        ok = all(set(a["tipos"]) <= set(b["tipos"]) and b["tipos"] for a, b in pares)
        return ok, "; ".join(", ".join(b["tipos"]) or "vacío" for _, b in pares)
    if tipo == "fig-barras":
        return all(len(a["barras"]) == len(b["barras"]) for a, b in pares), "; ".join(_num(len(b["barras"]), "barra", "barras") for _, b in pares)
    if tipo == "fig-alturas":
        ok = all(_cerca(a["barras"], b["barras"]) for a, b in pares)
        return ok, "; ".join(_lista_corta(b["barras"]) or "sin barras" for _, b in pares)
    if tipo == "fig-puntos":
        ok = all(len(a["puntos"]) == len(b["puntos"]) and all(_cerca(p, q) for p, q in zip(a["puntos"], b["puntos"])) for a, b in pares)
        return ok, "; ".join(_num(len(b["puntos"]), "punto", "puntos") for _, b in pares)
    if tipo == "fig-lineas":
        ok = all(len(a["lineas"]) == len(b["lineas"]) and all(_cerca(p, q) for p, q in zip(a["lineas"], b["lineas"])) for a, b in pares)
        return ok, "; ".join(_num(len(b["lineas"]), "línea", "líneas") for _, b in pares)
    if tipo == "fig-leyenda":
        le, lt = sorted(set(pares[0][0]["leyenda"])), sorted(set(pares[0][1]["leyenda"]))
        return le == lt, ("leyenda: " + ", ".join(lt)) if lt else "sin leyenda"
    if tipo == "fig-titulo":
        solo = len(t["ejes"]) == 1 and t["suptitulo"]
        ok = all(b["titulo"] or solo for _, b in pares)
        return ok, "; ".join(("«" + b["titulo"] + "»") if b["titulo"] else ("«" + t["suptitulo"] + "» (de la figura)" if solo else "sin título") for _, b in pares)
    if tipo == "fig-etiquetas":
        ok = all(b["x"] and b["y"] for _, b in pares)
        return ok, "; ".join("x: " + (b["x"] or "—") + ", y: " + (b["y"] or "—") for _, b in pares)
    raise ValueError(tipo)

# ---------------------------------------------------------------- Comprobaciones con nombre

def _check_valor(tipo, op, re, rt):
    """(ok, tuyo) de una comprobación sobre el valor; re y rt son los resultados de la referencia y de la persona."""
    e, t = re["valor"], rt["valor"]
    if tipo == "generador":
        return rt["generador"], rt["clase"]
    if tipo == "perezoso":
        return rt["creado"], "empezó a ejecutarse antes de pedirle nada" if rt["generador"] else rt["clase"]
    if tipo == "tipo":
        return re["clase"] == rt["clase"], rt["clase"]
    if tipo == "forma":
        return _forma(e) == _forma(t), _forma_txt(t)
    if tipo == "columnas":
        if not (_es_tabla(t) and not _es_serie(t)):
            return False, type(t).__name__
        ce, ct = [_etq(c) for c in e.columns], [_etq(c) for c in t.columns]
        ok = ce == ct if op.get("columnOrder") else sorted(ce) == sorted(ct)
        return ok, _repr(ct)
    if tipo == "tipos":
        if not (_es_tabla(t) and not _es_serie(t)):
            return False, type(t).__name__
        ce = {_etq(c): _clase(d) for c, d in e.dtypes.items()}
        ct = {_etq(c): _clase(d) for c, d in t.dtypes.items()}
        malas = [c + ": " + ct.get(c, "falta") for c in ce if ct.get(c) != ce[c]]
        return not malas, ", ".join(malas) or None
    if tipo == "sin-nulos":
        if _es_tabla(t):
            n = int(t.isna().to_numpy().sum())
        elif _es_array(t):
            try:
                n = int(_mod("numpy").isnan(t.astype(float)).sum())
            except (TypeError, ValueError):
                n = 0
        else:
            return False, type(t).__name__
        return n == 0, _num(n, "valor perdido", "valores perdidos")
    if tipo == "nulos":
        if _es_tabla(e) and _es_tabla(t) and e.shape == t.shape:
            me, mt = e.isna().to_numpy(), t.isna().to_numpy()
        elif _es_array(e) and _es_array(t) and e.shape == t.shape:
            np = _mod("numpy")
            try:
                me, mt = np.isnan(e.astype(float)), np.isnan(t.astype(float))
            except (TypeError, ValueError):
                return False, None
        else:
            return False, _forma_txt(t)
        return bool((me == mt).all()), _num(int(mt.sum()), "valor perdido", "valores perdidos")
    if tipo == "orden":
        d = _dif(e, t, dict(op, rowOrder=True))
        return not (d and d.get("clave") == "orden"), None
    if tipo == "indice":
        if not (_es_tabla(e) and _es_tabla(t)):
            return False, type(t).__name__
        ie, it = [_etq(i) for i in e.index], [_etq(i) for i in t.index]
        return ie == it, _lista_corta(it, 8)
    raise ValueError(tipo)

def _comprobar(ch, op, re, rt):
    tipo = ch["tipo"]
    if tipo.startswith("fig-"):
        return _check_figura(tipo, ch, re["figuras"], rt["figuras"])
    return _check_valor(tipo, op, re, rt)
`;
