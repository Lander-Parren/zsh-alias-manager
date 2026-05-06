# zsh-alias-manager (zam)

A CLI tool to manage your zsh aliases with tags, search, backups, project window layouts, and an interactive mode.

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

# Capture the current visible windows as a reusable layout template
zam layout capture dev

# Create a project from a template and generate alias `myapp`
zam project create myapp --template dev --cwd ~/Developer/myapp
myapp

# Capture a project-specific layout and generate alias `api`
zam project capture api --cwd ~/Developer/api --alias api
api

# Dry run (simulate without changes)
zam --dry-run add test "echo test"
```

## Features

- **Interactive mode** - Fuzzy search and menu-driven interface
- **Tags** - Organize aliases by category (git, docker, etc.)
- **Search** - Find aliases with highlighted matches
- **Backups** - Automatic backup management in `~/.zam/backups/`
- **Import** - Migrate existing aliases from `.zshrc`
- **Project layouts** - Capture macOS windows, create reusable templates, and open project apps in position
- **Dry run** - Preview changes before applying

## Project Window Layouts

Layouts are macOS-only in v1 and use built-in AppleScript/System Events automation. No extra packages are required, but your terminal app must have Accessibility permission:

1. Open System Settings → Privacy & Security → Accessibility
2. Enable your terminal app, such as Terminal, iTerm, or VS Code
3. Re-run the `zam layout capture` or `zam project open` command

Capture asks which currently visible desktop/display group and which windows to include. Hidden macOS Spaces are not visible to the built-in backend, so move to each Space and capture the windows you want from there.

You can also run `zam` and choose **Project Layouts** for the guided menu.

```bash
# Save the currently positioned visible windows as a template
zam layout capture dev

# Inspect templates
zam layout list
zam layout show dev

# Create a project using the same window layout in a different directory
zam project create webapp --template dev --cwd ~/Developer/webapp

# Capture a one-off project layout
zam project capture backend --cwd ~/Developer/backend

# Open project apps and restore window positions
zam project open webapp

# Manage projects
zam project list
zam project show webapp
zam project remove webapp
```

Generated project aliases are normal managed zsh aliases. For example, `zam project create webapp --template dev --cwd ~/Developer/webapp` creates `webapp='zam project open webapp'`.

## File Locations

- `~/.zsh_aliases_managed` - Your aliases (sourced by zshrc)
- `~/.zam/metadata.json` - Tags and metadata
- `~/.zam/layouts.json` - Project layouts and templates
- `~/.zam/backups/` - Backup files

## License

MIT
