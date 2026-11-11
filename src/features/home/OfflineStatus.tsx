// «Disponible sin conexión» en el inicio, cuando el service worker ya tiene la app precargada.
import { WifiOff } from "lucide-react";
import { Chip } from "../../components/ui/chip.tsx";
import { useOfflineReady } from "../../lib/offline.ts";

export function OfflineStatus() {
  const ready = useOfflineReady();
  if (!ready) return null;
  return (
    <p className="text-[14px]" data-offline-ready="">
      <Chip tone="ok">
        <WifiOff size={14} strokeWidth={1.75} aria-hidden="true" />
        Disponible sin conexión
      </Chip>
    </p>
  );
}
