"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { Check } from "lucide-react";

type Toast = { id: number; title: string; message: string };
type ToastCtx = (title: string, message: string) => void;

const Ctx = createContext<ToastCtx>(() => {});

export function useToast() {
  return useContext(Ctx);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [shown, setShown] = useState<Set<number>>(new Set());

  const push = useCallback<ToastCtx>((title, message) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, title, message }]);
    // trigger slide-in on next frame
    requestAnimationFrame(() =>
      setShown((s) => new Set(s).add(id))
    );
    setTimeout(() => {
      setShown((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 420);
    }, 4200);
  }, []);

  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="toast-zone" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast${shown.has(t.id) ? " show" : ""}`}>
            <div className="tk">
              <Check strokeWidth={2.6} />
            </div>
            <div>
              <b>{t.title}</b>
              <span>{t.message}</span>
            </div>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
