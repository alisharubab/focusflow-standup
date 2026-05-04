export const AVATARS = [
  { emoji: "🌸", bg: "#FCE4EC" },
  { emoji: "🌼", bg: "#FFF8E1" },
  { emoji: "🌺", bg: "#FFE4E1" },
  { emoji: "🌻", bg: "#FFF3C4" },
  { emoji: "💐", bg: "#EDE7F6" },
];

export const DEFAULT_AVATAR = AVATARS[0].emoji;

export function avatarBg(emoji?: string | null): string | null {
  return AVATARS.find((a) => a.emoji === emoji)?.bg ?? null;
}
