# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

```bash
pnpm install        # Install dependencies
pnpm build          # Compile TypeScript to dist/
pnpm dev -- <args>  # Run directly from source (e.g., pnpm dev -- add foo 'bar')
pnpm start -- <args> # Run compiled build
pnpm test           # Run tests in watch mode
pnpm test:run       # Run tests once
```

## Architecture

Single-file CLI application (`src/index.ts`) that manages zsh aliases stored in `~/.zsh_aliases_managed`.

**Directory structure:**
- `~/.zsh_aliases_managed` - Alias definitions (sourced by zshrc)
- `~/.zam/metadata.json` - Alias metadata (tags, created dates)
- `~/.zam/backups/` - Backup files

**Core flow:**
- `ensureSetup()` / `ensureZamDir()` create required files and directories
- `parseAliases()` / `readAliases()` parse the `alias name='command'` format
- `writeAliases()` serializes the alias map with proper escaping (single quotes escaped as `'\''`)
- `readMetadata()` / `writeMetadata()` handle tag and date storage

**Commands:**
- `add <name> <cmd> [-t tag]` - Add alias with optional tag
- `remove <name>` - Remove alias
- `rename <old> <new>` - Rename alias
- `list [-t tag]` - List aliases, optionally filtered by tag
- `search <query> [-t tag]` - Search with highlighting
- `edit <name>` - Edit alias in $EDITOR
- `backup` - Create backup in ~/.zam/backups/
- `backups` - List available backups
- `restore <file>` - Restore from backup
- `import` - Import aliases from .zshrc
- (default) - Interactive mode with fuzzy search

**Key dependencies:**
- commander: CLI framework
- @inquirer/prompts: Interactive mode (select, input, search, confirm)
- chalk: Terminal styling

**Global flag:** `--dry-run` (`-d`) simulates actions without writing files

## TypeScript Configuration

- ES2022 target with NodeNext modules
- Strict mode enabled
- ESM package (`"type": "module"`)
