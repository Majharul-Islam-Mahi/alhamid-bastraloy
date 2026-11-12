// src/components/shared/UserAvatar.tsx
// SAFE version with logging — diagnose crashes
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  path: string | null | undefined;
  name: string;
  size?: number;
  className?: string;
  borderColor?: string;
  bgColor?: string;
  textColor?: string;
};

export function UserAvatar({
  path,
  name,
  size = 40,
  className = "",
  borderColor,
  bgColor = "linear-gradient(135deg, #d9a85a 0%, #b57f38 100%)",
  textColor = "#2e1c12",
}: Props) {
  const [error, setError] = useState(false);

  // SAFE getPublicUrl — wrapped in try/catch
  let url: string | null = null;
  if (path) {
    try {
      const result = supabase.storage.from("avatars").getPublicUrl(path);
      url = result?.data?.publicUrl ?? null;
    } catch (e) {
      console.error("[UserAvatar] getPublicUrl failed:", e, "path:", path);
      url = null;
    }
  }

  const letter = (name || "?").trim().charAt(0) || "?";

  if (url && !error) {
    return (
      <img
        src={url}
        alt={name}
        onError={(e) => {
          console.warn("[UserAvatar] image load failed:", url);
          setError(true);
        }}
        loading="lazy"
        className={`rounded-full object-cover ${className}`}
        style={{
          width: size,
          height: size,
          flexShrink: 0,
          ...(borderColor ? { border: `2px solid ${borderColor}` } : {}),
        }}
      />
    );
  }

  return (
    <div
      className={`flex items-center justify-center rounded-full font-bold ${className}`}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        background: bgColor,
        color: textColor,
        fontSize: Math.max(11, Math.round(size * 0.4)),
        fontFamily: "'Tiro Bangla', serif",
        ...(borderColor ? { border: `2px solid ${borderColor}` } : {}),
      }}
    >
      {letter}
    </div>
  );
}