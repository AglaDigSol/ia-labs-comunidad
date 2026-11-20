import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  detectDeviceTimezone,
  getSavedTimezone,
  resetSavedTimezone,
  saveTimezone,
} from "../../../shared/timezone/iana.ts";

interface TimezoneContextValue {
  timezone: string;
  setTimezone: (iana: string) => void;
  resetToDevice: () => void;
  isDeviceDefault: boolean;
}

const TimezoneContext = createContext<TimezoneContextValue | null>(null);

export function TimezoneProvider({ children }: { children: ReactNode }) {
  const [timezone, setTz] = useState<string>(() => getSavedTimezone());
  const [isDeviceDefault, setIsDeviceDefault] = useState<boolean>(() => {
    return timezone === detectDeviceTimezone();
  });

  const handleSetTimezone = (iana: string) => {
    setTz(iana);
    saveTimezone(iana);
    setIsDeviceDefault(iana === detectDeviceTimezone());
  };

  const handleReset = () => {
    resetSavedTimezone();
    const deviceTz = detectDeviceTimezone();
    setTz(deviceTz);
    setIsDeviceDefault(true);
  };

  useEffect(() => {
    // Escucha cambios en storage si otra pestaña actualiza la zona
    const onStorage = (e: StorageEvent) => {
      if (e.key === "ia_labs_preferred_timezone" && e.newValue) {
        setTz(e.newValue);
        setIsDeviceDefault(e.newValue === detectDeviceTimezone());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <TimezoneContext.Provider
      value={{
        timezone,
        setTimezone: handleSetTimezone,
        resetToDevice: handleReset,
        isDeviceDefault,
      }}
    >
      {children}
    </TimezoneContext.Provider>
  );
}

export function useTimezone(): TimezoneContextValue {
  const ctx = useContext(TimezoneContext);
  if (!ctx) {
    // Fallback defensivo fuera del provider
    return {
      timezone: detectDeviceTimezone(),
      setTimezone: () => {},
      resetToDevice: () => {},
      isDeviceDefault: true,
    };
  }
  return ctx;
}
