import boxerPuncher from "../assets/fighter-classes/boxer-puncher.webp";
import counterpuncher from "../assets/fighter-classes/counterpuncher.webp";
import outBoxer from "../assets/fighter-classes/out-boxer.webp";
import slugger from "../assets/fighter-classes/slugger.webp";
import swarmer from "../assets/fighter-classes/swarmer.webp";
import switchHitter from "../assets/fighter-classes/switch-hitter.webp";
import rookie from "../assets/fighter-classes/rookie.webp";
import mystery from "../assets/fighter-classes/mystery.webp";
import defensive from "../assets/fighter-classes/defensive.webp";
import aggressor from "../assets/fighter-classes/aggressor.webp";
import tactician from "../assets/fighter-classes/tactician.webp";
import endurance from "../assets/fighter-classes/endurance.webp";
import speedster from "../assets/fighter-classes/speedster.webp";
import comeback from "../assets/fighter-classes/comeback.webp";
import champion from "../assets/fighter-classes/champion.webp";

/** Artwork bundled with the app (default classes plus extra art coaches can pick), keyed by `FighterClass.art_key`. */
const ART: Record<string, string> = {
  "out-boxer": outBoxer,
  swarmer,
  slugger,
  "boxer-puncher": boxerPuncher,
  counterpuncher,
  "switch-hitter": switchHitter,
  rookie,
  mystery,
  defensive,
  aggressor,
  tactician,
  endurance,
  speedster,
  comeback,
  champion,
};

export const ART_KEYS = Object.keys(ART);

export const fighterArt = (key: string): string | null => ART[key] ?? null;
