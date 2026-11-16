import type { FighterClass } from "../api/types";
import { fighterArt } from "../lib/fighterArt";

const sizes = { sm: "h-10 w-8 text-2xl", md: "h-24 w-20 text-5xl", lg: "h-56 w-44 text-8xl" };

/** A fighter class portrait: the coach's uploaded image, its bundled artwork, or its emoji. */
export default function FighterClassArt({ fighterClass, size = "md" }: { fighterClass: FighterClass; size?: keyof typeof sizes }) {
  const art = fighterClass.image_url ?? fighterArt(fighterClass.art_key);
  if (art) {
    return <img src={art} alt={fighterClass.name} className={`${sizes[size]} shrink-0 object-contain drop-shadow-lg`} />;
  }
  return (
    <span
      role="img"
      aria-label={fighterClass.name}
      className={`${sizes[size]} flex shrink-0 items-center justify-center rounded-[45%] border-4`}
      style={{ borderColor: fighterClass.color, backgroundColor: `${fighterClass.color}33` }}
    >
      {fighterClass.emoji}
    </span>
  );
}
