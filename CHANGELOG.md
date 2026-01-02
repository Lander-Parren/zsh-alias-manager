# Changelog

## [1.1.0](https://github.com/Lander-Parren/zsh-alias-manager/compare/v1.0.0...v1.1.0) (2026-01-02)


### Features

* support multiple tags per alias ([644d677](https://github.com/Lander-Parren/zsh-alias-manager/commit/644d677265347ad108fce49641c5ed62f219b7b7))

## [1.0.0](https://github.com/Lander-Parren/zsh-alias-manager/releases/tag/v1.0.0) (2025-01-02)

### Added
- **Interactive mode** - Fuzzy search and menu-driven interface for managing aliases
- **Tags** - Organize aliases by category with `--tag` option
- **Search with highlighting** - Find aliases with visual match highlighting
- **Rename command** - Rename existing aliases with `zam rename <old> <new>`
- **Backup management** - Automatic backups in `~/.zam/backups/`
- **List backups** - View available backups with `zam backups`
- **Import** - Migrate existing aliases from `.zshrc` with `zam import`
- **Dry run mode** - Preview changes with `--dry-run` flag
- **Edit in $EDITOR** - Open alias in your preferred editor with `zam edit`
