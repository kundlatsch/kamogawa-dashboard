import type { PublicUser } from "../api/types";

const sizes = {
  /** Inline next to a name (scales with the text). */
  inline: "h-[1.3em] w-[1.3em] text-[1em]",
  md: "h-10 w-10 text-xl",
  lg: "h-16 w-16 text-3xl",
};

/** A person's profile photo, or their emoji when they have none. */
export default function Avatar({
  person,
  size = "inline",
  ring = false,
}: {
  person: Pick<PublicUser, "display_name" | "avatar_emoji" | "avatar_url" | "color">;
  size?: keyof typeof sizes;
  /** Draw the person's color around the avatar. */
  ring?: boolean;
}) {
  const style = ring ? { backgroundColor: `${person.color}33`, border: `2px solid ${person.color}` } : undefined;
  const base = `inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full align-middle ${sizes[size]}`;
  if (person.avatar_url) {
    return <img src={person.avatar_url} alt="" className={`${base} object-cover`} style={style} />;
  }
  return (
    <span className={base} style={style} aria-hidden>
      {person.avatar_emoji}
    </span>
  );
}
