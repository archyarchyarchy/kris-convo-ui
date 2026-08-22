import { openSheetForName } from "./sheetlookup.mjs";

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
        // Create card
        const character_card = document.createElement("div");
        character_card.className = "hud-card";

        const portraitWidth = game.settings.get(MOD, "portraitWidth");
        const portraitHeight = isCollapsed ? 24 : game.settings.get(MOD, "portraitHeight");

        // APPLY SIZE FROM SETTINGS
        if (actor.type.toUpperCase() != "CHARACTER") {
            character_card.style.width = `${portraitWidth/2}px`;
            if (!isCollapsed) {
                character_card.style.height = `${portraitHeight/2}px`;
            }
            else {
                character_card.style.height = `${portraitHeight}px`;
            }
        }
        else {
            character_card.style.width = `${portraitWidth}px`;
            character_card.style.height = `${portraitHeight}px`;
        }
        
        character_card.id = "convoui-" + actor.id;

        // Highlight owned characters
        if (actor.testUserPermission(game.user, "OWNER") && !game.user.isGM) {
            character_card.classList.add("hud-card-highlight");
        }

        if (!game.krisconvoui.partySpeakers.includes(actor.id)) {
            character_card.classList.add("convoui-silent");
        }

        if (!isCollapsed) {
            // Add image wrapper
            const image_card = document.createElement("div");
            image_card.className = "hud-card-main";

            // Add image
            const image_element = document.createElement("img");
            //image_element.classList.add("hud-card-banner") - No Class needed
            image_element.src = actor.img;
            image_element.alt = actor.name;
            image_card.appendChild(image_element);
            character_card.appendChild(image_card);
        }

        // Add banner
        const displayNameBar = game.settings.get(MOD, "enableNameBar");
        if (displayNameBar) {
            const banner_element = document.createElement("div");
            banner_element.classList.add("hud-card-banner")
            banner_element.textContent = actor.name;
            character_card.appendChild(banner_element);
        }

        // Add to wrapper
        party_wrapper.appendChild(character_card);

        const enableSheetClick = game.settings.get(MOD, "enableSheetClick");
        if (enableSheetClick) {
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