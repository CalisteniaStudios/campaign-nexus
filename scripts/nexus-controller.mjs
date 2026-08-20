import {
  MODULE_ID,
  SOCKET_NAME,
  STYLISH_SHOP_IDS
} from "./constants.mjs";
import {
  canObserve,
  documentImage,
  escapeHtml,
  format,
  localize,
  mediaType,
  normalizeConfig,
  normalizeLobbyState,
  rootElement,
  sectionDefinition,
  sectionLabel
} from "./utils.mjs";

function userCanSeeMessage(message) {
  if (game.user?.isGM) return true;
  if (typeof message?.visible === "boolean") return message.visible;
  if (!message?.whisper?.length) return true;
  return message.whisper.includes(game.user?.id) || message.user?.id === game.user?.id;
}

async function resolveDocuments(uuids) {
  const results = await Promise.all((uuids ?? []).map(async (uuid) => {
    try {
      return await globalThis.fromUuid?.(uuid);
    } catch (_error) {
      return null;
    }
  }));
  return results.filter(Boolean);
}

function emptyState(icon, title, detail = "") {
  return `
    <div class="cn-empty-state">
      <i class="${icon}"></i>
      <h2>${escapeHtml(title)}</h2>
      ${detail ? `<p>${escapeHtml(detail)}</p>` : ""}
    </div>`;
}

function searchBar(placeholder) {
  return `
    <label class="cn-search">
      <i class="fa-solid fa-magnifying-glass"></i>
      <input type="search" data-cn-search placeholder="${escapeHtml(placeholder)}" autocomplete="off">
    </label>`;
}

export class CampaignNexusController {
  constructor() {
    this.overlay = null;
    this.config = normalizeConfig();
    this.currentSection = "home";
    this.previewMode = false;
    this.locked = false;
    this.audio = null;
    this.lightbox = null;
    this.characterUserId = "";
    this.foundrySettingsActions = [];
    this.boundKeydown = this.#onKeydown.bind(this);
  }

  initialize() {
    if (this.overlay) return;
    const overlay = document.createElement("div");
    overlay.id = `${MODULE_ID}-overlay`;
    overlay.className = "cn-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <div class="cn-background" aria-hidden="true"></div>
      <div class="cn-shade" aria-hidden="true"></div>
      <header class="cn-header">
        <button type="button" class="cn-brand" data-cn-action="home" aria-label="${escapeHtml(localize("CampaignNexus.Actions.Home", "Home"))}">
          <span class="cn-logo-slot"></span>
          <span class="cn-brand-copy"><strong></strong><small></small></span>
        </button>
        <div class="cn-header-actions">
          <button type="button" class="cn-icon-button cn-gm-only" data-cn-action="configure" title="${escapeHtml(localize("CampaignNexus.Actions.Configure", "Configure"))}"><i class="fa-solid fa-gear"></i></button>
          <button type="button" class="cn-icon-button" data-cn-action="close" title="${escapeHtml(localize("CampaignNexus.Actions.Close", "Close"))}"><i class="fa-solid fa-xmark"></i></button>
        </div>
      </header>
      <nav class="cn-navigation" aria-label="${escapeHtml(localize("CampaignNexus.Navigation", "Campaign menu"))}"></nav>
      <main class="cn-content" tabindex="-1"></main>
      <footer class="cn-footer">
        <div class="cn-footer-status"></div>
        <div class="cn-gm-controls cn-gm-only">
          <button type="button" class="cn-button cn-button-secondary" data-cn-action="show-all"><i class="fa-solid fa-users-viewfinder"></i><span>${escapeHtml(localize("CampaignNexus.Actions.ShowAll", "Open for Everyone"))}</span></button>
          <button type="button" class="cn-button cn-button-primary" data-cn-action="start-game"><i class="fa-solid fa-play"></i><span>${escapeHtml(localize("CampaignNexus.Actions.StartGame", "Start Game"))}</span></button>
        </div>
      </footer>
      <div class="cn-lightbox" hidden></div>`;
    document.body.append(overlay);
    this.overlay = overlay;
    this.lightbox = overlay.querySelector(".cn-lightbox");
    overlay.addEventListener("click", (event) => this.#onClick(event));
    overlay.addEventListener("input", (event) => this.#onInput(event));
    overlay.addEventListener("change", (event) => this.#onChange(event));
    overlay.addEventListener("submit", (event) => this.#onSubmit(event));
    window.addEventListener("keydown", this.boundKeydown, true);
  }

  get isOpen() {
    return this.overlay?.classList.contains("is-visible") ?? false;
  }

  get enabledSections() {
    return this.config.sections.filter((section) => section.enabled);
  }

  async open(section = "home", { config = null, preview = false, locked = null } = {}) {
    this.initialize();
    this.config = normalizeConfig(config ?? game.settings.get(MODULE_ID, "configuration"));
    this.previewMode = Boolean(preview);
    const lobbyState = normalizeLobbyState(game.settings.get(MODULE_ID, "lobbyState"));
    this.locked = locked ?? (!game.user.isGM && lobbyState.open && lobbyState.locked);
    this.currentSection = section === "home" || this.enabledSections.some((entry) => entry.id === section)
      ? section
      : "home";

    this.#applyTheme();
    this.#renderShell();
    await this.renderCurrentSection();
    this.overlay.classList.add("is-visible");
    this.overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("campaign-nexus-active");
    await this.#startAudio();
    this.overlay.querySelector(".cn-content")?.focus({ preventScroll: true });
  }

  async close({ force = false } = {}) {
    if (!this.isOpen) return;
    if (!force && this.locked && !game.user.isGM && !this.previewMode) {
      ui.notifications?.warn(localize("CampaignNexus.Warnings.Locked", "The Game Master has locked the campaign menu."));
      return;
    }
    this.overlay.classList.remove("is-visible");
    this.overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("campaign-nexus-active");
    this.#stopAudio();
    this.#closeLightbox();
    document.querySelectorAll(".cn-over-menu, .cn-file-picker-over-menu").forEach((element) => {
      element.classList.remove("cn-over-menu", "cn-file-picker-over-menu");
    });
  }

  async toggle() {
    if (this.isOpen) return this.close();
    return this.open();
  }

  async preview(config) {
    return this.open("home", { config, preview: true, locked: false });
  }

  async refresh() {
    if (!this.isOpen || this.previewMode) return;
    return this.open(this.currentSection);
  }

  async showToAll() {
    if (!game.user.isGM) return;
    const config = normalizeConfig(game.settings.get(MODULE_ID, "configuration"));
    const state = { open: true, locked: config.lockPlayers, openedAt: Date.now() };
    await game.settings.set(MODULE_ID, "lobbyState", state);
    game.socket.emit(SOCKET_NAME, { action: "open", userId: game.user.id, state });
    await this.open("home", { locked: false });
  }

  async startGame() {
    if (!game.user.isGM) return;
    const sceneId = this.config.startSceneId;
    const scene = sceneId ? game.scenes?.get(sceneId) : null;
    if (scene && !scene.active) await scene.activate();
    const state = { open: false, locked: false, openedAt: 0 };
    await game.settings.set(MODULE_ID, "lobbyState", state);
    game.socket.emit(SOCKET_NAME, { action: "close", userId: game.user.id, state });
    await this.close({ force: true });
  }

  async handleSocket(payload = {}) {
    const sender = game.users?.get(payload.userId);
    if (!sender?.isGM) return;
    if (payload.action === "open") {
      const state = normalizeLobbyState(payload.state);
      await this.open("home", { locked: !game.user.isGM && state.locked });
    }
    if (payload.action === "close") await this.close({ force: true });
  }

  async handleLobbyState(value) {
    const state = normalizeLobbyState(value);
    if (state.open && !this.isOpen) await this.open("home", { locked: !game.user.isGM && state.locked });
    if (!state.open && this.isOpen && !this.previewMode) await this.close({ force: true });
  }

  async renderCurrentSection({ characterTransition = null } = {}) {
    if (!this.overlay) return;
    const content = this.overlay.querySelector(".cn-content");
    content.classList.add("is-changing");
    const html = await this.#sectionHtml(this.currentSection);
    content.innerHTML = html;
    requestAnimationFrame(() => {
      content.classList.remove("is-changing");
      if (characterTransition) this.#animateCharacterTransition(content, characterTransition);
    });
    this.#updateBackground();
    this.#renderNavigation();
  }

  async #sectionHtml(section) {
    switch (section) {
      case "maps": return this.#mapsHtml();
      case "characters": return this.#charactersHtml();
      case "journals": return this.#journalsHtml();
      case "shops": return this.#shopsHtml();
      case "quests": return this.#curatedJournalHtml("quests", this.config.questJournalUuids);
      case "systems": return this.#curatedJournalHtml("systems", this.config.systemJournalUuids);
      case "compendiums": return this.#compendiumsHtml();
      case "chat": return this.#chatHtml();
      case "settings": return this.#settingsHtml();
      default: return this.#homeHtml();
    }
  }

  #homeHtml() {
    return `
      <section class="cn-home-page">
        <div class="cn-home-hero">
          <div class="cn-ornament"><span></span><i class="fa-solid fa-diamond"></i><span></span></div>
          <h1>${escapeHtml(this.config.title)}</h1>
          ${this.config.subtitle ? `<p>${escapeHtml(this.config.subtitle)}</p>` : ""}
        </div>
      </section>`;
  }

  #pageHeader(id, count = null) {
    const section = this.config.sections.find((entry) => entry.id === id);
    const definition = sectionDefinition(id);
    return `
      <header class="cn-page-header">
        <span class="cn-page-icon"><i class="${definition?.icon ?? "fa-solid fa-diamond"}"></i></span>
        <div><h1>${escapeHtml(sectionLabel(section))}</h1>${count === null ? "" : `<p>${format("CampaignNexus.Page.ItemCount", { count }, `${count} items`)}</p>`}</div>
      </header>`;
  }

  #mapsHtml() {
    if (game.user.isGM) {
      const scenes = game.scenes?.contents ?? [];
      const cards = scenes.map((scene) => `
        <article class="cn-library-card cn-map-card" data-searchable="${escapeHtml(scene.name.toLowerCase())}">
          <div class="cn-card-art"><img src="${escapeHtml(documentImage(scene, "icons/svg/map.svg"))}" alt=""></div>
          <div class="cn-card-body"><h2>${escapeHtml(scene.name)}</h2><p>${scene.active ? escapeHtml(localize("CampaignNexus.Maps.Active", "Active scene")) : "&nbsp;"}</p></div>
          <div class="cn-card-actions">
            <button type="button" data-cn-action="view-scene" data-id="${scene.id}"><i class="fa-solid fa-eye"></i>${escapeHtml(localize("CampaignNexus.Actions.View", "View"))}</button>
            <button type="button" data-cn-action="activate-scene" data-id="${scene.id}"><i class="fa-solid fa-bolt"></i>${escapeHtml(localize("CampaignNexus.Actions.Activate", "Activate"))}</button>
          </div>
        </article>`).join("");
      return `${this.#pageHeader("maps", scenes.length)}${searchBar(localize("CampaignNexus.Search.Maps", "Search maps..."))}<div class="cn-library-grid">${cards || emptyState("fa-solid fa-map", localize("CampaignNexus.Empty.Maps", "No maps found."))}</div>`;
    }

    const maps = this.config.playerMaps.filter((map) => map.src);
    const cards = maps.map((map) => `
      <button type="button" class="cn-library-card cn-player-map-card" data-searchable="${escapeHtml(map.name.toLowerCase())}" data-cn-action="lightbox" data-src="${escapeHtml(map.src)}" data-name="${escapeHtml(map.name)}">
        <span class="cn-card-art">${mediaType(map.src) === "video" ? `<video src="${escapeHtml(map.src)}" muted preload="metadata"></video>` : `<img src="${escapeHtml(map.src)}" alt="">`}</span>
        <span class="cn-card-body"><strong>${escapeHtml(map.name || localize("CampaignNexus.Maps.Untitled", "Untitled map"))}</strong></span>
      </button>`).join("");
    return `${this.#pageHeader("maps", maps.length)}${searchBar(localize("CampaignNexus.Search.Maps", "Search maps..."))}<div class="cn-library-grid">${cards || emptyState("fa-solid fa-map", localize("CampaignNexus.Empty.PlayerMaps", "The Game Master has not shared any maps yet."))}</div>`;
  }

  async #charactersHtml() {
    const users = new Map((game.users?.contents ?? []).map((user) => [user.id, user]));
    const configured = await Promise.all(this.config.characterEntries.map(async (entry) => {
      try {
        return { entry, actor: await globalThis.fromUuid?.(entry.actorUuid) };
      } catch (_error) {
        return { entry, actor: null };
      }
    }));
    const storedProfiles = this.config.characterProfiles;
    const profileSources = storedProfiles.length
      ? storedProfiles.filter((profile) => profile.enabled)
      : [...new Set(this.config.characterEntries.flatMap((entry) => entry.userIds))]
        .map((userId) => ({ userId, enabled: true, imageSrc: "" }));
    const profiles = profileSources
      .map((profile, index) => {
        const user = users.get(profile.userId);
        if (!user) return null;
        const linked = configured.filter(({ entry }) => entry.userIds.includes(profile.userId));
        const fallback = linked.find(({ entry, actor }) => entry.imageSrc || entry.actorImageSrc || actor)?.entry;
        const fallbackActor = linked.find(({ actor }) => actor)?.actor;
        return {
          ...profile,
          index,
          user,
          linked,
          imageSrc: profile.imageSrc
            || user.avatar
            || fallback?.imageSrc
            || fallback?.actorImageSrc
            || documentImage(fallbackActor)
        };
      })
      .filter(Boolean);
    const selectedProfile = profiles.find((profile) => profile.userId === this.characterUserId) ?? null;

    if (!selectedProfile) {
      this.characterUserId = "";
      const profileCards = profiles.map((profile, index) => `
        <button type="button" class="cn-character-profile-card" style="--cn-card-index:${index}" data-cn-action="select-character-user" data-user-id="${escapeHtml(profile.userId)}" aria-label="${escapeHtml(profile.user.name)}" title="${escapeHtml(profile.user.name)}">
          <span class="cn-character-profile-art"><img src="${escapeHtml(profile.imageSrc)}" alt=""></span>
          <span class="cn-character-profile-shine"></span>
        </button>`).join("");
      return `<section class="cn-character-page"><div class="cn-character-profile-gallery">${profileCards || emptyState("fa-solid fa-user-group", localize("CampaignNexus.Empty.CharacterProfiles", "The Game Master has not configured any player portraits yet."))}</div></section>`;
    }

    const cards = selectedProfile.linked.map(({ entry, actor }, index) => {
      const name = actor?.name || entry.actorName || localize("CampaignNexus.Characters.Unknown", "Unknown character");
      const image = entry.imageSrc || entry.actorImageSrc || documentImage(actor);
      return `
        <button type="button" class="cn-character-card" style="--cn-card-index:${index}" data-cn-action="open-character" data-uuid="${escapeHtml(entry.actorUuid)}">
          <span class="cn-character-art"><img src="${escapeHtml(image)}" alt=""></span>
          <span class="cn-character-gradient"></span>
          <span class="cn-character-copy"><strong>${escapeHtml(name)}</strong><small>${escapeHtml(localize("CampaignNexus.Characters.TypeLabel", "CHARACTER"))}</small></span>
        </button>`;
    }).join("");

    return `
      <section class="cn-character-page is-detail">
        <div class="cn-character-detail">
          <button type="button" class="cn-character-feature" data-cn-action="deselect-character-user" data-user-id="${escapeHtml(selectedProfile.userId)}" aria-label="${escapeHtml(localize("CampaignNexus.Characters.Back", "Back to players"))}">
            <span class="cn-character-profile-art"><img src="${escapeHtml(selectedProfile.imageSrc)}" alt=""></span>
            <span class="cn-character-feature-shade"></span>
            <span class="cn-character-return-hint"><i class="fa-solid fa-arrow-left"></i>${escapeHtml(localize("CampaignNexus.Characters.Back", "Back to players"))}</span>
          </button>
          <div class="cn-character-linked-column">
            <div class="cn-character-gallery">${cards || emptyState("fa-solid fa-user-group", localize("CampaignNexus.Empty.LinkedCharacters", "No characters are linked to this player."))}</div>
          </div>
        </div>
      </section>`;
  }

  #journalsHtml() {
    const journals = (game.journal?.contents ?? []).filter((journal) => canObserve(journal));
    const cards = journals.map((journal, index) => `
      <button type="button" class="cn-journal-book-card" style="--cn-card-index:${index}" data-searchable="${escapeHtml(journal.name.toLowerCase())}" data-cn-action="open-document" data-uuid="${escapeHtml(journal.uuid)}">
        <span class="cn-journal-cover" aria-hidden="true"></span>
        <span class="cn-journal-pages" aria-hidden="true"><span class="cn-journal-spine"></span></span>
        <span class="cn-journal-title"><span>${escapeHtml(journal.name)}</span><i aria-hidden="true"></i></span>
      </button>`).join("");
    return `${this.#pageHeader("journals", journals.length)}${searchBar(localize("CampaignNexus.Search.Journals", "Search journals..."))}<div class="cn-journal-grid">${cards || emptyState("fa-solid fa-book-open", localize("CampaignNexus.Empty.Journals", "No accessible journals found."))}</div>`;
  }

  async #curatedJournalHtml(id, uuids) {
    const documents = (await resolveDocuments(uuids)).filter((document) => canObserve(document));
    return `${this.#pageHeader(id, documents.length)}${searchBar(localize("CampaignNexus.Search.Entries", "Search entries..."))}${this.#documentGrid(documents, sectionDefinition(id)?.icon, localize("CampaignNexus.Empty.Curated", "Nothing has been added here yet."))}`;
  }

  async #shopsHtml() {
    const active = STYLISH_SHOP_IDS.some((id) => game.modules?.get(id)?.active);
    if (!active) {
      return `${this.#pageHeader("shops", 0)}${emptyState("fa-solid fa-store-slash", localize("CampaignNexus.Shops.RequiredTitle", "Stylish Shop is required"), localize("CampaignNexus.Shops.RequiredDetail", "Install and activate Stylish Shop to use this section."))}`;
    }
    const shops = (await resolveDocuments(this.config.shopActorUuids)).filter((actor) => canObserve(actor));
    return `${this.#pageHeader("shops", shops.length)}${searchBar(localize("CampaignNexus.Search.Shops", "Search shops..."))}${this.#documentGrid(shops, "fa-solid fa-store", localize("CampaignNexus.Empty.Shops", "No shops are available."))}`;
  }

  #documentGrid(documents, icon, emptyText) {
    const cards = documents.map((document) => `
      <button type="button" class="cn-library-card cn-document-card" data-searchable="${escapeHtml(document.name.toLowerCase())}" data-cn-action="open-document" data-uuid="${escapeHtml(document.uuid)}">
        <span class="cn-card-art"><img src="${escapeHtml(documentImage(document, "icons/svg/book.svg"))}" alt=""></span>
        <span class="cn-card-body"><strong>${escapeHtml(document.name)}</strong><small>${escapeHtml(document.documentName ?? document.type ?? "")}</small></span>
        <span class="cn-open-indicator"><i class="fa-solid fa-arrow-up-right-from-square"></i></span>
      </button>`).join("");
    return `<div class="cn-library-grid">${cards || emptyState(icon || "fa-solid fa-diamond", emptyText)}</div>`;
  }

  #compendiumsHtml() {
    const packs = (game.packs?.contents ?? []).filter((pack) => pack.visible !== false);
    const cards = packs.map((pack) => `
      <button type="button" class="cn-pack-card" data-searchable="${escapeHtml(`${pack.metadata?.label ?? pack.title ?? pack.collection}`.toLowerCase())}" data-cn-action="open-pack" data-pack="${escapeHtml(pack.collection)}">
        <i class="fa-solid fa-box-archive"></i>
        <span><strong>${escapeHtml(pack.metadata?.label ?? pack.title ?? pack.collection)}</strong><small>${escapeHtml(pack.documentName ?? pack.metadata?.type ?? "")}</small></span>
        <i class="fa-solid fa-arrow-up-right-from-square"></i>
      </button>`).join("");
    return `${this.#pageHeader("compendiums", packs.length)}${searchBar(localize("CampaignNexus.Search.Compendiums", "Search compendiums..."))}<div class="cn-pack-grid">${cards || emptyState("fa-solid fa-box-open", localize("CampaignNexus.Empty.Compendiums", "No accessible compendiums found."))}</div>`;
  }

  #chatHtml() {
    const messages = (game.messages?.contents ?? []).filter(userCanSeeMessage).slice(-50);
    const rows = messages.map((message) => {
      const alias = message.speaker?.alias ?? message.author?.name ?? message.user?.name ?? localize("CampaignNexus.Chat.Unknown", "Unknown");
      const time = message.timestamp ? new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
      return `<article class="cn-chat-message"><header><strong>${escapeHtml(alias)}</strong><time>${escapeHtml(time)}</time></header><div>${message.content ?? ""}</div></article>`;
    }).join("");
    return `
      ${this.#pageHeader("chat", messages.length)}
      <section class="cn-chat-panel">
        <div class="cn-chat-log">${rows || emptyState("fa-solid fa-comments", localize("CampaignNexus.Empty.Chat", "No messages yet."))}</div>
        <form class="cn-chat-form" data-cn-chat-form>
          <input type="text" name="message" autocomplete="off" placeholder="${escapeHtml(localize("CampaignNexus.Chat.Placeholder", "Write a message..."))}">
          <button type="submit"><i class="fa-solid fa-paper-plane"></i><span>${escapeHtml(localize("CampaignNexus.Chat.Send", "Send"))}</span></button>
        </form>
      </section>`;
  }

  async #settingsHtml() {
    await Promise.resolve(ui.sidebar?.activateTab?.("settings"));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const settingsRoot = rootElement(ui.sidebar?.tabs?.settings?.element)
      ?? document.querySelector("#sidebar #settings")
      ?? document.querySelector('#sidebar [data-tab="settings"]');
    const actions = settingsRoot
      ? [...settingsRoot.querySelectorAll("button, a[href]")].filter((entry) => {
        const label = entry.textContent?.replace(/\s+/g, " ").trim();
        return label && !entry.disabled && !entry.closest(".window-header");
      })
      : [];
    this.foundrySettingsActions = actions;
    const cards = actions.map((entry, index) => {
      const label = entry.textContent.replace(/\s+/g, " ").trim();
      const icon = entry.querySelector("i")?.className || "fa-solid fa-gear";
      return `<button type="button" class="cn-foundry-setting-card" data-cn-action="foundry-setting" data-index="${index}"><i class="${escapeHtml(icon)}"></i><span>${escapeHtml(label)}</span><i class="fa-solid fa-chevron-right"></i></button>`;
    }).join("");
    const body = cards
      ? `<div class="cn-foundry-settings-grid">${cards}</div>`
      : `<button type="button" class="cn-button cn-button-primary cn-settings-fallback" data-cn-action="open-settings-sidebar"><i class="fa-solid fa-gear"></i>${escapeHtml(localize("CampaignNexus.Settings.OpenFoundry", "Open Foundry settings"))}</button>`;
    return `${this.#pageHeader("settings")}<section class="cn-settings-panel"><p class="cn-settings-intro">${escapeHtml(localize("CampaignNexus.Settings.FoundryHint", "These are the settings available in this Foundry world."))}</p>${body}</section>`;
  }

  #renderShell() {
    this.overlay.classList.toggle("is-gm", game.user.isGM);
    this.overlay.classList.toggle("is-preview", this.previewMode);
    this.overlay.classList.toggle("is-locked", this.locked);
    this.overlay.querySelector(".cn-brand-copy strong").textContent = this.config.title;
    this.overlay.querySelector(".cn-brand-copy small").textContent = this.config.subtitle;
    const logo = this.overlay.querySelector(".cn-logo-slot");
    logo.innerHTML = this.config.logoSrc
      ? `<img src="${escapeHtml(this.config.logoSrc)}" alt="">`
      : '<i class="fa-solid fa-compass"></i>';
    const status = this.overlay.querySelector(".cn-footer-status");
    status.textContent = this.previewMode
      ? localize("CampaignNexus.Status.Preview", "Preview mode")
      : (this.locked ? localize("CampaignNexus.Status.Waiting", "Waiting for the Game Master") : "");
    this.#renderNavigation();
  }

  #renderNavigation() {
    const navigation = this.overlay.querySelector(".cn-navigation");
    navigation.innerHTML = this.enabledSections.map((section) => {
      const definition = sectionDefinition(section.id);
      const active = this.currentSection === section.id;
      return `<button type="button" class="${active ? "is-active" : ""}" data-cn-action="navigate" data-section="${section.id}"><i class="${definition?.icon ?? "fa-solid fa-diamond"}"></i><span>${escapeHtml(sectionLabel(section))}</span></button>`;
    }).join("");
  }

  #applyTheme() {
    this.overlay.style.setProperty("--cn-accent", this.config.accentColor);
    this.overlay.style.setProperty("--cn-text", this.config.textColor);
    this.overlay.style.setProperty("--cn-bar-color", this.config.barColor);
    this.overlay.style.setProperty("--cn-darkness", String(this.config.backdropDarkness));
    this.overlay.style.setProperty("--cn-transition", `${this.config.transitionDuration}ms`);
    this.overlay.classList.toggle("bars-hidden", !this.config.showBars);
    this.overlay.classList.toggle("reduce-motion", game.settings.get(MODULE_ID, "reduceMotion"));
  }

  #updateBackground() {
    const section = this.config.sections.find((entry) => entry.id === this.currentSection);
    const src = section?.backgroundSrc || this.config.backgroundSrc;
    const target = this.overlay.querySelector(".cn-background");
    target.replaceChildren();
    if (!src) return;
    const element = document.createElement(mediaType(src) === "video" ? "video" : "img");
    element.className = "cn-background-media";
    element.src = src;
    if (element instanceof HTMLVideoElement) {
      element.autoplay = true;
      element.loop = true;
      element.muted = true;
      element.playsInline = true;
      element.play().catch(() => {});
    }
    target.append(element);
  }

  async #startAudio() {
    this.#stopAudio();
    if (!this.config.musicSrc) return;
    const audio = new Audio(this.config.musicSrc);
    audio.loop = true;
    audio.volume = this.config.musicVolume;
    this.audio = audio;
    try {
      await audio.play();
    } catch (_error) {
      // Browser autoplay rules can require a click before audio starts.
    }
  }

  #stopAudio() {
    if (!this.audio) return;
    this.audio.pause();
    this.audio.removeAttribute("src");
    this.audio.load();
    this.audio = null;
  }

  async #openDocument(uuid) {
    const document = await globalThis.fromUuid?.(uuid);
    if (!document || !canObserve(document)) return;
    await document.sheet?.render(true);
    setTimeout(() => rootElement(document.sheet?.element)?.classList.add("cn-over-menu"), 50);
  }

  async #openCharacter(uuid) {
    const actor = await globalThis.fromUuid?.(uuid);
    if (!actor) return;
    await actor.sheet?.render(true);
    setTimeout(() => rootElement(actor.sheet?.element)?.classList.add("cn-over-menu"), 50);
  }

  async #openPack(collection) {
    const pack = game.packs?.get(collection);
    if (!pack || pack.visible === false) return;
    const rendered = await pack.render(true);
    setTimeout(() => {
      const element = rootElement(rendered?.element)
        ?? rootElement(pack.element)
        ?? rootElement(pack.apps ? Object.values(pack.apps)[0]?.element : null);
      element?.classList.add("cn-over-menu");
    }, 50);
  }

  #showLightbox(src, name) {
    this.lightbox.hidden = false;
    const media = mediaType(src) === "video"
      ? `<video src="${escapeHtml(src)}" controls autoplay></video>`
      : `<img src="${escapeHtml(src)}" alt="${escapeHtml(name)}">`;
    this.lightbox.innerHTML = `<button type="button" class="cn-lightbox-close" data-cn-action="close-lightbox" aria-label="${escapeHtml(localize("CampaignNexus.Actions.Close", "Close"))}"><i class="fa-solid fa-xmark"></i></button><figure>${media}<figcaption>${escapeHtml(name)}</figcaption></figure>`;
  }

  #closeLightbox() {
    if (!this.lightbox) return;
    this.lightbox.querySelectorAll("video").forEach((video) => video.pause());
    this.lightbox.hidden = true;
    this.lightbox.replaceChildren();
  }

  async #onClick(event) {
    const target = event.target.closest("[data-cn-action]");
    if (!target || !this.overlay.contains(target)) return;
    const action = target.dataset.cnAction;
    if (action === "close") return this.close();
    if (action === "home") {
      this.currentSection = "home";
      return this.renderCurrentSection();
    }
    if (action === "navigate") {
      this.currentSection = target.dataset.section;
      if (this.currentSection === "characters") this.characterUserId = "";
      if (this.currentSection === "shops" && !STYLISH_SHOP_IDS.some((id) => game.modules?.get(id)?.active)) {
        ui.notifications?.warn(localize("CampaignNexus.Shops.RequiredDetail", "Install and activate Stylish Shop to use this section."));
      }
      return this.renderCurrentSection();
    }
    if (action === "configure") return globalThis.CampaignNexus?.openConfiguration?.();
    if (action === "select-character-user") {
      this.characterUserId = target.dataset.userId;
      return this.renderCurrentSection({
        characterTransition: {
          originRect: target.getBoundingClientRect(),
          targetSelector: ".cn-character-feature",
          userId: this.characterUserId
        }
      });
    }
    if (action === "deselect-character-user") {
      const userId = target.dataset.userId;
      this.characterUserId = "";
      return this.renderCurrentSection({
        characterTransition: {
          originRect: target.getBoundingClientRect(),
          targetSelector: ".cn-character-profile-card",
          userId
        }
      });
    }
    if (action === "foundry-setting") {
      const source = this.foundrySettingsActions[Number(target.dataset.index)];
      source?.click();
      setTimeout(() => this.#raiseFoundryWindows(), 50);
      setTimeout(() => this.#raiseFoundryWindows(), 250);
      return;
    }
    if (action === "open-settings-sidebar") {
      await this.close({ force: true });
      await Promise.resolve(ui.sidebar?.activateTab?.("settings"));
      return ui.sidebar?.expand?.();
    }
    if (action === "show-all") return this.showToAll();
    if (action === "start-game") return this.startGame();
    if (action === "view-scene") {
      const scene = game.scenes?.get(target.dataset.id);
      await scene?.view();
      return this.close({ force: true });
    }
    if (action === "activate-scene" && game.user.isGM) {
      const scene = game.scenes?.get(target.dataset.id);
      await scene?.activate();
      return;
    }
    if (action === "open-character") return this.#openCharacter(target.dataset.uuid);
    if (action === "open-document") return this.#openDocument(target.dataset.uuid);
    if (action === "open-pack") return this.#openPack(target.dataset.pack);
    if (action === "lightbox") return this.#showLightbox(target.dataset.src, target.dataset.name);
    if (action === "close-lightbox") return this.#closeLightbox();
  }

  #onInput(event) {
    const search = event.target.closest("[data-cn-search]");
    if (!search) return;
    const query = search.value.trim().toLocaleLowerCase();
    this.overlay.querySelectorAll("[data-searchable]").forEach((entry) => {
      entry.hidden = query && !entry.dataset.searchable.includes(query);
    });
  }

  async #onChange(event) {
    const setting = event.target.closest("[data-cn-setting]");
    if (!setting) return;
    await game.settings.set(MODULE_ID, setting.dataset.cnSetting, Boolean(setting.checked));
    this.#applyTheme();
  }

  async #onSubmit(event) {
    const form = event.target.closest("[data-cn-chat-form]");
    if (!form) return;
    event.preventDefault();
    const input = form.elements.message;
    const content = String(input.value ?? "").trim();
    if (!content) return;
    await ChatMessage.create({ content, speaker: ChatMessage.getSpeaker() });
    input.value = "";
    await this.renderCurrentSection();
    const log = this.overlay.querySelector(".cn-chat-log");
    if (log) log.scrollTop = log.scrollHeight;
  }

  #onKeydown(event) {
    if (!this.isOpen || event.key !== "Escape") return;
    if (!this.lightbox?.hidden) {
      event.preventDefault();
      this.#closeLightbox();
      return;
    }
    if (this.currentSection === "characters" && this.characterUserId) {
      event.preventDefault();
      this.characterUserId = "";
      this.renderCurrentSection();
      return;
    }
    if (!this.locked || game.user.isGM || this.previewMode) {
      event.preventDefault();
      this.close();
    }
  }

  #animateCharacterTransition(content, { originRect, targetSelector, userId }) {
    if (this.overlay.classList.contains("reduce-motion")) return;
    const destination = [...content.querySelectorAll(targetSelector)]
      .find((element) => element.dataset.userId === userId);
    if (!destination || !originRect || typeof destination.animate !== "function") return;
    const targetRect = destination.getBoundingClientRect();
    if (!targetRect.width || !targetRect.height) return;
    const deltaX = originRect.left - targetRect.left;
    const deltaY = originRect.top - targetRect.top;
    const scaleX = originRect.width / targetRect.width;
    const scaleY = originRect.height / targetRect.height;
    destination.animate([
      {
        transformOrigin: "top left",
        transform: `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY})`,
        opacity: 0.75
      },
      { transformOrigin: "top left", transform: "translate(0, 0) scale(1)", opacity: 1 }
    ], {
      duration: Math.max(260, this.config.transitionDuration),
      easing: "cubic-bezier(.2,.78,.22,1)"
    });
  }

  #raiseFoundryWindows() {
    document.querySelectorAll(".application, .app.window-app").forEach((element) => {
      if (!this.overlay.contains(element)) element.classList.add("cn-over-menu");
    });
  }
}
