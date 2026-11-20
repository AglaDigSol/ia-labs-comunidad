import { useState } from "react";
import { Flag, X, Check } from "lucide-react";
import type { ReportReason } from "../../../shared/community/types.ts";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../../components/ui/dialog.tsx";
import { t } from "../../i18n/index.ts";

export function ReportDialog({
  isOpen,
  targetType,
  targetId,
  onClose,
}: {
  isOpen: boolean;
  targetType: "post" | "reply";
  targetId: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<ReportReason>("academic_integrity");
  const [details, setDetails] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/community/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType,
          targetId,
          reason,
          details: details.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const errJson = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errJson.error || `Error ${res.status}`);
      }

      setIsDone(true);
      setTimeout(() => {
        setIsDone(false);
        onClose();
      }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al enviar el reporte");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <DialogTitle id="report-dialog-title" className="text-base font-bold text-foreground flex items-center gap-2">
            <Flag size={16} className="text-rose-500" />
            <span>{t.community.reportTitle}</span>
          </DialogTitle>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar diálogo"
            className="rounded-lg p-1 text-muted hover:text-foreground hover:bg-hover transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <DialogDescription className="sr-only">{t.community.reportReason}</DialogDescription>

        {isDone ? (
          <div className="py-8 text-center space-y-2">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600">
              <Check size={20} />
            </div>
            <p className="text-sm font-semibold text-foreground">Reporte enviado a la administración</p>
            <p className="text-xs text-muted">Gracias por mantener la integridad y calidad de la comunidad.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-2 text-xs text-rose-600">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="report-reason" className="block text-xs font-semibold text-foreground mb-1.5">
                {t.community.reportReason}
              </label>
              <select
                id="report-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value as ReportReason)}
                className="w-full rounded-lg border border-border bg-sunken px-3 py-2 text-xs text-foreground focus:border-accent focus:outline-hidden"
              >
                <option value="academic_integrity">{t.community.reasonAcademic}</option>
                <option value="spam">{t.community.reasonSpam}</option>
                <option value="harassment">{t.community.reasonHarassment}</option>
                <option value="inappropriate">Contenido inapropiado</option>
                <option value="other">{t.community.reasonOther}</option>
              </select>
            </div>

            <div>
              <label htmlFor="report-details" className="block text-xs font-semibold text-foreground mb-1">
                {t.community.reportDetails}
              </label>
              <textarea
                id="report-details"
                rows={3}
                maxLength={1000}
                placeholder="Indica qué regla o aspecto requiere revisión..."
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                className="w-full rounded-lg border border-border bg-sunken p-2.5 text-xs text-foreground placeholder:text-muted focus:border-accent focus:outline-hidden"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:text-foreground hover:bg-hover"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-rose-700 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? "Enviando..." : t.community.sendReport}
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
