import assert from "node:assert/strict";
import test from "node:test";

import {
  mediaType,
  normalizeCharacterEntry,
  normalizeConfig,
  normalizeLobbyState,
  normalizeSections
} from "../scripts/utils.mjs";
import { SECTION_DEFINITIONS } from "../scripts/constants.mjs";

test("configuration normalization keeps every known section exactly once", () => {
  const sections = normalizeSections([
    { id: "chat", enabled: false, label: "Messages" },
    { id: "maps", enabled: true },
    { id: "chat", enabled: true },
    { id: "unknown" }
  ]);

  assert.equal(sections.length, SECTION_DEFINITIONS.length);
  assert.deepEqual(sections.slice(0, 2).map((section) => section.id), ["chat", "maps"]);
  assert.equal(sections[0].enabled, false);
  assert.equal(new Set(sections.map((section) => section.id)).size, sections.length);
});

test("configuration clamps visual and audio values", () => {
  const config = normalizeConfig({
    musicVolume: 5,
    backdropDarkness: -3,
    transitionDuration: 9000,
    accentColor: "red",
    textColor: "#123456"
  });

  assert.equal(config.musicVolume, 1);
  assert.equal(config.backdropDarkness, 0);
  assert.equal(config.transitionDuration, 2000);
  assert.equal(config.accentColor, "#d7a642");
  assert.equal(config.textColor, "#123456");
});

test("configuration preserves unfinished player-map rows while editing", () => {
  const config = normalizeConfig({ playerMaps: [{ name: "Arton", src: "" }] });
  assert.equal(config.playerMaps.length, 1);
  assert.equal(config.playerMaps[0].name, "Arton");
});

test("character entries keep their custom art and unique player links", () => {
  const entry = normalizeCharacterEntry({
    actorUuid: "Actor.hero",
    imageSrc: "characters/hero.webp",
    userIds: ["player-a", "player-a", "player-b", ""]
  });

  assert.deepEqual(entry, {
    actorUuid: "Actor.hero",
    imageSrc: "characters/hero.webp",
    userIds: ["player-a", "player-b"]
  });
});

test("configuration keeps one curated entry per actor", () => {
  const config = normalizeConfig({
    characterEntries: [
      { actorUuid: "Actor.hero", userIds: ["player-a"] },
      { actorUuid: "Actor.hero", userIds: ["player-b"] },
      { actorUuid: "" }
    ]
  });

  assert.equal(config.characterEntries.length, 1);
  assert.deepEqual(config.characterEntries[0].userIds, ["player-a"]);
});

test("media types recognize supported videos", () => {
  assert.equal(mediaType("menu.webm?cache=1"), "video");
  assert.equal(mediaType("menu.png"), "image");
});

test("lobby state defaults safely", () => {
  assert.deepEqual(normalizeLobbyState({}), { open: false, locked: true, openedAt: 0 });
  assert.deepEqual(normalizeLobbyState({ open: true, locked: false, openedAt: "42" }), {
    open: true,
    locked: false,
    openedAt: 42
  });
});
