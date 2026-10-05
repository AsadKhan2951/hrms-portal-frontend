import { getAvatarById, SUPERHERO_AVATARS } from "@shared/avatars";
import { fileUrl } from "@/lib/api";

/** True when the stored avatar is a picture (uploaded or remote) rather than a preset id. */
export function isPictureAvatar(avatar?: string | null): avatar is string {
  return Boolean(avatar) && /^(https?:\/\/|data:|\/)/.test(avatar as string);
}

function initialsOf(name?: string | null) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/**
 * A person's avatar as a circle: their uploaded picture, the preset they
 * chose, or their initials when they have neither.
 */
export default function AvatarFace({
  avatar,
  name,
  size = 36,
  fontSize,
}: {
  avatar?: string | null;
  name?: string | null;
  size?: number;
  fontSize?: number;
}) {
  const base = { flex: `0 0 ${size}px`, width: size, height: size, fontSize: fontSize ?? Math.round(size * 0.36) };
  if (isPictureAvatar(avatar)) {
    return (
      <span className="now-avatar" style={base}>
        <img src={fileUrl(avatar) ?? avatar} alt="" />
      </span>
    );
  }
  const preset = avatar && SUPERHERO_AVATARS.some(item => item.id === avatar) ? getAvatarById(avatar) : null;
  if (preset) {
    return (
      <span className="now-avatar" style={{ ...base, background: `${preset.color}33`, fontSize: Math.round(size * 0.5) }} aria-hidden="true">
        {preset.emoji}
      </span>
    );
  }
  return (
    <span className="now-avatar" style={base}>
      {initialsOf(name)}
    </span>
  );
}
