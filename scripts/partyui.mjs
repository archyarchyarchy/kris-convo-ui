import { openSheetForName } from "./sheetlookup.mjs";
import { buildHudCard } from "./hudcard.mjs";

export function initializePartyUI() {
    if (!game.krisconvoui.FLAG_USE_PARTYUI) return;

    console.log("[ConvoUI] INFO: Setting up a party...")

    // CREATE WRAPPER DIV
    const wrapper = document.createElement("div");
    wrapper.classList.add("convoui-party-wrapper");
    wrapper.id = "convoui-party-wrapper"
  
    // APPEND WRAPPER
    const target = document.getElementById("ui-bottom") ?? document.body
    target.insertBefore(wrapper, target.children[0])

    // FILL IN PARTY
    updatePartyUI();
}

export function updatePartyUI() {
    const MOD = game.krisconvoui.MODULE;
    const isCollapsed = game.krisconvoui.partyIsCollapsed;

    console.log("[ConvoUI] INFO: Gathering party...")
    const party_wrapper = document.getElementById('convoui-party-wrapper');
    party_wrapper.innerHTML = '';

    // LOOP THROUGH ACTORS OWNED BY PLAYERS
    const pcs = game.actors.filter(actor => actor.hasPlayerOwner);
    console.log("[ConvoUI] INFO: Found " + String(pcs.length) + " party members.")

    // Sort actors by their owning player's name (non-GMs only)
    const sortedActors = pcs.sort((a, b) => {
        const ownerA = getOwningPlayer(a);
        const ownerB = getOwningPlayer(b);

        // If one has an owner and the other doesn't, unowned go last
        if (!ownerA && ownerB) return 1;
        if (ownerA && !ownerB) return -1;

        // If both have owners, compare by user name
        if (ownerA && ownerB) {
            return ownerA.name.localeCompare(ownerB.name, undefined, { sensitivity: 'base' });
        }

        // If neither have owners, sort alphabetically by actor name
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });

    sortedActors.forEach(actor => {
        const portraitWidth = game.settings.get(MOD, "portraitWidth");
        const portraitHeight = isCollapsed ? 24 : game.settings.get(MOD, "portraitHeight");
        const isCharacter = actor.type.toUpperCase() === "CHARACTER";

        // Non-character actors (vehicles, etc.) get rendered at half size;
        // when collapsed everyone uses the same small fixed height.
        const width = isCharacter ? portraitWidth : portraitWidth / 2;
        const height = isCharacter || isCollapsed ? portraitHeight : portraitHeight / 2;

        const character_card = buildHudCard({
            width,
            height,
            showImage: !isCollapsed,
            image: actor.img,
            name: actor.name,
            showBanner: game.settings.get(MOD, "enableNameBar"),
            highlighted: actor.testUserPermission(game.user, "OWNER") && !game.user.isGM
        });

        character_card.id = "convoui-" + actor.id;
        if (!game.krisconvoui.partySpeakers.includes(actor.id)) {
            character_card.classList.add("convoui-silent");
        }

        // Add to wrapper
        party_wrapper.appendChild(character_card);

        // Unlike the conversation panels, the whole party card (not just
        // the image or banner) opens the sheet when clicked.
        if (game.settings.get(MOD, "enableSheetClick")) {
            character_card.addEventListener('click', (event) => {
                openSheetForName(event, actor, actor.name);
            });
        }
    });

    // Add a toggle button for PartyUI
    const party_toggle = document.createElement("button");
    party_toggle.id = "partyui-toggle-button";
    party_toggle.classList.add("ui-control");
    party_toggle.classList.add("plain");
    party_toggle.classList.add("icon");
    party_toggle.classList.add("fa-solid");
    party_toggle.classList.add(isCollapsed ? "fa-up-right-and-down-left-from-center" : "fa-down-left-and-up-right-to-center")
    party_toggle.style.pointerEvents = "all";
    party_wrapper.appendChild(party_toggle);

    party_toggle.addEventListener('click', () => {
        game.krisconvoui.partyIsCollapsed = !game.krisconvoui.partyIsCollapsed;
        updatePartyUI();
    });
};

/**
 * Toggles the "currently speaking" indicator on existing party cards
 * without rebuilding the party HUD. Cheaper than updatePartyUI() for
 * the high-frequency start/stop events relayed from the Discord bot,
 * which don't change who's in the party, only who's speaking.
 */
export function refreshSpeakingIndicators() {
    const party_wrapper = document.getElementById('convoui-party-wrapper');
    if (!party_wrapper) return;

    party_wrapper.querySelectorAll('[id^="convoui-"]').forEach(card => {
        const actorId = card.id.slice("convoui-".length);
        card.classList.toggle("convoui-silent", !game.krisconvoui.partySpeakers.includes(actorId));
    });
}

export function showDiceRoll(message) {
    // Only handle rolls
    if (!message.isRoll) return;

    const speaker = message.speaker;
    if (!speaker?.actor) return;

    const actor = game.actors.get(speaker.actor);
    if (!actor) return;

    // Find the portrait in the HUD
    const portrait = document.getElementById("convoui-" + actor.id);
    //const portrait = document.querySelector(
    //  `.convoui-rectangle .character-panel[data-actor-id="${actor.id}"]`
    //);
    if (!portrait) return;

    // Extract roll result
    const rollTotal = message.rolls?.[0]?.total ?? null;
    if (rollTotal === null) return;

    // Create overlay
    const overlay = document.createElement("div");
    overlay.classList.add("convoui-roll-overlay");
    overlay.innerText = rollTotal;
    portrait.appendChild(overlay);

    // Animate + remove after 2 seconds
    setTimeout(() => {
    overlay.classList.add("fade-out");
    setTimeout(() => overlay.remove(), 500);
    }, 1500);
}

function getOwningPlayer(actor) {
  for (const [userId, level] of Object.entries(actor.ownership)) {
    const user = game.users.get(userId);
    if (!user || user.isGM) continue; // skip GMs
    if (level >= 3) return user;
  }
  return null;
}