function requireGM(fnName) {
    if (game.user.isGM) return true;
    console.error(`${fnName}() was accessed by a player!`);
    return false;
}

function getConvoJournals() {
    const MOD = game.krisconvoui.MODULE;
    return game.journal.contents.filter(j => j.flags?.[MOD]?.type === "convo-data");
}

export class Participant {
  constructor(name, image, actor = "", conversation) {
    this.name = name;
    this.image = image;
    this.actor = actor;
    this.isRevealed = true;
    this.conversation = conversation;
  }

  getName() {
    if (this.name == "") {
        if (this.actor == "") {
            return "Unknown"
        }
        else {
            const actor = fromUuidSync(this.actor);
            return actor.name
        }
    }
    
    return this.name
  }

  getImage() {
    if (this.image == "") {
        if (this.actor == "") {
            return "icons/svg/mystery-man.svg"
        }
        else {
            const actor = fromUuidSync(this.actor);
            return actor.img
        }
    }
    
    return this.image
  }

  static fromJSON(data) {
        const participant = Object.assign(new Participant(), data);
        return participant;
    }
}

export class Conversation {
    constructor(participants = [], speaker = -1, background = "") {
        this.id = -1
        this.name = ""
        this.participants = participants // List of ConvoUI_Participant
        this.speaker = speaker // -1 = None, otherwise points to participants index
        this.background = background
    }

    revealParticipant(participant) {
        participant.isRevealed = true;
        this.save();
    }

    hideParticipant(participant) {
        participant.isRevealed = false;
        this.save();
    }

    getSpeaker() {
        if (this.speaker >= 0 && this.speaker < this.participants.length) {
            return this.participants[this.speaker]
        }

        return null
    }

    setSpeaker(index) {
        if (this.speaker == index) return;

        console.log("[ConvoUI] Setting Speaker to " + String(index))
        if (index >= this.participants.length || index < 0) { 
            this.speaker = -1 
        }
        else {
            this.speaker = index
        }

        this.save()
    }

    clearSpeaker() {
        this.speaker = -1;
        this.save()
    }

    addParticipant(participant) {
        participant.conversation = this;
        this.participants.push(participant)

        this.save()
    }

    removeParticipant(participant) {
        const index = this.participants.indexOf(participant)
        if (index != null) {
            this.participants.splice(index, 1)
            if (index <= this.speaker) {
                this.speaker -= 1;
            }
        }

        this.save()
    }

    async save() {
        this.id = await SaveConversation(this)
    }

    static fromJSON(data) {
        const convo = Object.assign(new Conversation(), data);
        convo.participants = data.participants.map(Participant.fromJSON);
        return convo;
    }
}

export async function SaveConversation(conversation) {
    if (!requireGM("SaveConversation")) return null;
    if (conversation == null) {
        console.error("[ConvoUI] SaveConversation(): Attempted to save an Undefined conversation");
        return null
    }

    const MOD = game.krisconvoui.MODULE

    console.log("[ConvoUI] SaveConversation(): Saving convo with ID: " + conversation.id)
    var entry = game.journal.getName("ConvoUI")

    if (!entry) {
        console.log("[ConvoUI] SaveConversation(): No ConvoUI Journal found, creating it.")
        entry = await JournalEntry.create({
            name: "ConvoUI",
            flags: { [MOD]: { type: "convo-data" } },
            ownership: { [game.user.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER },
        });
    }

    var page = null
    if (conversation.id != -1) {
        console.log("[ConvoUI] SaveConversation(): Conversation has ID " + conversation.id + ", looking for matching page...")

        for (const j of getConvoJournals()) {
            for (const p of j.pages) {
                if (p.id === conversation.id) {
                    page = p;
                    console.log("[ConvoUI] SaveConversation(): Found the page with ID: " + p.id)
                    break;
                }
            }
            if (page) break;
        }
    }

    if (page == null) {
        page = await JournalEntryPage.create({
            name: "Saving...",
            text: { content: "" },
            flags: { [MOD]: { type: "convo-data" } }
        }, { parent: entry });

        conversation.id = page.id
        console.log("[ConvoUI] SaveConversation(): No Page found, created a new one: " + page.id)
    }

    await page.update({
        name: conversation.name == "" ? "Unnamed": conversation.name,
        text: { content: JSON.stringify(conversation) },
    });

    console.log("[ConvoUI] Conversation saved to ID: " + page.id);

    broadcastConversation(conversation);

    return page.id;
}

export function LoadConversation(page) {
    if (!requireGM("LoadConversation")) return null;

    if (!page) {
        console.error("[ConvoUI] LoadConversation(): Conversation data not found.");
        return null;
    }

    try {
        console.log("[ConvoUI] LoadConversation(): Loaded Conversation: " + page.name)
        return Conversation.fromJSON(JSON.parse(page.text.content));
    } catch (err) {
        console.error("[ConvoUI] LoadConversation(): Invalid conversation data:", err);
        return null;
    }
}

export function LoadConversationById(id) {
    if (!requireGM("LoadConversationById")) return null;

    var matches = []
    getConvoJournals().forEach(j => {
        j.pages.forEach(p => {
            if (p.id == id) {
                matches.push(p)
            }
        });
    });

    if (matches.length == 0) {
        console.error("[ConvoUI] LoadConversationById(): Conversation with ID <" + String(id) + "> not found.");
        return null;
    }

    const entry = matches[0]
    return LoadConversation(entry)
}

export function LoadConversationByName(name) {
    if (!requireGM("LoadConversationByName")) return null;

    var matches = []
    getConvoJournals().forEach(j => {
        j.pages.forEach(p => {
            if (p.name == name) {
                matches.push(p)
            }
        });
    });

    if (matches.length == 0) {
        console.error("[ConvoUI] LoadConversationByName(): Conversation with name \"" + name + "\" not found.");
        return null;
    }

    const entry = matches[0]
    return LoadConversation(entry)
}

export function GetConversations() {
    if (!requireGM("GetConversations")) return null;

    var matches = []
    getConvoJournals().forEach(j => {
        j.pages.forEach(p => {
            matches.push(p)
        });
    });

    return matches
}

export async function DeleteConversationById(id) {
    if (!requireGM("DeleteConversationById")) return false;

    // Find all pages with a matching ID
    const matches = [];
    for (const j of getConvoJournals()) {
        for (const p of j.pages) {
            if (p.id === id) matches.push(p);
        }
    }

    if (matches.length === 0) {
        console.error(`[ConvoUI] DeleteConversationById(): Conversation with ID <${id}> not found.`);
        return false;
    }

    const page = matches[0];
    const parentJournal = page.parent;

    try {
        console.log(`[ConvoUI] Deleting conversation page <${id}> (${page.name})...`);
        await parentJournal.deleteEmbeddedDocuments("JournalEntryPage", [page.id]);
        console.log(`[ConvoUI] Conversation <${id}> deleted successfully.`);
        return true;
    } catch (err) {
        console.error(`[ConvoUI] Failed to delete conversation <${id}>:`, err);
        return false;
    }
}

export function broadcastConversation() {
    if (!game.user.isGM) return;
    const SOCKCHANNEL = game.krisconvoui.SOCKCHANNEL

    const conversation = game.krisconvoui.conversation;
    // Redact unrevealed participants' data instead of sending it over the
    // socket, since clients receive this regardless of whether the UI
    // renders it. Keeps the array shape/indices unchanged.
    const payload = conversation == null
        ? null
        : {
            ...conversation,
            participants: conversation.participants.map(p =>
                p.isRevealed ? p : { name: "", image: "", actor: "", isRevealed: false }
            )
        };

    console.log("[ConvoUI] Emitted convo-sync")
    game.socket.emit(SOCKCHANNEL, {
        t: "convo-sync",
        convo: JSON.stringify(payload)
    });
}

