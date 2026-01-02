# zsh-alias-manager (zam)

A CLI tool to manage your zsh aliases with tags, search, backups, and an interactive mode.

## Installation

```bash
npm install -g zsh-alias-manager
```

## Usage

```bash
# Interactive mode (default)
zam

# Add an alias
zam add gs "git status"
zam add gp "git push" --tag git

# List aliases
zam list
zam list --tag git

# Search with highlighting
zam search git

# Rename an alias
zam rename gs gst

# Remove an alias
zam remove gst

# Edit in $EDITOR
zam edit gs

# Backup & restore
zam backup
zam backups
zam restore ~/.zam/backups/zam-backup-2024-01-01.bak

# Import existing aliases from .zshrc
zam import

# Dry run (simulate without changes)
zam --dry-run add test "echo test"
```

## Features

- **Interactive mode** - Fuzzy search and menu-driven interface
- **Tags** - Organize aliases by category (git, docker, etc.)
- **Search** - Find aliases with highlighted matches
- **Backups** - Automatic backup management in `~/.zam/backups/`
- **Import** - Migrate existing aliases from `.zshrc`
- **Dry run** - Preview changes before applying

## File Locations

- `~/.zsh_aliases_managed` - Your aliases (sourced by zshrc)
- `~/.zam/metadata.json` - Tags and metadata
- `~/.zam/backups/` - Backup files

## License

MIT
