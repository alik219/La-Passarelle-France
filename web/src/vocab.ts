import type { VocabWord } from "./api";

/**
 * Checking drill answers. Case never matters. Missing accents or a small typo is
 * "almost right" (it still counts as right), and the correct spelling is always shown.
 */

export type Verdict = { result: "right" | "almost" | "wrong"; note?: string };

/** Lowercase, straight apostrophes, œ → oe, no punctuation or « », single spaces. */
function norm(s: string) {
  return s
    .toLowerCase()
    .replace(/[’`´]/g, "'")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/[«»"“”.!?,;:…()]/g, " ")
    .replace(/'\s+/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Also without accents. */
function plain(s: string) {
  return norm(s).normalize("NFD").replace(/\p{M}/gu, "");
}

function distance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

/** Typos allowed: none for short words (« mai » isn't « mais »), 1 for most words, 2 for long expressions. */
const tolerance = (len: number) => (len <= 4 ? 0 : len <= 7 ? 1 : 2);

const contains = (text: string, part: string) => ` ${text} `.includes(` ${part} `) || text.startsWith(part + " ");

type Match = "exact" | "accents" | "typo" | null;

function compare(input: string, target: string): Match {
  const [ni, nt] = [norm(input), norm(target)];
  if (!ni || !nt) return null;
  if (ni === nt || contains(ni, nt)) return "exact"; // a spoken answer may be a short sentence
  const [pi, pt] = [plain(input), plain(target)];
  if (pi === pt || contains(pi, pt)) return "accents";
  if (distance(pi, pt) <= tolerance(pt.length)) return "typo";
  return null;
}

function spelled(m: Match, correct: string): Verdict {
  if (m === "exact") return { result: "right" };
  if (m === "accents") return { result: "almost", note: `Watch the accents: « ${correct} ».` };
  return { result: "almost", note: `Small typo: it's spelled « ${correct} ».` };
}

/** The word without its article, reflexive pronoun or "être": "le loyer" → "loyer". */
export function core(fr: string) {
  return fr.replace(/^(le |la |les |l'|l’|se |s'|s’|être )/i, "");
}

const GENDER_NAME = { m: "masculine", f: "feminine" } as const;

/** Fill in the blank: the answer is the word exactly as it appears in the sentence. */
export function checkFill(input: string, word: VocabWord, blank: string): Verdict {
  const m = compare(input, blank);
  const dictionaryForm = plain(blank) !== plain(core(word.fr)) && (compare(input, word.fr) || compare(input, core(word.fr)));
  // « spacieux » for « spacieuse » is one letter off, but it's the agreement, not a typo.
  if (m && !(m === "typo" && dictionaryForm)) return spelled(m, blank);
  if (dictionaryForm) {
    return { result: "almost", note: `Right word. In this sentence it's « ${blank} ».` };
  }
  return { result: "wrong" };
}

/** Say it in French: nouns are expected with their article, to learn the gender. */
export function checkSay(input: string, word: VocabWord): Verdict {
  // An exact match with any accepted answer beats a near miss of another.
  const accepted = word.accept.map((t) => compare(input, t));
  const best = (["exact", "accents", "typo"] as const).find((q) => accepted.includes(q));
  if (best) return spelled(best, word.fr);
  const full = compare(input, word.fr);
  const bare = core(word.fr);
  if (bare === word.fr) return full ? spelled(full, word.fr) : { result: "wrong" };
  // « la loyer » is one letter from « le loyer », but it's a gender slip, not a typo.
  if (full === "exact" || full === "accents") return spelled(full, word.fr);

  const said = plain(input).match(/^(le |la |les |l'|un |une |des )(.+)$/);
  const rest = said ? said[2] : plain(input);
  const m = compare(rest, bare);
  if (!m) return full ? spelled(full, word.fr) : { result: "wrong" };
  if (!word.article) return { result: "almost", note: `Nearly: the full form is « ${word.fr} ».` };
  if (!said) return { result: "almost", note: `Remember the article: « ${word.fr} »${genderTag(word)}.` };

  const article = said[1].trim();
  const plural = word.article === "les";
  const gender = article === "le" || article === "un" ? "m" : article === "la" || article === "une" ? "f" : null;
  const fine = plural
    ? article === "les" || article === "des"
    : article === "l'" || (gender !== null && gender === word.gender);
  if (fine) return spelled(m, word.fr);
  return {
    result: "almost",
    note: plural ? `It's plural: « ${word.fr} ».` : `Watch the gender: « ${word.fr} »${genderTag(word)}.`,
  };
}

function genderTag(word: VocabWord) {
  return word.gender ? ` (${GENDER_NAME[word.gender]})` : "";
}

/** The example sentence split around the word: [before, word, after]. */
export function splitExample(example: string): [string, string, string] {
  const m = example.match(/^(.*?)\{(.+?)\}(.*)$/);
  return m ? [m[1], m[2], m[3]] : [example, "", ""];
}

/** The sentence as Claire reads it (without the braces). */
export const sentenceText = (example: string) => example.replace(/[{}]/g, "");

/** "Back tomorrow", "Back in 3 days · Mon 19 Oct". */
export function dueLabel(days: number, due: string) {
  if (days <= 1) return "Back tomorrow";
  const date = new Date(`${due}T12:00:00`);
  return `Back in ${days} days · ${new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" }).format(date)}`;
}
