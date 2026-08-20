import {
  DEFAULT_CONFIG,
  DEFAULT_LOBBY_STATE,
  SECTION_DEFINITIONS,
  VIDEO_EXTENSIONS
} from "./constants.mjs";

export function localize(key, fallback = key) {
  const translated = globalThis.game?.i18n?.localize?.(key);
  return translated && translated !== key ? translated : fallback;
}

export function format(key, data, fallback = key) {
  const translated = globalThis.game?.i18n?.format?.(key, data);
  return translated && translated !== key ? translated : fallback;
}

export function clone(value) {
  if (globalThis.foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
  return structuredClone(value);
}

export function clamp(value, min, max, fallback = min) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

export function normalizeColor(value, fallback) {
  const color = String(value ?? "").trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
}

export function normalizePath(value) {
  return String(value ?? "").trim();
}

export function makeId(prefix = "item") {
  const random = globalThis.foundry?.utils?.randomID?.() ?? Math.random().toString(36).slice(2, 12);
  return `${prefix}-${random}`;
}

export function normalizePlayerMap(value = {}) {
  return {
    id: String(value.id ?? makeId("map")),
    name: String(value.name ?? "").trim(),
    src: normalizePath(value.src)
  };
}

export function normalizeCharacterEntry(value = {}) {
  return {
    actorUuid: String(value.actorUuid ?? "").trim(),
    imageSrc: normalizePath(value.imageSrc),
    userIds: normalizeUuidList(value.userIds)
  };
}

export function normalizeSections(value) {
  const current = Array.isArray(value) ? value : [];
  const byId = new Map(current.map((section) => [section?.id, section]));
  const ordered = [];

  for (const source of current) {
    const definition = SECTION_DEFINITIONS.find((entry) => entry.id === source?.id);
    if (!definition || ordered.some((entry) => entry.id === source.id)) continue;
    ordered.push({
      id: source.id,
      enabled: source.enabled !== false,
      label: String(source.label ?? "").trim(),
      backgroundSrc: normalizePath(source.backgroundSrc)
    });
  }

  for (const definition of SECTION_DEFINITIONS) {
    if (ordered.some((entry) => entry.id === definition.id)) continue;
    const source = byId.get(definition.id) ?? {};
    ordered.push({
      id: definition.id,
      enabled: source.enabled !== false,
      label: String(source.label ?? "").trim(),
      backgroundSrc: normalizePath(source.backgroundSrc)
    });
  }

  return ordered;
}

function normalizeUuidList(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((entry) => String(entry ?? "").trim()).filter(Boolean))];
}

export function normalizeConfig(value = {}) {
  return {
    title: String(value.title ?? DEFAULT_CONFIG.title).trim() || DEFAULT_CONFIG.title,
    subtitle: String(value.subtitle ?? DEFAULT_CONFIG.subtitle).trim(),
    logoSrc: normalizePath(value.logoSrc),
    backgroundSrc: normalizePath(value.backgroundSrc),
    musicSrc: normalizePath(value.musicSrc),
    musicVolume: clamp(value.musicVolume, 0, 1, DEFAULT_CONFIG.musicVolume),
    accentColor: normalizeColor(value.accentColor, DEFAULT_CONFIG.accentColor),
    textColor: normalizeColor(value.textColor, DEFAULT_CONFIG.textColor),
    barColor: normalizeColor(value.barColor, DEFAULT_CONFIG.barColor),
    showBars: value.showBars !== false,
    backdropDarkness: clamp(value.backdropDarkness, 0, 0.9, DEFAULT_CONFIG.backdropDarkness),
    transitionDuration: Math.round(clamp(value.transitionDuration, 0, 2000, DEFAULT_CONFIG.transitionDuration)),
    lockPlayers: value.lockPlayers !== false,
    startSceneId: String(value.startSceneId ?? "").trim(),
    sections: normalizeSections(value.sections),
    playerMaps: Array.isArray(value.playerMaps)
      ? value.playerMaps.map(normalizePlayerMap)
      : [],
    characterEntries: Array.isArray(value.characterEntries)
      ? value.characterEntries
        .map(normalizeCharacterEntry)
        .filter((entry, index, entries) => entry.actorUuid && entries.findIndex((candidate) => candidate.actorUuid === entry.actorUuid) === index)
      : [],
    shopActorUuids: normalizeUuidList(value.shopActorUuids),
    questJournalUuids: normalizeUuidList(value.questJournalUuids),
    systemJournalUuids: normalizeUuidList(value.systemJournalUuids)
  };
}

export function normalizeLobbyState(value = {}) {
  return {
    open: Boolean(value.open ?? DEFAULT_LOBBY_STATE.open),
    locked: value.locked !== false,
    openedAt: Number(value.openedAt) || 0
  };
}

export function sectionDefinition(id) {
  return SECTION_DEFINITIONS.find((entry) => entry.id === id);
}

export function sectionLabel(section) {
  if (section?.label) return section.label;
  const definition = sectionDefinition(section?.id);
  return definition ? localize(definition.label, definition.id) : String(section?.id ?? "");
}

export function mediaType(src) {
  const clean = normalizePath(src).split(/[?#]/, 1)[0];
  const extension = clean.includes(".") ? clean.split(".").pop().toLowerCase() : "";
  return VIDEO_EXTENSIONS.has(extension) ? "video" : "image";
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function documentImage(document, fallback = "icons/svg/mystery-man.svg") {
  return normalizePath(
    document?.img
    ?? document?.thumbnail
    ?? document?.background?.src
    ?? document?.prototypeToken?.texture?.src
    ?? fallback
  ) || fallback;
}

export function canObserve(document, user = globalThis.game?.user) {
  if (!document || !user) return false;
  if (user.isGM) return true;
  if (typeof document.testUserPermission === "function") {
    return document.testUserPermission(user, "OBSERVER");
  }
  return Boolean(document.isOwner);
}

export function characterVisibleToUser(entry, user = globalThis.game?.user) {
  if (!entry || !user) return false;
  if (user.isGM) return true;
  return Array.isArray(entry.userIds) && entry.userIds.includes(user.id);
}

export function rootElement(value) {
  if (value instanceof HTMLElement) return value;
  return value?.[0] instanceof HTMLElement ? value[0] : null;
}

export function getFilePickerClass() {
  return globalThis.foundry?.applications?.apps?.FilePicker ?? globalThis.FilePicker;
}

export function openFilePicker({ type = "imagevideo", current = "", callback }) {
  const Picker = getFilePickerClass();
  if (!Picker) {
    globalThis.ui?.notifications?.error(localize("CampaignNexus.Errors.FilePickerUnavailable"));
    return;
  }
  const picker = new Picker({ type, current, callback });
  picker.render(true);
  requestAnimationFrame(() => rootElement(picker.element)?.classList.add("cn-over-menu"));
}

export function selectedOptions(items, selectedValues) {
  const selected = new Set(selectedValues);
  return items.map((item) => ({ ...item, selected: selected.has(item.uuid) }));
}
