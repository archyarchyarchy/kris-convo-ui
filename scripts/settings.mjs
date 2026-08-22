export function initializeSettings() {
    const MOD = game.krisconvoui.MODULE
    console.log("[ConvoUI] INFO: Initializing settings...")
    let initialSettings = {};

    game.settings.register(MOD, "defaultCollapsed", {
    name: "Start Collapsed",
    hint: "If enabled, Party HUD starts in its collapsed (nametag-only) state.",
    scope: "client",
    config: true,
    type: Boolean,
    default: false
    });

    game.settings.register(MOD, "enableJournalButton", {
    name: "Enable Journal Button",
    hint: "Show a journal button for characters with matching entries.",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
    });

    game.settings.register(MOD, "enableSheetClick", {
    name: "Click Opens Character Sheet",
    hint: "Enable clicking character portraits to open their sheets.",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
    });

    game.settings.register(MOD, "enableNameBar", {
    name: "Display Name Bar",
    hint: "Display the character's name on their portrait.",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
    });

    game.settings.register(MOD, "portraitWidth", {
    name: "Portrait Width",
    hint: "Set the width of the character portrait boxes (in pixels).",
    scope: "client",
    config: true,
    type: Number,
    range: {
        min: 50,
        max: 300,
        step: 10
    },
    default: 150
    });

    game.settings.register(MOD, "portraitHeight", {
    name: "Portrait Height",
    hint: "Set the height of the character portrait boxes (in pixels).",
    scope: "client",
    config: true,
    type: Number,
    range: {
        min: 50,
        max: 300,
        step: 10
    },
    default: 200
    });

    initialSettings = {
        enableJournalButton: game.settings.get(MOD, "enableJournalButton"),
        enableSheetClick: game.settings.get(MOD, "enableSheetClick"),
        enableNameBar: game.settings.get(MOD, "enableNameBar"),
        portraitWidth: game.settings.get(MOD, "portraitWidth"),
        portraitHeight: game.settings.get(MOD, "portraitHeight"),
    };

    Hooks.on("closeSettingsConfig", () => {
    const newSettings = {
    enableJournalButton: game.settings.get(MOD, "enableJournalButton"),
    enableSheetClick: game.settings.get(MOD, "enableSheetClick"),
    enableNameBar: game.settings.get(MOD, "enableNameBar"),
    portraitWidth: game.settings.get(MOD, "portraitWidth"),
    portraitHeight: game.settings.get(MOD, "portraitHeight"),
    };

    const changed = Object.keys(initialSettings).some(
    key => initialSettings[key] !== newSettings[key]
    );

    if (changed) {
    Dialog.confirm({
        title: "Reload Required",
        content: "<p>Some Party HUD settings have changed. Reload the page to apply changes?</p>",
        yes: () => window.location.reload(),
        no: () => {},
        defaultYes: true
    });
    }

    initialSettings = newSettings;
    });
}