import { Participant, Conversation, LoadConversationById } from "./convodata.mjs";
import { propagateConversation } from "./main.mjs";
import { openSheetForName } from "./sheetlookup.mjs";

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
    const speaker_panel = document.getElementById("convoui-panel-speaker")
    speaker_panel.innerHTML = ""

    if (conversation != null && conversation.getSpeaker() && !game.krisconvoui.convoIsCollapsed) {
        const speaker = conversation.getSpeaker()
    
        // Create card
        const speaker_card = document.createElement("div");
        speaker_card.className = "hud-card";
        //speaker_card.classList.add("hud-card-highlight");
        speaker_card.style.width = "350px"
        speaker_card.style.aspectRatio = "3 / 4"

        // Add image wrapper
        const image_card = document.createElement("div");
        image_card.className = "hud-card-main";

        if (game.user.isGM) {
            image_card.addEventListener('click', () => { 
                conversation.clearSpeaker()
                updateConvoUI()
            });
        }

        if (speaker != null) {
            // Add image
            const image_element = document.createElement("img");
            //image_element.classList.add("hud-card-banner") - No Class needed
            image_element.src = speaker.getImage();
            image_element.alt = speaker.getName();
            image_card.appendChild(image_element);
            speaker_card.appendChild(image_card);

            // Add banner
            const banner_element = document.createElement("div");
            banner_element.classList.add("hud-card-banner")
            banner_element.textContent = speaker.getName();
            speaker_card.appendChild(banner_element);

            banner_element.addEventListener('click', (event) => {
                const speaker = game.krisconvoui.conversation.getSpeaker();
                if (!speaker) return;

                const actor = fromUuidSync(speaker.actor);
                openSheetForName(event, actor, speaker.getName());
            });
        }
        else {
            const noSpeakerDiv = document.createElement("div");
            noSpeakerDiv.classList.add("hud-card-empty");
            noSpeakerDiv.textContent = "No Speaker";
            image_card.appendChild(noSpeakerDiv);
            speaker_card.appendChild(image_card);
        }

        // Add to wrapper
        speaker_panel.appendChild(speaker_card);
    }
    
    // DISPLAY PARTICIPANTS
    const participant_panel = document.getElementById("convoui-panel-participant")
    participant_panel.innerHTML = ""

    if (conversation != null) {
        conversation.participants.forEach(participant => {
            if (participant.isRevealed) {
                // Create card
                const character_card = document.createElement("div");
                character_card.className = "hud-card";
                character_card.style.width = "100px";
                character_card.style.height = "124px";
                character_card.dataset.actor = participant?.actor || "";
                character_card.dataset.name = participant.getName();

                // Allow button to hover next to the element
                character_card.style.position = "relative";
                character_card.style.overflow = "visible";

                // Dim if not speaker
                if (conversation.getSpeaker() && conversation.getSpeaker() != participant) {
                    character_card.classList.add("convoui-npc-dim")
                }
                else if (conversation.getSpeaker() == participant) {
                    character_card.classList.add("hud-card-highlight");
                }

                // Add image wrapper
                const image_card = document.createElement("div");
                image_card.className = "hud-card-main";

                // Add image
                const image_element = document.createElement("img");
                //image_element.classList.add("hud-card-banner") - No Class needed
                image_element.src = participant.getImage();
                image_element.alt = participant.getName();
                image_card.appendChild(image_element);
                character_card.appendChild(image_card);

                // Add banner
                const banner_element = document.createElement("div");
                banner_element.classList.add("hud-card-banner")
                banner_element.textContent = participant.getName();
                character_card.appendChild(banner_element);

                // Add Hide button
                if (game.user.isGM) {
                    // Create button
                    const topBtn = document.createElement("div");
                    topBtn.classList.add("hud-card-sidebtn");

                    // Add icon
                    const icon = document.createElement("i");
                    icon.classList.add("fas", "fa-eye-slash");
                    topBtn.appendChild(icon);

                    topBtn.addEventListener("click", (ev) => {
                        ev.stopPropagation();
                        conversation.hideParticipant(participant);
                        if (conversation.getSpeaker() === participant) {
                            conversation.clearSpeaker();
                        }
                        updateConvoUI();
                        propagateConversation();
                    });

                    // Append last so it sits over all children
                    character_card.appendChild(topBtn);
                }

                // Add to wrapper
                participant_panel.appendChild(character_card);

                if (game.user.isGM) {
                    image_card.addEventListener('click', () => { 
                        const index = conversation.participants.indexOf(participant);
                        if (index != null) {
                            if (index == conversation.speaker) {
                                conversation.clearSpeaker()
                            }
                            else {
                                conversation.setSpeaker(index)
                            }
                            
                            updateConvoUI()
                        }
                    });
                }

                const thisParticipant = participant;

                banner_element.addEventListener('click', (event) => {
                    const actor = fromUuidSync(thisParticipant.actor);
                    openSheetForName(event, actor, thisParticipant.getName());
                });
            }
        });

        // Hidden Participants for the GM
        if (game.user.isGM) {
            conversation.participants.forEach(participant => {
                if (!participant.isRevealed) {
                    // Create card
                    const character_card = document.createElement("div");
                    character_card.className = "hud-card";
                    character_card.style.width = "100px";
                    character_card.style.height = "24px";
                    character_card.style.position = "relative";
                    character_card.style.overflow = "visible";

                    // Add banner
                    const banner_element = document.createElement("div");
                    banner_element.classList.add("hud-card-banner")
                    banner_element.textContent = participant.getName();
                    character_card.appendChild(banner_element);

                    // Add Hide button
                    // Create button
                    const topBtn = document.createElement("div");
                    topBtn.classList.add("hud-card-sidebtn");

                    // Add icon
                    const icon = document.createElement("i");
                    icon.classList.add("fas", "fa-eye");
                    topBtn.appendChild(icon);

                    topBtn.addEventListener("click", (ev) => {
                        ev.stopPropagation();
                        conversation.revealParticipant(participant);
                        if (conversation.getSpeaker() === participant) {
                            conversation.clearSpeaker();
                        }
                        updateConvoUI();
                        propagateConversation();
                    });

                    // Append last so it sits over all children
                    character_card.appendChild(topBtn);

                    // Add to wrapper
                    participant_panel.appendChild(character_card);

                    const thisParticipant = participant;

                    // Add click listener to banner
                    banner_element.addEventListener('click', (event) => {
                        const actor = fromUuidSync(thisParticipant.actor);
                        openSheetForName(event, actor, thisParticipant.getName());
                    });
                }
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