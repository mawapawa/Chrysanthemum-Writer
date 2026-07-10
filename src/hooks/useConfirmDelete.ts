import { useState } from "react";
import { useClickOutside } from "./useClickOutside";

const CONFIRM_TIMEOUT = 4000;

export function useConfirmDelete() {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const ref = useClickOutside<HTMLDivElement>(() => setConfirmId(null), confirmId !== null);

  const requestDelete = (id: string): boolean => {
    if (confirmId !== id) {
      setConfirmId(id);
      setTimeout(() => {
        setConfirmId((current) => (current === id ? null : current));
      }, CONFIRM_TIMEOUT);
      return false;
    }
    setConfirmId(null);
    return true;
  };

  const cancelDelete = () => setConfirmId(null);

  return { confirmId, ref, requestDelete, cancelDelete, isConfirming: (id: string) => confirmId === id };
}
