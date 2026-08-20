import {
  DEFAULT_CONFIG,
  MODULE_ID,
  MODULE_PATH,
  SECTION_DEFINITIONS
} from "./constants.mjs";
import {
  clamp,
  clone,
  localize,
  normalizeConfig,
  normalizePlayerMap,
  openFilePicker,
  sectionLabel
} from "./utils.mjs";

function elementOf(app) {
  return app.element instanceof HTMLElement ? app.element : app.element?.[0];
}

function field(root, name) {
  return root?.querySelector(`[data-field="${name}"]`);
}

function readDraft(app) {
  const root = elementOf(app);
  if (!root) return app.draft;

  const sections = [...root.querySelectorAll("[data-section-id]")].map((row) => ({
    id: row.dataset.sectionId,
    enabled: row.querySelector('[data-section-field="enabled"]')?.checked ?? false,
    label: row.querySelector('[data-section-field="label"]')?.value ?? "",
    backgroundSrc: row.querySelector('[data-section-field="backgroundSrc"]')?.value ?? ""
  }));

  const playerMaps = [...root.querySelectorAll("[data-player-map-index]")].map((row) => normalizePlayerMap({
    id: row.dataset.mapId,
    name: row.querySelector('[data-map-field="name"]')?.value ?? "",
    src: row.querySelector('[data-map-field="src"]')?.value ?? ""
  }));

  app.draft = normalizeConfig({
    title: field(root, "title")?.value,
    subtitle: field(root, "subtitle")?.value,
    logoSrc: field(root, "logoSrc")?.value,
    backgroundSrc: field(root, "backgroundSrc")?.value,
    musicSrc: field(root, "musicSrc")?.value,
    musicVolume: field(root, "musicVolume")?.value,
    accentColor: field(root, "accentColor")?.value,
    textColor: field(root, "textColor")?.value,
    backdropDarkness: field(root, "backdropDarkness")?.value,
    transitionDuration: field(root, "transitionDuration")?.value,
    lockPlayers: field(root, "lockPlayers")?.checked,
    startSceneId: field(root, "startSceneId")?.value,
    sections,
    playerMaps,
    shopActorUuids: [...root.querySelectorAll('[data-collection="shops"] input:checked')].map((input) => input.value),
    questJournalUuids: [...root.querySelectorAll('[data-collection="quests"] input:checked')].map((input) => input.value),
    systemJournalUuids: [...root.querySelectorAll('[data-collection="systems"] input:checked')].map((input) => input.value)
  });
  return app.draft;
}

async function rerender(app, mutate) {
  readDraft(app);
  mutate(app.draft);
  await app.render({ force: true });
}

async function onAddMap() {
  await rerender(this, (draft) => draft.playerMaps.push(normalizePlayerMap({})));
}

async function onRemoveMap(_event, target) {
  const index = Number(target.dataset.index);
  await rerender(this, (draft) => draft.playerMaps.splice(index, 1));
}

async function onMoveMap(_event, target) {
  const index = Number(target.dataset.index);
  const direction = Number(target.dataset.direction);
  await rerender(this, (draft) => {
    const next = index + direction;
    if (next < 0 || next >= draft.playerMaps.length) return;
    [draft.playerMaps[index], draft.playerMaps[next]] = [draft.playerMaps[next], draft.playerMaps[index]];
  });
}

async function onMoveSection(_event, target) {
  const index = Number(target.dataset.index);
  const direction = Number(target.dataset.direction);
  await rerender(this, (draft) => {
    const next = index + direction;
    if (next < 0 || next >= draft.sections.length) return;
    [draft.sections[index], draft.sections[next]] = [draft.sections[next], draft.sections[index]];
  });
}

function browsePath(app, target, type, setter) {
  readDraft(app);
  openFilePicker({
    type,
    current: target.dataset.current ?? "",
    callback: async (path) => {
      setter(path);
      await app.render({ force: true });
    }
  });
}

async function onBrowseGlobal(_event, target) {
  const key = target.dataset.key;
  browsePath(this, target, target.dataset.type ?? "imagevideo", (path) => {
    this.draft[key] = path;
  });
}

async function onBrowseSection(_event, target) {
  const index = Number(target.dataset.index);
  browsePath(this, target, "imagevideo", (path) => {
    if (this.draft.sections[index]) this.draft.sections[index].backgroundSrc = path;
  });
}

async function onBrowseMap(_event, target) {
  const index = Number(target.dataset.index);
  browsePath(this, target, "imagevideo", (path) => {
    if (this.draft.playerMaps[index]) this.draft.playerMaps[index].src = path;
  });
}

async function onPreview() {
  readDraft(this);
  await globalThis.CampaignNexus?.preview?.(this.draft);
}

async function onReset() {
  this.draft = normalizeConfig(clone(DEFAULT_CONFIG));
  await this.render({ force: true });
}

async function submitConfiguration(_event, _form, _formData) {
  readDraft(this);
  this.draft.playerMaps = this.draft.playerMaps.filter((entry) => entry.src);
  await game.settings.set(MODULE_ID, "configuration", this.draft);
  globalThis.CampaignNexus?.refresh?.();
  ui.notifications?.info(localize("CampaignNexus.Notifications.Saved", "Campaign Nexus configuration saved."));
}

export function createConfigApplicationClass() {
  const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

  return class CampaignNexusConfig extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
      id: `${MODULE_ID}-config`,
      tag: "form",
      classes: ["campaign-nexus-config"],
      position: { width: 900, height: 780 },
      window: {
        title: localize("CampaignNexus.Config.Title", "Campaign Nexus Configuration"),
        icon: "fa-solid fa-compass",
        resizable: true
      },
      form: {
        closeOnSubmit: false,
        submitOnChange: false,
        handler: submitConfiguration
      },
      actions: {
        addMap: onAddMap,
        removeMap: onRemoveMap,
        moveMap: onMoveMap,
        moveSection: onMoveSection,
        browseGlobal: onBrowseGlobal,
        browseSection: onBrowseSection,
        browseMap: onBrowseMap,
        preview: onPreview,
        reset: onReset
      }
    };

    static PARTS = {
      body: { template: `${MODULE_PATH}/templates/config.hbs` },
      footer: { template: `${MODULE_PATH}/templates/config-footer.hbs` }
    };

    constructor(options = {}) {
      super(options);
      this.draft = normalizeConfig(clone(game.settings.get(MODULE_ID, "configuration")));
    }

    async _prepareContext(options) {
      const context = await super._prepareContext(options);
      const selectedShops = new Set(this.draft.shopActorUuids);
      const selectedQuests = new Set(this.draft.questJournalUuids);
      const selectedSystems = new Set(this.draft.systemJournalUuids);

      const sections = this.draft.sections.map((section, index, items) => ({
        ...section,
        index,
        displayName: sectionLabel(section),
        icon: SECTION_DEFINITIONS.find((entry) => entry.id === section.id)?.icon,
        first: index === 0,
        last: index === items.length - 1
      }));

      const playerMaps = this.draft.playerMaps.map((map, index, items) => ({
        ...map,
        index,
        position: index + 1,
        first: index === 0,
        last: index === items.length - 1
      }));

      const actors = (game.actors?.contents ?? []).map((actor) => ({
        uuid: actor.uuid,
        name: actor.name,
        img: actor.img,
        selected: selectedShops.has(actor.uuid)
      }));
      const journals = (game.journal?.contents ?? []).map((journal) => ({
        uuid: journal.uuid,
        name: journal.name,
        img: journal.img,
        questSelected: selectedQuests.has(journal.uuid),
        systemSelected: selectedSystems.has(journal.uuid)
      }));
      const scenes = [{ id: "", name: localize("CampaignNexus.Config.NoScene", "Do not change scene") }]
        .concat((game.scenes?.contents ?? []).map((scene) => ({ id: scene.id, name: scene.name })));

      return {
        ...context,
        config: this.draft,
        sections,
        playerMaps,
        actors,
        journals,
        scenes: scenes.map((scene) => ({ ...scene, selected: scene.id === this.draft.startSceneId })),
        musicVolumePercent: Math.round(clamp(this.draft.musicVolume, 0, 1, 0.2) * 100),
        darknessPercent: Math.round(clamp(this.draft.backdropDarkness, 0, 0.9, 0.46) * 100)
      };
    }

    _onRender(context, options) {
      super._onRender(context, options);
      const root = elementOf(this);
      root?.addEventListener("input", (event) => {
        const input = event.target;
        if (!(input instanceof HTMLInputElement) || !input.dataset.output) return;
        const output = root.querySelector(`[data-output="${input.dataset.output}"]`);
        if (!output) return;
        output.textContent = `${Math.round(Number(input.value) * 100)}%`;
      });
    }
  };
}
