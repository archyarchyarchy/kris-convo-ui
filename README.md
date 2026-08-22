# Kris' Conversation UI

A Foundry VTT module combining three things:

- A conversation UI for displaying NPC/PC speaker portraits during roleplay, inspired by [Saervicus' conversation-hud](https://github.com/CristianVasile23/conversation-hud).
- A party portrait bar (bottom-of-screen HUD for the player party).
- A WebSocket client that connects to a local Discord bot (`ws://127.0.0.1:21999`) to highlight party members while they're speaking.

Supersedes `party-hud` / `party-hud-local` as the party-portrait-bar implementation going forward.

## Development setup

This repo is developed outside of Foundry's `Data/modules` folder and symlinked in, so edits here are picked up immediately without copying files.

From an elevated PowerShell (mklink requires admin rights, or enable Windows Developer Mode):

```powershell
New-Item -ItemType SymbolicLink -Path "C:\Users\Krist\AppData\Local\FoundryVTT\Data\modules\kris-convo-ui" -Target "D:\Projects\Claude Projects\kris-convo-ui"
```

Then enable the module in your world and reload Foundry after each change (`Ctrl+F5` for a hard refresh).

## Release process

Releases are built by [.github/workflows/release.yml](.github/workflows/release.yml):

1. Bump `version` in `module.json`.
2. Commit, then tag the commit `vX.Y.Z` matching the new version and push the tag:
   ```bash
   git tag v0.0.1
   git push origin v0.0.1
   ```
3. GitHub Actions zips the module and publishes a release with `module.zip` and `module.json` attached. Foundry's manifest URL (`.../releases/latest/download/module.json`) always resolves to the newest tagged release.

## License

MIT — see [LICENSE](LICENSE).
