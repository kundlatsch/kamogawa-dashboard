import boxerPuncher from "../assets/fighter-classes/boxer-puncher.webp";
import counterpuncher from "../assets/fighter-classes/counterpuncher.webp";
import outBoxer from "../assets/fighter-classes/out-boxer.webp";
import slugger from "../assets/fighter-classes/slugger.webp";
import swarmer from "../assets/fighter-classes/swarmer.webp";
import switchHitter from "../assets/fighter-classes/switch-hitter.webp";

/** Artwork bundled for the default fighter classes, keyed by `FighterClass.art_key`. */
const ART: Record<string, string> = {
  "out-boxer": outBoxer,
  swarmer,
  slugger,
  "boxer-puncher": boxerPuncher,
  counterpuncher,
  "switch-hitter": switchHitter,
};

export const ART_KEYS = Object.keys(ART);

export const fighterArt = (key: string): string | null => ART[key] ?? null;
