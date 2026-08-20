export const MODULE_ID = "campaign-nexus";
export const MODULE_PATH = `modules/${MODULE_ID}`;
export const SOCKET_NAME = `module.${MODULE_ID}`;

export const SECTION_DEFINITIONS = Object.freeze([
  { id: "maps", icon: "fa-solid fa-map", label: "CampaignNexus.Sections.Maps" },
  { id: "characters", icon: "fa-solid fa-users", label: "CampaignNexus.Sections.Characters" },
  { id: "journals", icon: "fa-solid fa-book-open", label: "CampaignNexus.Sections.Journals" },
  { id: "shops", icon: "fa-solid fa-store", label: "CampaignNexus.Sections.Shops" },
  { id: "quests", icon: "fa-solid fa-list-check", label: "CampaignNexus.Sections.Quests" },
  { id: "systems", icon: "fa-solid fa-diagram-project", label: "CampaignNexus.Sections.Systems" },
  { id: "compendiums", icon: "fa-solid fa-box-archive", label: "CampaignNexus.Sections.Compendiums" },
  { id: "chat", icon: "fa-solid fa-comments", label: "CampaignNexus.Sections.Chat" },
  { id: "settings", icon: "fa-solid fa-sliders", label: "CampaignNexus.Sections.Settings" }
]);

export const DEFAULT_CONFIG = Object.freeze({
  title: "Campaign Nexus",
  subtitle: "",
  logoSrc: "",
  backgroundSrc: "",
  musicSrc: "",
  musicVolume: 0.2,
  accentColor: "#d7a642",
  textColor: "#ffffff",
  backdropDarkness: 0.46,
  transitionDuration: 500,
  lockPlayers: true,
  startSceneId: "",
  sections: SECTION_DEFINITIONS.map(({ id }) => ({
    id,
    enabled: true,
    label: "",
    backgroundSrc: ""
  })),
  playerMaps: [],
  shopActorUuids: [],
  questJournalUuids: [],
  systemJournalUuids: []
});

export const DEFAULT_LOBBY_STATE = Object.freeze({
  open: false,
  locked: true,
  openedAt: 0
});

export const VIDEO_EXTENSIONS = new Set(["m4v", "mov", "mp4", "ogv", "webm"]);

export const STYLISH_SHOP_IDS = Object.freeze(["stylish-shop", "stylish-shop-premium"]);
