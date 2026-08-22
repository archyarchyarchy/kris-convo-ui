import { Participant, Conversation, LoadConversationById } from "./convodata.mjs";
import { openSheetForName } from "./sheetlookup.mjs";
import { buildHudCard } from "./hudcard.mjs";

export async function initializeConvoUI() {
    const MOD = game.krisconvoui.MODULE

    // Create the journal entry to hold the data - Currently done in SaveConversation()
    /*
    if (!game.journal.getName("ConvoUI")) {
        await JournalEntry.create({ 
            name: "ConvoUI",
            flags: { MOD: { type: "convo-data" } },
            ownership: { [game.user.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER },
        });
    }
    */
    

    // Avoid double-injecting on hot reloads
    if (document.getElementById("convui-convo-wrapper")) {
        return;
    }

    console.log("[ConvoUI] INFO: Engaging in conversation...")

    // Prefer attaching under #interface; fallback to <body>
    const wrapper = document.createElement("div");
    wrapper.id = "convoui-convo-wrapper";
    wrapper.classList.add("convoui-convo-wrapper")
    
    const left_panel = document.createElement("div")
    left_panel.classList.add("convoui-left")
    left_panel.id = "convoui-panel-buttons"
    wrapper.appendChild(left_panel)

    const center_panel = document.createElement("div")
    center_panel.classList.add("convoui-center")
    center_panel.id = "convoui-panel-speaker"
    wrapper.appendChild(center_panel)

    const right_panel = document.createElement("div")
    right_panel.classList.add("convoui-right")
    right_panel.id = "convoui-panel-participant"
    wrapper.appendChild(right_panel)

    const root = document.getElementById("ui-middle") ?? document.body
    root.insertBefore(wrapper, document.getElementById("ui-bottom"));

    updateConvoUI()
}

/** Rebuilds just the speaker card. Shared by updateConvoUI() (full rebuild)
 *  and refreshSpeakerHighlight() (speaker-only updates). */
function renderSpeakerPanel(conversation) {
    const speaker_panel = document.getElementById("convoui-panel-speaker")
    speaker_panel.innerHTML = ""

    if (conversation != null && conversation.getSpeaker() && !game.krisconvoui.convoIsCollapsed) {
        const speaker = conversation.getSpeaker()

        const speaker_card = buildHudCard({
            width: "350px",
            aspectRatio: "3 / 4",
            image: speaker?.getImage(),
            placeholderText: "No Speaker",
            name: speaker?.getName(),
            showBanner: Boolean(speaker),
            onImageClick: game.user.isGM ? () => {
                conversation.clearSpeaker()
                refreshSpeakerHighlight()
            } : null,
            onBannerClick: (event) => {
                const currentSpeaker = game.krisconvoui.conversation.getSpeaker();
                if (!currentSpeaker) return;

                const actor = fromUuidSync(currentSpeaker.actor);
                openSheetForName(event, actor, currentSpeaker.getName());
            }
        });

        speaker_panel.appendChild(speaker_card);
    }
}

/**
 * Rebuilds the speaker card and toggles dim/highlight classes on the
 * existing participant cards, without rebuilding the participant panel.
 * Safe to use in place of updateConvoUI() specifically for setSpeaker()/
 * clearSpeaker() -- it does NOT handle participants being added, removed,
 * revealed, or hidden, since those change which cards need to exist at all.
 */
export function refreshSpeakerHighlight() {
    if (!game.krisconvoui.FLAG_USE_CONVOUI) return;

    const conversation = game.krisconvoui.conversation;
    renderSpeakerPanel(conversation);

    const participant_panel = document.getElementById("convoui-panel-participant");
    if (!participant_panel) return;

    const speaker = conversation?.getSpeaker();
    participant_panel.querySelectorAll("[data-index]").forEach(card => {
        const participant = conversation?.participants[Number(card.dataset.index)];
        card.classList.toggle("convoui-npc-dim", !!speaker && speaker !== participant);
        card.classList.toggle("hud-card-highlight", !!speaker && speaker === participant);
    });
}

export function updateConvoUI() {
    //game.krisconvoui.conversation = LoadConversationById(game.krisconvoui.conversation.id)
    console.log("[ConvoUI] UpdateConvoUI()")
    const conversation = game.krisconvoui.conversation
    const isCollapsed = game.krisconvoui.convoIsCollapsed || conversation == null || !conversation.getSpeaker()
    //console.log(conversation)

    if (!game.krisconvoui.FLAG_USE_CONVOUI) {
        return; 
    }

    // DISPLAY BACKGROUND
    if (conversation) {
        var background_element = document.getElementById("convoui-background");

        if (background_element === null) {
            background_element = document.createElement("img");
            background_element.id = "convoui-background";
            background_element.classList.add("convoui-background");
            document.body.appendChild(background_element);
        }
        else {
            background_element.innerHTML = ""
        }

        background_element.src = conversation.background;
        background_element.toggleAttribute("hidden", conversation.background == "");

        if (!isCollapsed) {
            background_element.style.filter = "brightness(0.6)";
        }
        else {
            background_element.style.filter = "brightness(1.0)";
        }
    }


    if (!conversation || conversation.background === "" || game.krisconvoui.hideConversation) {
        // Hide Background
        var background_element = document.getElementById("convoui-background");
        if (background_element !== null) {
            background_element.toggleAttribute("hidden", true);
        }
    }

    // DISPLAY SPEAKER
    renderSpeakerPanel(conversation);

    // DISPLAY PARTICIPANTS
    const participant_panel = document.getElementById("convoui-panel-participant")
    participant_panel.innerHTML = ""

    if (conversation != null) {
        conversation.participants.forEach((participant, index) => {
            if (!participant.isRevealed) return;

            const speaker = conversation.getSpeaker();

            const character_card = buildHudCard({
                width: 100,
                height: 124,
                image: participant.getImage(),
                name: participant.getName(),
                dimmed: !!speaker && speaker !== participant,
                highlighted: speaker === participant,
                dataset: { actor: participant?.actor || "", name: participant.getName(), index },
                onImageClick: game.user.isGM ? () => {
                    const idx = conversation.participants.indexOf(participant);
                    if (idx != null) {
                        if (idx == conversation.speaker) {
                            conversation.clearSpeaker()
                        }
                        else {
                            conversation.setSpeaker(idx)
                        }

                        refreshSpeakerHighlight()
                    }
                } : null,
                onBannerClick: (event) => {
                    const actor = fromUuidSync(participant.actor);
                    openSheetForName(event, actor, participant.getName());
                },
                sideButton: game.user.isGM ? {
                    iconClass: "fa-eye-slash",
                    onClick: (ev) => {
                        ev.stopPropagation();
                        // hideParticipant()/clearSpeaker() already broadcast via save()
                        conversation.hideParticipant(participant);
                        if (conversation.getSpeaker() === participant) {
                            conversation.clearSpeaker();
                        }
                        updateConvoUI();
                    }
                } : null
            });

            participant_panel.appendChild(character_card);
        });

        // Hidden Participants for the GM
        if (game.user.isGM) {
            conversation.participants.forEach(participant => {
                if (participant.isRevealed) return;

                const character_card = buildHudCard({
                    width: 100,
                    height: 24,
                    showImage: false,
                    name: participant.getName(),
                    onBannerClick: (event) => {
                        const actor = fromUuidSync(participant.actor);
                        openSheetForName(event, actor, participant.getName());
                    },
                    sideButton: {
                        iconClass: "fa-eye",
                        onClick: (ev) => {
                            ev.stopPropagation();
                            // revealParticipant()/clearSpeaker() already broadcast via save()
                            conversation.revealParticipant(participant);
                            if (conversation.getSpeaker() === participant) {
                                conversation.clearSpeaker();
                            }
                            updateConvoUI();
                        }
                    }
                });

                participant_panel.appendChild(character_card);
            });
        }
    }

    // Handle Collapsed Status
    //const convo_wrapper = document.getElementById("convoui-convo-wrapper");
    const participant_panels = document.querySelectorAll(".convoui-speakernpc");
    participant_panels.forEach(panel => {
        panel.toggleAttribute("hidden", (isCollapsed || !game.krisconvoui.FLAG_USE_CONVOUI))
    });

    const buttons_panel = document.getElementById("convoui-panel-buttons")
    buttons_panel.style.width = isCollapsed || game.krisconvoui.conversation === null || !game.krisconvoui.FLAG_USE_CONVOUI ? "auto" : "100%"
}