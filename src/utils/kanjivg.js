const CDN_BASE = 'https://cdn.jsdelivr.net/gh/KanjiVG/kanjivg@r20250422/kanji';
const KVG_NS = 'http://kanjivg.tagaini.net';
const BREAKDOWN_CACHE_KEY = 'kanjiApp:kanjiBreakdownCache';
const LEGACY_BREAKDOWN_CACHE_KEY = 'kanjiBreakdownCache';
const BREAKDOWN_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const svgTextCache = new Map();

const UNSAFE_TAG_NAMES = new Set([
  'script',
  'foreignobject',
  'animate',
  'set',
]);

function unicodeFileName(character) {
  const code = character.codePointAt(0).toString(16).padStart(5, '0');
  return `${code}.svg`;
}

function isUnsafeUrl(value) {
  const normalized = String(value || '').replace(/\s+/g, '').toLowerCase();
  return normalized.startsWith('javascript:');
}

function sanitizeSvgElement(element) {
  if (!element) return;

  if (element.nodeType === Node.ELEMENT_NODE) {
    const tagName = element.tagName.toLowerCase();
    if (UNSAFE_TAG_NAMES.has(tagName)) {
      element.remove();
      return;
    }
  }

  if (element.attributes) {
    [...element.attributes].forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value;
      if (name.startsWith('on')) {
        element.removeAttribute(attribute.name);
        return;
      }
      if ((name === 'href' || name === 'xlink:href') && isUnsafeUrl(value)) {
        element.removeAttribute(attribute.name);
      }
    });
  }

  [...element.children].forEach((child) => sanitizeSvgElement(child));
}

export function parseSvgSafely(rawSvg) {
  const doc = new DOMParser().parseFromString(rawSvg, 'image/svg+xml');
  if (doc.querySelector('parsererror')) return null;

  doc.querySelectorAll('script, foreignObject, animate, set').forEach((node) => node.remove());
  sanitizeSvgElement(doc.documentElement);
  return doc.documentElement;
}

export async function fetchKanjiSvgText(character) {
  const cached = svgTextCache.get(character);
  if (cached) return cached;

  const response = await fetch(`${CDN_BASE}/${unicodeFileName(character)}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const text = await response.text();
  svgTextCache.set(character, text);
  return text;
}

function readBreakdownCache() {
  try {
    const raw = localStorage.getItem(BREAKDOWN_CACHE_KEY)
      || localStorage.getItem(LEGACY_BREAKDOWN_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeBreakdownCache(cache) {
  try {
    localStorage.setItem(BREAKDOWN_CACHE_KEY, JSON.stringify(cache));
    if (localStorage.getItem(LEGACY_BREAKDOWN_CACHE_KEY)) {
      localStorage.removeItem(LEGACY_BREAKDOWN_CACHE_KEY);
    }
  } catch {
    // ignore quota errors
  }
}

export function getCachedBreakdown(character) {
  const cache = readBreakdownCache();
  const entry = cache[character];
  if (!entry) return null;
  if (Date.now() - entry.savedAt > BREAKDOWN_CACHE_TTL_MS) return null;
  return entry.components;
}

export function setCachedBreakdown(character, components) {
  const cache = readBreakdownCache();
  cache[character] = { components, savedAt: Date.now() };
  writeBreakdownCache(cache);
}

export function extractComponents(rawSvg, character) {
  const doc = new DOMParser().parseFromString(rawSvg, 'image/svg+xml');
  if (doc.querySelector('parsererror')) return [];

  const groups = doc.querySelectorAll('g');
  let rootGroup = null;
  groups.forEach((group) => {
    if (rootGroup) return;
    if (group.getAttributeNS(KVG_NS, 'element') === character) rootGroup = group;
  });
  if (!rootGroup) return [];

  const result = [];
  rootGroup.querySelectorAll(':scope > g').forEach((child) => {
    const element = child.getAttributeNS(KVG_NS, 'element');
    if (!element || element === character) return;
    result.push({
      character: element,
      position: child.getAttributeNS(KVG_NS, 'position') || '',
      radical: child.getAttributeNS(KVG_NS, 'radical') || '',
    });
  });

  if (result.length === 0) {
    rootGroup.querySelectorAll('g').forEach((child) => {
      const element = child.getAttributeNS(KVG_NS, 'element');
      if (!element || element === character) return;
      if (result.some((item) => item.character === element)) return;
      result.push({
        character: element,
        position: child.getAttributeNS(KVG_NS, 'position') || '',
        radical: child.getAttributeNS(KVG_NS, 'radical') || '',
      });
    });
  }

  return result;
}

export function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
