function normalizeTag(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/^#+/, '').toLowerCase();
  if (!trimmed) return null;
  // Allow letters, numbers, underscore, hyphen. Remove everything else.
  const safe = trimmed.replace(/[^a-z0-9_-]/g, '');
  if (!safe) return null;
  return safe.slice(0, 40);
}

function normalizeHashtags(input: any): string[] {
  const candidates: string[] = [];

  const pushFromString = (s: string) => {
    const str = String(s ?? '').trim();
    if (!str) return;

    // If the user typed hashtags (e.g. "#party#narendra" or "#party #narendra"), split by "#".
    const hashtagMatches = str.match(/#[a-z0-9_-]+/gi);
    if (hashtagMatches && hashtagMatches.length > 0) {
      candidates.push(...hashtagMatches);
      return;
    }

    // Fallback: split by whitespace/commas.
    candidates.push(...str.split(/[\s,]+/g));
  };

  if (Array.isArray(input)) {
    input.forEach(v => pushFromString(String(v ?? '')));
  } else if (typeof input === 'string') {
    pushFromString(input);
  } else if (input == null) {
    // nothing
  } else {
    pushFromString(String(input));
  }

  const out: string[] = [];
  const seen = new Set<string>();
  for (const c of candidates) {
    const norm = normalizeTag(c);
    if (!norm) continue;
    if (seen.has(norm)) continue;
    seen.add(norm);
    out.push(norm);
    if (out.length >= 20) break;
  }
  return out;
}

export { normalizeTag, normalizeHashtags };
