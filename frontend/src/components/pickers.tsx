import { useTranslation } from "react-i18next";

// Only emoji that Windows 10 (Segoe UI Emoji) can draw: newer ones like 🥷 or ❤️‍🔥 show as an empty box.
export const DRILL_EMOJIS = [
  "🥊", "👊", "🤜", "💥", "🔥", "⚡", "💪", "🏃", "🦵", "🧘", "⏱️", "🔔",
  "🎯", "🛡️", "🤸", "🏋️", "🌀", "👟", "🥵", "🧊", "🏆", "⭐",
];

export const CARD_COLORS = [
  "#d62828", "#9b1b1b", "#f77f00", "#e9b949", "#2a9d8f", "#3a86ff", "#9d4edd", "#ef476f", "#6b7280", "#f5f5f5",
];

export const AVATAR_EMOJIS = ["🥊", "🔥", "⚡", "🐯", "🦁", "🐺", "🦅", "🐉", "🦈", "💪", "👊", "🏆", "⭐", "😎", "🤠"];

/** Last user-perceived character, so multi-code-point emoji (e.g. ❤️‍🔥) stay intact. */
export function lastGrapheme(text: string): string {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segments = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)];
    return segments.at(-1)?.segment ?? "";
  }
  return [...text].slice(-1).join("");
}

export function EmojiPicker({
  value,
  onChange,
  options = DRILL_EMOJIS,
  label,
}: {
  value: string;
  onChange: (emoji: string) => void;
  options?: string[];
  label?: string;
}) {
  const { t } = useTranslation();
  return (
    <fieldset>
      <legend className="mb-1 text-sm text-smoke">{label ?? t("drills.emoji")}</legend>
      <div className="flex flex-wrap items-center gap-1">
        {options.map((emoji) => (
          <button
            type="button"
            key={emoji}
            onClick={() => onChange(emoji)}
            className={`rounded-md p-1 text-2xl ${value === emoji ? "bg-glove" : "bg-ring hover:bg-rope"}`}
          >
            {emoji}
          </button>
        ))}
        <input
          aria-label={t("drills.customEmoji")}
          placeholder={t("drills.customEmoji")}
          value={options.includes(value) ? "" : value}
          onChange={(event) => event.target.value && onChange(lastGrapheme(event.target.value))}
          className="w-24 rounded-md border border-rope bg-ring px-2 py-1 text-center"
        />
      </div>
    </fieldset>
  );
}

export function ColorPicker({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (color: string) => void;
  label?: string;
}) {
  const { t } = useTranslation();
  return (
    <fieldset>
      <legend className="mb-1 text-sm text-smoke">{label ?? t("drills.color")}</legend>
      <div className="flex flex-wrap items-center gap-2">
        {CARD_COLORS.map((color) => (
          <button
            type="button"
            key={color}
            aria-label={color}
            onClick={() => onChange(color)}
            className={`h-8 w-8 rounded-full border-2 ${value === color ? "border-chalk" : "border-transparent"}`}
            style={{ backgroundColor: color }}
          />
        ))}
        <input
          type="color"
          aria-label={t("drills.customColor")}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-8 w-10 cursor-pointer rounded border border-rope bg-ring"
        />
      </div>
    </fieldset>
  );
}
