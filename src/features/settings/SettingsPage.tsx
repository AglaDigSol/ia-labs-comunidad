import { Download, Trash2, Upload } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";
import { ThemeToggle } from "../../components/layout/AppShell.tsx";
import { Button } from "../../components/ui/button.tsx";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "../../components/ui/dialog.tsx";
import { Input } from "../../components/ui/input.tsx";
import { COMMUNITY_MODULE, config } from "../../config.ts";
import { DEFAULT_NEW_CARDS_PER_DAY } from "../../../shared/srs/due.ts";
import { DisplayNameSchema } from "../../../shared/community/validation.ts";
import { NEW_CAP_MAX, NEW_CAP_MIN, setNewCardsPerDay, useNewCap } from "../../lib/new-cards-pref.ts";
import { backupFileName, buildBackup, clearExtras, COMMUNITY_NAME_KEY, restoreBackup } from "../../lib/backup.ts";
import { t } from "../../i18n/index.ts";
import { clearKv } from "../../lib/kv-store.ts";

/** Tamaño máximo de una copia, comprobado antes de leer el archivo. */
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

type Status = { tone: "ok" | "crit"; text: string } | null;

function downloadJson(name: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

const entries = t.settings.entries;

/** «Nuevas por día» (pref/newCardsPerDay): new cards per deck and day. Saves each valid value. */
function NewCardsField() {
  const cap = useNewCap();
  const [draft, setDraft] = useState<string | undefined>(undefined);
  const parse = (v: string) => (/^\d{1,3}$/.test(v.trim()) ? Number(v.trim()) : NaN);
  const n = draft === undefined ? cap : parse(draft);
  const valid = Number.isInteger(n) && n >= NEW_CAP_MIN && n <= NEW_CAP_MAX;
  const error = draft !== undefined && !valid ? t.settings.newPerDayError(NEW_CAP_MIN, NEW_CAP_MAX) : null;
  return (
    <div className="flex max-w-xs flex-col gap-1">
      <label htmlFor="new-per-day" className="text-[14px] font-semibold">
        {t.settings.newPerDay}
      </label>
      <Input
        id="new-per-day"
        inputMode="numeric"
        autoComplete="off"
        className="mono"
        value={draft ?? String(cap)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "new-per-day-help new-per-day-err" : "new-per-day-help"}
        onChange={(e) => {
          const v = e.target.value;
          setDraft(v);
          const k = parse(v);
          if (Number.isInteger(k) && k >= NEW_CAP_MIN && k <= NEW_CAP_MAX) setNewCardsPerDay(k);
        }}
        onBlur={() => {
          if (valid) setDraft(undefined);
        }}
      />
      <p id="new-per-day-help" className="text-[14px] text-muted">
        {t.settings.newPerDayHelp(DEFAULT_NEW_CARDS_PER_DAY)}
      </p>
      {error ? (
        <p id="new-per-day-err" className="text-[14px] text-crit">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function CommunityDisplayNameEditor() {
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem(COMMUNITY_NAME_KEY) || "";
    } catch {
      return "";
    }
  });
  const [msg, setMsg] = useState<{ tone: "ok" | "crit"; text: string } | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = DisplayNameSchema.safeParse(name.trim());
    if (!parsed.success) {
      setMsg({ tone: "crit", text: parsed.error.issues[0]?.message ?? "Nombre no válido." });
      return;
    }
    try {
      localStorage.setItem(COMMUNITY_NAME_KEY, parsed.data);
      // Sincroniza con el backend si hay sesión activa
      try {
        const res = await fetch("/api/community/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayName: parsed.data }),
        });
        if (!res.ok) {
          const errJson = (await res.json().catch(() => ({}))) as { error?: string };
          setMsg({ tone: "crit", text: errJson.error || `Error ${res.status} al guardar el nombre.` });
          return;
        }
      } catch {
        // Sin servidor activo: se mantiene guardado en este navegador.
      }
      setMsg({ tone: "ok", text: t.settings.displayNameSaved });
      setTimeout(() => setMsg(null), 3000);
    } catch {
      // noop
    }
  };

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-2 max-w-sm">
      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          minLength={2}
          maxLength={80}
          placeholder="Tu nombre y apellidos"
          onChange={(e) => {
            setName(e.target.value);
            if (msg) setMsg(null);
          }}
          className="flex-1 rounded-md border border-border bg-sunken px-3 py-1.5 text-xs text-foreground focus:border-accent focus:outline-hidden"
        />
        <Button type="submit" disabled={name.trim().length < 2}>
          Guardar
        </Button>
      </div>
      {msg && <p className={`text-xs font-medium ${msg.tone === "ok" ? "text-ok" : "text-crit"}`}>{msg.text}</p>}
    </form>
  );
}

export function SettingsPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [status, setStatus] = useState<Status>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearCount, setClearCount] = useState(0);

  const onExport = () => {
    const now = new Date();
    const backup = buildBackup(now);
    downloadJson(backupFileName(now), backup);
    setStatus({ tone: "ok", text: t.settings.exported(entries(Object.keys(backup.data).length)) });
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setStatus({ tone: "crit", text: t.settings.tooBig(MAX_IMPORT_BYTES / 1024 / 1024) });
      return;
    }
    const result = restoreBackup(await file.text(), mode);
    if (!result.ok) {
      setStatus({ tone: "crit", text: result.error });
      return;
    }
    const { imported, skipped } = result.report;
    setStatus({
      tone: "ok",
      text:
        t.settings.imported(entries(imported)) + (skipped.length > 0 ? t.settings.skipped(entries(skipped.length)) : ""),
    });
  };

  return (
    <div className="flex max-w-[720px] flex-col gap-8">
      <h1 tabIndex={-1} className="font-display text-[28px] font-semibold leading-[1.2]">
        {t.settings.title}
      </h1>

      <section aria-labelledby="ajustes-tema" className="flex flex-col gap-2">
        <h2 id="ajustes-tema" className="text-[20px]">
          {t.settings.themeTitle}
        </h2>
        <ThemeToggle />
      </section>

      {config.modules.flashcards ? (
        <section aria-labelledby="ajustes-flashcards" className="flex flex-col gap-2">
          <h2 id="ajustes-flashcards" className="text-[20px]">
            {t.settings.cardsTitle}
          </h2>
          <NewCardsField />
        </section>
      ) : null}

      <section aria-labelledby="ajustes-datos" className="flex flex-col gap-3">
        <h2 id="ajustes-datos" className="text-[20px]">
          {t.settings.dataTitle}
        </h2>
        <p className="text-muted">{t.settings.dataIntro}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={onExport}>
            <Download size={16} aria-hidden="true" />
            {t.settings.export}
          </Button>
          <Button onClick={() => fileRef.current?.click()}>
            <Upload size={16} aria-hidden="true" />
            {t.settings.import}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label={t.settings.importFileLabel}
            tabIndex={-1}
            onChange={(e) => void onFile(e)}
          />
        </div>
        <fieldset className="flex flex-col gap-1 text-[14px]">
          <legend className="font-semibold">{t.settings.importMode}</legend>
          <label className="flex min-h-11 items-center gap-2">
            <input type="radio" name="import-mode" checked={mode === "merge"} onChange={() => setMode("merge")} />
            {t.settings.importMerge}
          </label>
          <label className="flex min-h-11 items-center gap-2">
            <input type="radio" name="import-mode" checked={mode === "replace"} onChange={() => setMode("replace")} />
            {t.settings.importReplace}
          </label>
        </fieldset>
        {status ? (
          <p role="status" className={status.tone === "ok" ? "text-ok" : "text-crit"}>
            {status.text}
          </p>
        ) : null}
        <div>
          <Button variant="ghost" onClick={() => setConfirmClear(true)}>
            <Trash2 size={16} aria-hidden="true" />
            {t.settings.clear}
          </Button>
        </div>
        <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
          <DialogContent>
            <DialogTitle>{t.settings.clearTitle}</DialogTitle>
            <DialogDescription>{t.settings.clearBody}</DialogDescription>
            <div className="flex flex-wrap justify-end gap-2">
              <DialogClose asChild>
                <Button>{t.settings.cancel}</Button>
              </DialogClose>
              <Button
                variant="destructive"
                onClick={() => {
                  clearKv();
                  clearExtras();
                  setClearCount((c) => c + 1);
                  setConfirmClear(false);
                  setStatus({ tone: "ok", text: t.settings.cleared });
                }}
              >
                {t.settings.clearConfirm}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </section>

      {COMMUNITY_MODULE ? (
        <section aria-labelledby="ajustes-comunidad" className="flex flex-col gap-3">
          <h2 id="ajustes-comunidad" className="text-[20px]">
            {t.settings.communityTitle}
          </h2>
          <p className="text-muted text-sm">{t.settings.displayNameHelp}</p>
          <CommunityDisplayNameEditor key={clearCount} />
        </section>
      ) : null}

      <section aria-labelledby="ajustes-privacidad" className="flex flex-col gap-2">
        <h2 id="ajustes-privacidad" className="text-[20px]">
          {t.settings.privacyTitle}
        </h2>
        <p className="text-muted">{t.settings.privacyBody}</p>
      </section>
    </div>
  );
}
