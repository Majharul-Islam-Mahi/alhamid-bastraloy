// src/hooks/use-keyboard-shortcuts.ts
// Global keyboard shortcuts — Alt + অক্ষর

// FIX: Shift key check missing — Alt+Shift+M also fired (browser এ conflict)
// FIX: e.repeat missing — key hold করলে multiple navigation fire হত
// FIX: modifier list — Ctrl/Meta ছাড়াও Shift+Alt+key ignore করি
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";

type Shortcut = {
  key: string;
  path: string;
  label: string;
};

const SHORTCUTS: Shortcut[] = [
  { key: "m", path: "/admin/memo/new", label: "নতুন মেমো" },
  { key: "k", path: "/admin/khata", label: "খুচরা খাতা" },
  { key: "c", path: "/admin/collection", label: "কালেকশন" },
  { key: "p", path: "/admin/paona", label: "খুচরা পাওনা" },
  { key: "x", path: "/admin/cash", label: "ক্যাশ" },
  { key: "u", path: "/admin/users", label: "ইউজার" },
  { key: "d", path: "/admin/dena", label: "দেনা খাতা" },
  { key: "g", path: "/admin/messages", label: "Messages" },
  { key: "s", path: "/admin/stock", label: "স্টক" },
  { key: "r", path: "/admin/reports", label: "রিপোর্ট" },
  { key: "h", path: "/admin", label: "Dashboard" },
];

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

export function useKeyboardShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // Ignore repeat events (key hold)
      if (e.repeat) return;

      // Ignore typing in inputs
      if (isTypingTarget(e.target)) return;

      // Only Alt+letter (no Ctrl, Meta, or Shift)
      if (!e.altKey) return;
      if (e.ctrlKey || e.metaKey || e.shiftKey) return;

      const k = e.key.toLowerCase();
      const match = SHORTCUTS.find((s) => s.key === k);
      if (match) {
        e.preventDefault();
        navigate({ to: match.path });
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);
}

export const KEYBOARD_SHORTCUTS_LIST = SHORTCUTS;