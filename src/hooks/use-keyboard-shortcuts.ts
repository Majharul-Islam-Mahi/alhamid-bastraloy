// src/hooks/use-keyboard-shortcuts.ts
// Global keyboard shortcuts — Alt + অক্ষর
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";

type Shortcut = {
  key: string; // single letter, lowercase
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

export function useKeyboardShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // Ignore when typing in input/textarea
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      // Alt + letter
      if (!e.altKey || e.ctrlKey || e.metaKey) return;

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
