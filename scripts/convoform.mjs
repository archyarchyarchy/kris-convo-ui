import { Participant, Conversation, SaveConversation, LoadConversationById } from "./convodata.mjs";
import { updateConvoUI } from "./convoui.mjs";
import { propagateConversation, updateButtonUI } from "./main.mjs"
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class CreateConversationForm extends HandlebarsApplicationMixin(ApplicationV2) {
  /** Initial draft state lives on the instance so we can re-render as user adds/removes participants */
  constructor(initial = null, options = {}) {
    super(options);

    const defaults = {
      id: "",
      name: "",
      background: "",
      participants: [],
    };

    this.initial = initial
    this.isEditing = initial !== null

    // Seed from existing or defaults (does not mutate source)
    this._draft = foundry.utils.deepClone(initial ?? defaults);
    //console.log("constructor(): " + this._draft.id)
  }

  static DEFAULT_OPTIONS = {
    id: "create-conversation",
    title: "Create Conversation",
    tag: "form",
    width: 1400,
    height: "auto",
    resizable: true,
    classes: ["kris-convo-ui", "create-conversation"],
    form: {
      handler: CreateConversationForm._handleSubmit,
      submitOnChange: false,
      closeOnSubmit: true
    },
    // Declarative action handlers (elements with [data-action])
    actions: {
      "add-participant": CreateConversationForm._onAddParticipant,
      "remove-participant": CreateConversationForm._onRemoveParticipant,
      "pick-image": CreateConversationForm._onPickImage,
      "pick-actor": CreateConversationForm._onPickActor
    }
  };

  static PARTS = {
    body: { template: "modules/kris-convo-ui/templates/create-conversation.hbs" }
  };

  /** Template context */
  async _prepareContext(_options) {
    const actors = game.actors.contents.map(a => ({
      uuid: a.uuid,           // "Actor.<id>"
      name: a.name,
      type: a.type
    })).sort((a, b) => a.name.localeCompare(b.name));

    const isEditing = this.isEditing

    return {
      draft: this._draft,
      actors,
      isEditing
    };
  }

  // ---------- Actions ----------

static _onAddParticipant(event, target) {
  this._syncDraftFromForm();        // capture what's typed
  this._draft.participants ??= [];
  this._draft.participants.push({ name: "", image: "", actor: "", isRevealed: true });
  //console.log(this._draft.participants)
  this.render();
}

static _onRemoveParticipant(event, target) {
  this._syncDraftFromForm();        // capture what's typed
  const idx = Number(target?.dataset?.index ?? -1);
  if (Number.isInteger(idx) && idx >= 0) {
    this._draft.participants.splice(idx, 1);
    this.render();
  }
}

static async _onPickImage(event, target) {
  const selector = target.dataset.target;
  const input = this.element?.querySelector(selector);
  const current = input?.value || "";
  const fp = new FilePicker({
    type: "image",
    current,
    callback: (path) => {
      if (input) input.value = path;
      this._applyInputToDraft(input ?? selector);  // keep draft in sync
      // Optionally reflect immediately (no full re-render):
      //this.render();
    }
  });
  fp.render(true);
}

static _onPickActor(event, target) {
  this._applyInputToDraft(target);  // writes select value into draft
}


_formEl() {
	// Because tag: "form", the app root *is* the form
	return /** @type {HTMLFormElement|null} */ (this.element ?? null);
	}

_syncDraftFromForm() {
  const formEl = this._formEl();
  if (!formEl) return;

  const fd = new foundry.applications.ux.FormDataExtended(formEl);
  const obj = fd.object;

  // Always sync the simple top-level fields
  this._draft.name = obj.name ?? this._draft.name ?? "";
  this._draft.background = obj.background ?? this._draft.background ?? "";
  this._draft.id = obj.id ?? this._draft.id ?? "";
  //console.log("_syncDraftFromForm(): " + this._draft.id)


  // --- Reconstruct participants manually from flat keys ---

  // We'll build a temporary map: index -> participant data
  const participantsByIndex = {};

  for (const [key, value] of Object.entries(obj)) {
    // We only care about keys like 'participants[NUMBER][FIELD]'
    // Example match: 'participants[0][name]'
    const match = key.match(/^participants\[(\d+)\]\[(\w+)\]$/);
    if (!match) continue;

    const [, indexStr, field] = match;
    const index = Number(indexStr);

    if (!participantsByIndex[index]) {
      participantsByIndex[index] = { name: "", image: "", actor: "", isRevealed: true };
    }

    participantsByIndex[index][field] = value;
  }

  // Turn that map into an ordered array (0,1,2,...)
  const rebuiltParticipants = Object.keys(participantsByIndex)
    .sort((a, b) => Number(a) - Number(b))
    .map(i => {
      const p = participantsByIndex[i];
      return {
        name: (p.name ?? "").trim(),
        image: p.image || "",
        actor: p.actor || "",
        isRevealed: p.isRevealed || true
      };
    });

  // Only update draft.participants if we actually found any rows in the DOM.
  // This prevents us from wiping the draft on the first ever + click.
  if (rebuiltParticipants.length > 0) {
    this._draft.participants = rebuiltParticipants;
  }

  // Done.
}

_applyInputToDraft(inputOrSelector) {
  const formEl = this._formEl();
  if (!formEl) return;

  let el = null;
  if (typeof inputOrSelector === "string") {
    el = formEl.querySelector(inputOrSelector);
  } else if (inputOrSelector instanceof HTMLElement) {
    el = inputOrSelector;
  }
  if (!el) return;

  const name = el.getAttribute("name");
  if (!name) return;

  // Convert bracket path to dot path: participants[0][name] -> participants.0.name
  const path = name.replaceAll(/\[(\d+)\]/g, ".$1").replaceAll(/\]\[/g, ".").replaceAll(/\[|\]/g, "");

  // Derive value by element type
  let value;
  if (el instanceof HTMLInputElement) {
    const type = (el.getAttribute("type") || "").toLowerCase();
    if (type === "checkbox") {
      value = el.checked;
    } else if (type === "number" || type === "range") {
      const v = el.value.trim();
      value = v === "" ? "" : Number(v);
    } else {
      value = el.value;
    }
  } else if (el instanceof HTMLSelectElement) {
    if (el.multiple) {
      value = Array.from(el.selectedOptions).map(o => o.value);
    } else {
      value = el.value;
    }
  } else if (el instanceof HTMLTextAreaElement) {
    value = el.value;
  } else {
    // Fallback: try value property if present
    value = /** @type {any} */ (el).value ?? "";
  }

  foundry.utils.setProperty(this._draft, path, value);
}


static async _handleSubmit(event, form, formData) {
    const data = formData.object;

    const newConversation = new Conversation([], -1, data.background);
    newConversation.name = data.name ?? ""
    const needsName = newConversation.name === ""

    const participantsByIndex = {};

    for (const [key, value] of Object.entries(data)) {
      // match keys like "participants[0][name]"
      const match = key.match(/^participants\[(\d+)\]\[(\w+)\]$/);
      if (!match) continue;

      const [, indexStr, field] = match;
      const index = Number(indexStr);

      if (!participantsByIndex[index]) {
        participantsByIndex[index] = {
          name: "",
          image: "",
          actor: "",
          isRevealed: true
        };
      }

      participantsByIndex[index][field] = value;
    }

    const participantsArray = Object.keys(participantsByIndex)
      .sort((a, b) => Number(a) - Number(b))
      .map(i => participantsByIndex[i]);

    participantsArray.forEach(p => {
      const name = (p.name ?? "").trim();

      const participant = new Participant(name, p.image || "", p.actor || "");
      participant.isRevealed = p.isRevealed;
      newConversation.participants.push(participant);
      if (needsName) {
        if (newConversation.name != "") newConversation.name += "|";
        newConversation.name += p.name
      }
    });

    if (this.isEditing) {
      newConversation.id = this.initial.id
      newConversation.speaker = this.initial.speaker

      if (newConversation.speaker >= participantsArray.length) {
        newConversation.speaker = -1
      }
    }

    if (game.krisconvoui.conversation != null) {
      await SaveConversation(game.krisconvoui.conversation);
    }
    game.krisconvoui.conversation = newConversation;
    const saved = await SaveConversation(newConversation);
    updateConvoUI()
    updateButtonUI()

    propagateConversation()
  }
}

export class LoadConversationForm extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "load-conversation-form",
    title: "Load Conversation",
    tag: "form",                // root element is <form>
    width: 400,
    resizable: true,
    classes: ["kris-convo-ui", "convoui-load-form"],
    form: {
      handler: LoadConversationForm._onSubmit,
      submitOnChange: false,
      closeOnSubmit: true
    },
    actions: {
      "refresh-list": LoadConversationForm._onRefresh
    }
  };

  // IMPORTANT: PARTS must be its own static property
  static PARTS = {
    body: { template: "modules/kris-convo-ui/templates/load-conversation.hbs" }
  };

  constructor(options = {}) {
    super(options);

    // We'll cache the choices here so we don't have to re-scan journals on submit.
    // Each entry is { id, name, journalName }
    this._conversations = [];
  }

  /**
   * Build the list of available conversations.
   * This re-runs whenever the app renders.
   */
  async _prepareContext() {
    const MOD = game.krisconvoui.MODULE;

    // find all journal pages flagged as convo-data
    const conversations = [];
    for (const j of game.journal.contents) {
      if (j.flags?.[MOD]?.type !== "convo-data") continue;

      for (const p of j.pages) {
        // each page is one conversation chunk
        conversations.push({
          id: p.id,
          name: p.name || "(unnamed conversation)",
          journalName: j.name || "(unnamed journal)"
        });
      }
    }

    // sort them in some stable way (by journal then page name)
    conversations.sort((a, b) => {
      const ja = a.journalName.localeCompare(b.journalName);
      if (ja !== 0) return ja;
      return a.name.localeCompare(b.name);
    });

    // store internally so submit can look them up
    this._conversations = conversations;

    return {
      conversations, // passed to template
    };
  }

  /**
   * Click handler for "Refresh" button (optional convenience).
   * Just re-render to rebuild the list.
   */
  static _onRefresh(event, target) {
    this.render();
  }

  /**
   * Form submit.
   * We expect a `selectedId` from the form.
   */
  static async _onSubmit(event, formEl, formData) {
    const data = formData.object;
    const chosenId = data.selectedId;

    if (!chosenId) {
      ui.notifications?.warn("No conversation selected.");
      return;
    }


    const convo = await LoadConversationById(chosenId)
    game.krisconvoui.conversation = convo
    updateConvoUI()
    updateButtonUI()

    propagateConversation()
  }
}