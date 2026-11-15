import { useTranslation } from "react-i18next";

export const DRILL_EMOJIS = [
  "🥊", "👊", "🤜", "💥", "🔥", "⚡", "💪", "🏃", "🦵", "🧘", "⏱️", "🔔",
  "🎯", "🛡️", "🤸", "🪢", "🏋️", "❤️‍🔥", "🌀", "👟", "🥵", "🧊", "🏆", "⭐",
];

export const CARD_COLORS = [
  "#d62828", "#9b1b1b", "#f77f00", "#e9b949", "#2a9d8f", "#3a86ff", "#9d4edd", "#ef476f", "#6b7280", "#f5f5f5",
];

export function EmojiPicker({ value, onChange }: { value: string; onChange: (emoji: string) => void }) {
  const { t } = useTranslation();
  return (
    <fieldset>
      <legend className="mb-1 text-sm text-smoke">{t("drills.emoji")}</legend>
      <div className="flex flex-wrap items-center gap-1">
        {DRILL_EMOJIS.map((emoji) => (
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
          value={DRILL_EMOJIS.includes(value) ? "" : value}
          onChange={(event) => event.target.value && onChange([...event.target.value].slice(-1).join(""))}
          className="w-24 rounded-md border border-rope bg-ring px-2 py-1 text-center"
        />
      </div>
    </fieldset>
  );
}

export function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const { t } = useTranslation();
  return (
    <fieldset>
      <legend className="mb-1 text-sm text-smoke">{t("drills.color")}</legend>
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
