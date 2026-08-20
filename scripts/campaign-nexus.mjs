import { createConfigApplicationClass } from "./config-app.mjs";
import { DEFAULT_CONFIG, DEFAULT_LOBBY_STATE, MODULE_ID, SOCKET_NAME } from "./constants.mjs";
import { CampaignNexusController } from "./nexus-controller.mjs";
import { clone, normalizeConfig, normalizeLobbyState, rootElement } from "./utils.mjs";

let controller;
let ConfigApplication;
let configurationApp;

async function openConfiguration() {
  if (!game.user.isGM || !ConfigApplication) return;
  configurationApp ??= new ConfigApplication();
  await configurationApp.render({ force: true });
  requestAnimationFrame(() => rootElement(configurationApp.element)?.classList.add("cn-over-menu"));
}

Hooks.once("init", () => {
  ConfigApplication = createConfigApplicationClass();

  game.settings.register(MODULE_ID, "configuration", {
    name: "CampaignNexus.Settings.Configuration.Name",
    scope: "world",
    config: false,
    type: Object,
    default: clone(DEFAULT_CONFIG),
    onChange: () => controller?.refresh()
  });

  game.settings.register(MODULE_ID, "lobbyState", {
    name: "CampaignNexus.Settings.LobbyState.Name",
    scope: "world",
    config: false,
    type: Object,
    default: clone(DEFAULT_LOBBY_STATE),
    onChange: (value) => controller?.handleLobbyState(value)
  });

  game.settings.register(MODULE_ID, "reduceMotion", {
    name: "CampaignNexus.Settings.ReduceMotion.Name",
    hint: "CampaignNexus.Settings.ReduceMotion.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: false,
    onChange: () => controller?.refresh()
  });

  game.settings.registerMenu(MODULE_ID, "campaignConfiguration", {
    name: "CampaignNexus.Settings.Menu.Name",
    label: "CampaignNexus.Settings.Menu.Label",
    hint: "CampaignNexus.Settings.Menu.Hint",
    icon: "fa-solid fa-compass",
    type: ConfigApplication,
    restricted: true
  });

  game.keybindings.register(MODULE_ID, "toggleMenu", {
    name: "CampaignNexus.Keybindings.Toggle.Name",
    hint: "CampaignNexus.Keybindings.Toggle.Hint",
    editable: [{ key: "KeyM", modifiers: ["SHIFT"] }],
    restricted: false,
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL,
    onDown: () => {
      controller?.toggle();
      return true;
    }
  });
});

Hooks.once("ready", async () => {
  controller = new CampaignNexusController();
  controller.initialize();
  game.socket.on(SOCKET_NAME, (payload) => controller.handleSocket(payload));

  globalThis.CampaignNexus = Object.freeze({
    open: (section = "home") => controller.open(section),
    close: () => controller.close(),
    toggle: () => controller.toggle(),
    preview: (config) => controller.preview(normalizeConfig(config)),
    refresh: () => controller.refresh(),
    showToAll: () => controller.showToAll(),
    startGame: () => controller.startGame(),
    openConfiguration
  });

  const lobbyState = normalizeLobbyState(game.settings.get(MODULE_ID, "lobbyState"));
  if (lobbyState.open) await controller.open("home", { locked: !game.user.isGM && lobbyState.locked });
});

Hooks.on("createChatMessage", () => {
  if (controller?.isOpen && controller.currentSection === "chat") controller.renderCurrentSection();
});
