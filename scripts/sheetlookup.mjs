/**
 * Opens the most appropriate sheet for a clicked name: the actor's own
 * sheet if one is linked and viewable, otherwise a journal entry or
 * journal entry page matching the name, whichever the user can view first.
 *
 * Returns true if something was opened, false otherwise.
 */
export function openSheetForName(event, actor, name) {
    const titleToLookFor = name.toLowerCase().replace(/\s+/g, '');

    if (actor && actor.testUserPermission(game.user, "LIMITED")) {
        event.preventDefault();
        actor.sheet.render(true);
        return true;
    }

    const journals = game.journal.contents.filter(j => j.name.toLowerCase().replace(/\s+/g, '') === titleToLookFor);
    for (const journal of journals) {
        if (journal.testUserPermission(game.user, "LIMITED")) {
            event.preventDefault();
            journal.sheet.render(true);
            return true;
        }
    }

    const pages = game.journal.contents.flatMap(j => j.pages.contents);
    for (const page of pages) {
        const pageName = page.name.toLowerCase().replace(/\s+/g, '');
        if (pageName === titleToLookFor && page.testUserPermission(game.user, "LIMITED")) {
            event.preventDefault();
            page.parent.sheet.render(true, { pageId: page.id }); // Open journal on this page
            return true;
        }
    }

    return false;
}
