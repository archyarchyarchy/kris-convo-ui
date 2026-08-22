import * as partyUI from "./partyui.mjs";
import * as convoUI from "./convoui.mjs";
import * as convoData from "./convodata.mjs";
import * as settings from "./settings.mjs";
import { CreateConversationForm, LoadConversationForm } from "./convoform.mjs";

Hooks.on('createActor', partyUI.updatePartyUI);
Hooks.on('updateActor', partyUI.updatePartyUI);
Hooks.on('deleteActor', partyUI.updatePartyUI);
//Hooks.on('createJournalEntry', (journal) => onJournalChange(journal));
//Hooks.on('deleteJournalEntry', (journal) => onJournalChange(journal));
//Hooks.on('updateJournalEntry', (journal) => onJournalChange(journal));
//Hooks.on('createJournalEntryPage', (page) => onJournalPageChange(page));
//Hooks.on('updateJournalEntryPage', (page) => onJournalPageChange(page));
//Hooks.on('deleteJournalEntryPage', (page) => onJournalPageChange(page));
Hooks.on("createChatMessage", (message) => { partyUI.showDiceRoll(message) });

Hooks.once("ready", () => {
    const MOD = "kris-convo-ui"
    console.log("[ConvoUI] INFO: Initializing module...");

    game.krisconvoui = {
        FLAG_USE_CONVOUI: true,
        FLAG_USE_PARTYUI: true,
        MODULE: MOD,
        SOCKCHANNEL: `module.${MOD}`,
        conversation: null,
        convoIsCollapsed: false,
        partyIsCollapsed: false,
        partySpeakers: []
    };

    settings.initializeSettings();
    game.krisconvoui.isCollapsed = game.settings.get(MOD, "defaultCollapsed")

    convoUI.initializeConvoUI();

    partyUI.initializePartyUI();

    updateButtonUI();

    initializeSockets();

    if (game.user.isGM) convoData.broadcastConversation();

    if (game.user.isGM) {
        const ws = new WebSocket("ws://127.0.0.1:21999");
        ws.addEventListener("open", () => console.log("Connected to local Discord bot"));
        ws.addEventListener("message", (ev) => {
            const SOCKCHANNEL = game.krisconvoui.SOCKCHANNEL
            const data = JSON.parse(ev.data);
            console.log("Received:", data);

            var selectedActor = null
            //const ownedActorUserPairs = [];
            for (const user of game.users.contents.filter((user) => !user.isGM)) {
                for (const actor of game.actors.contents) {
                    const userOwnsActor = actor.testUserPermission(user, foundry.CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER, { exact: true });
                    if (userOwnsActor) {
                        if (data.name == user.name) {
                            selectedActor = actor;
                            break;
                        }

                        // TODO: Map to an internal list keeping track of discord usernames + Foundry usernames
                        //ownedActorUserPairs.push({ userName: user.name, actorName: actor.name });
                    }
                }
            }

            if (data.t === "start") {
                if (selectedActor) {
                    if (!game.krisconvoui.partySpeakers.includes(selectedActor.id))
                    game.krisconvoui.partySpeakers.push(selectedActor.id);
                }
            } 
            else if (data.t === "stop") {
                if (selectedActor) {
                    const index = game.krisconvoui.partySpeakers.indexOf(selectedActor.id);
                    if (index !== -1) game.krisconvoui.partySpeakers.splice(index, 1);
                }
            }

            partyUI.updatePartyUI()
            game.socket.emit(SOCKCHANNEL, { t: "discord-speakers", data: JSON.stringify(game.krisconvoui.partySpeakers) });
        });

        ws.addEventListener("close", () => console.warn("Lost WS connection to bot"));
    }
});

export function updateButtonUI() {
    const convoIsCollapsed = game.krisconvoui.convoIsCollapsed
    const partyIsCollapsed = game.krisconvoui.partyIsCollapsed

    if (!game.krisconvoui.FLAG_USE_CONVOUI && !game.krisconvoui.FLAG_USE_PARTYUI) return;

    const button_panel = document.getElementById("convoui-panel-buttons")
    button_panel.innerHTML = ""
    button_panel.innerHTML += `<button type="button" id="convoui-toggle-button" class="ui-control plain icon fa-solid ${convoIsCollapsed ? "fa-up-right-and-down-left-from-center" : "fa-down-left-and-up-right-to-center"}"></button>`
    if (game.user.isGM) {
        button_panel.innerHTML += '<button type="button" id="convoui-load-button" class="ui-control plain icon fa-solid fa-down-to-line"></button>'
        button_panel.innerHTML += '<button type="button" id="convoui-new-button" class="ui-control plain icon fa-solid fa-plus"></button>'
        if (game.krisconvoui.conversation !== null) {
            button_panel.innerHTML += '<button type="button" id="convoui-edit-button" class="ui-control plain icon fa-solid fa-pen-to-square"></button>'
            button_panel.innerHTML += '<button type="button" id="convoui-clear-button" class="ui-control plain icon fa-solid fa-times"></button>'
            button_panel.innerHTML += '<button type="button" id="convoui-delete-button" class="ui-control plain icon fa-solid fa-trash danger"></button>'
        }
    
        const load_button = document.getElementById("convoui-load-button")
        load_button.addEventListener('click', () => {
            new LoadConversationForm().render(true);
        });

        const new_button = document.getElementById("convoui-new-button")
        new_button.addEventListener('click', () => {
            new CreateConversationForm(null).render(true);
        });

        if (game.krisconvoui.conversation !== null) {
            const edit_button = document.getElementById("convoui-edit-button")
            edit_button.addEventListener('click', () => { 
                if (game.krisconvoui.conversation === null) return;
                new CreateConversationForm(game.krisconvoui.conversation).render(true);
            });

            const clear_button = document.getElementById("convoui-clear-button")
            clear_button.addEventListener('click', () => { 
                game.krisconvoui.conversation = null;
                convoUI.updateConvoUI();
                updateButtonUI();
                propagateConversation();
            });

            const delete_button = document.getElementById("convoui-delete-button")
            delete_button.style.color = "#ff0000";
            delete_button.addEventListener('click', () => {
                if (game.krisconvoui.conversation === null) return;

                const confirmed = confirm(`Delete conversation?`);
                if (!confirmed) return;

                convoData.DeleteConversationById(game.krisconvoui.conversation.id)
                game.krisconvoui.conversation = null;
                convoUI.updateConvoUI();
                updateButtonUI();
                propagateConversation();
            });
        }
    }    

    const convo_toggle = document.getElementById("convoui-toggle-button")
    convo_toggle.addEventListener('click', () => { 
        game.krisconvoui.convoIsCollapsed = !game.krisconvoui.convoIsCollapsed; 
        convoUI.updateConvoUI()
        updateButtonUI()
    });
}

function initializeSockets() {
    console.log("[ConvoUI] INFO: Initializing sockets");
    const SOCKCHANNEL = game.krisconvoui.SOCKCHANNEL

    game.socket.on(SOCKCHANNEL, (msg) => {
        console.log("[ConvoUI] Received socket message", msg);

        switch (msg.t) {
            case "convo-sync": {
                if (game.user.isGM) break;
                console.log("[ConvoUI] Received convo-sync")
                console.debug(msg.convo)

                const parsed = JSON.parse(msg.convo)

                if (parsed == null) {
                    console.log("[ConvoUI] Socket: Cleared conversation")
                    game.krisconvoui.conversation = null
                }
                else {
                    game.krisconvoui.conversation = convoData.Conversation.fromJSON(parsed);
                }
                convoUI.updateConvoUI();
                break;
            }
            case "request-snapshot": {
                if (!game.user.isGM) break;
                console.log("[ConvoUI] Received request-snapshot")
                game.socket.emit(SOCKCHANNEL, { 
                    t: "convo-sync", 
                    convo: JSON.stringify(game.krisconvoui.conversation) 
                });
                break;
            }
            case "discord-speakers": {
                if (game.user.isGM) break;
                const parsed = JSON.parse(msg.data);

                if (parsed != null && game.krisconvoui.partySpeakers != parsed) {
                    game.krisconvoui.partySpeakers = parsed
                    partyUI.updatePartyUI()
                }
                
                break;
            }
        }
    });

    if (!game.user.isGM) {
        console.log("[ConvoUI] Emitted request-snapshot")
        game.socket.emit(SOCKCHANNEL,
            { t: "request-snapshot" }
        );
    }
}

export function propagateConversation() {
    const gm_convo = game.krisconvoui.conversation;

    if (gm_convo !== null) {
        const flattened_convo = {
            speaker: gm_convo.speaker,
            background: gm_convo.background,
            participants: []
        }

        gm_convo.participants.forEach(p => {
            if (p.isRevealed) {
                flattened_convo.participants.push({
                    name: p.getName(),
                    image: p.getImage(),
                    actor: ""
                });
            }
        });

        const SOCKCHANNEL = game.krisconvoui.SOCKCHANNEL
        console.log("[ConvoUI] Emitted convo-sync")
        console.log(flattened_convo)
        game.socket.emit(SOCKCHANNEL, {
            t: "convo-sync", 
            convo: JSON.stringify(flattened_convo)
        });
    }
    else {
        const SOCKCHANNEL = game.krisconvoui.SOCKCHANNEL
        console.log("[ConvoUI] Emitted convo-sync: Null")
        game.socket.emit(SOCKCHANNEL, {
            t: "convo-sync", 
            convo: JSON.stringify(null)
        });
    }
}