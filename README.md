# Campaign Nexus

Campaign Nexus is a cinematic, system-independent campaign menu for Foundry Virtual Tabletop. It appears as a full-screen interface inside the world and gives players one polished place to access campaign content.

## Install

Paste this URL into Foundry VTT's **Install Module → Manifest URL** field:

```text
https://raw.githubusercontent.com/CalisteniaStudios/campaign-nexus/main/module.json
```

## Features

- Full-screen campaign menu with configurable branding, colors, optional colored/transparent interface bars, image/video backgrounds, music, section order, and section visibility.
- GM map library using all Foundry scenes, with search, preview, and activation controls.
- Curated player map gallery that never exposes the GM's scene list.
- Cinematic player-profile galleries curated by the GM. Selecting a portrait expands it beside the linked character cards; Foundry remains responsible for allowing or denying Actor-sheet access.
- Large open journal books drawn entirely by the interface, with readable titles inside the pages, plus permission-aware Journals and Compendiums.
- Curated Quests and Systems/Reference sections using Journal entries selected by the GM.
- Styled in-menu chat with recent visible messages.
- Optional Stylish Shop integration through selected shop Actors. Stylish Shop remains a separate paid module and is not included.
- Synchronized lobby: the GM can open the menu for everyone, optionally lock players inside it, activate a configured starting Scene, and return everyone to the normal Foundry interface with **Start Game**.
- Local **Reduce motion** preference.
- The Campaign Nexus Settings section mirrors the actions available in Foundry's own Game Settings tab; the Nexus configuration remains on the header gear.
- Default shortcut: **Shift+M**.
- English, Brazilian Portuguese, and Portuguese interface.
- Foundry VTT v13 and v14 compatibility.

## Setup

After enabling the module, open **Game Settings → Configure Settings → Module Settings → Campaign Nexus** or use the gear in the Campaign Nexus header. Configure the campaign appearance, select each player portrait, link characters to player profiles, and choose the sections and documents that should appear.

The GM can open the menu locally with **Shift+M**. Use **Open for Everyone** to display it to all connected players and **Start Game** to close it for everyone. If a starting Scene is configured, Start Game activates that Scene first.

## Stylish Shop

The Shops page is optional. If Stylish Shop is active, Campaign Nexus opens the selected shop Actor sheets and allows Stylish Shop to provide its own store interface. If Stylish Shop is not active, the page displays a clear requirement notice. The page can be disabled entirely in Campaign Nexus configuration.

Campaign Nexus does not include, copy, or redistribute Stylish Shop.

## License

Campaign Nexus is released under the MIT License.
