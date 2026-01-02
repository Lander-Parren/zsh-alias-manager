# Zsh Alias Manager (zam)

## Project Overview

**Zsh Alias Manager** (`zam`) is a Command Line Interface (CLI) tool designed to simplify the management of Zsh aliases. It allows users to add, remove, and list aliases without manually editing configuration files.

The tool operates by maintaining a dedicated aliases file (`~/.zsh_aliases_managed`) and ensuring it is automatically sourced by the user's main `~/.zshrc` configuration.

### Key Technologies

*   **Runtime:** Node.js
*   **Language:** TypeScript (ES2022, strict mode)
*   **CLI Framework:** [Commander.js](https://www.npmjs.com/package/commander)
*   **Styling:** [Chalk](https://www.npmjs.com/package/chalk) for terminal output
*   **Package Manager:** pnpm

### Architecture

The application entry point is `src/index.ts`. Key functionalities include:
*   **`ensureSetup()`**: Automatically creates the managed aliases file and appends the source command to `~/.zshrc` if missing.
*   **Command Handlers**:
    *   `add <name> <command>`: Parses existing aliases, updates the map, and writes back to the file.
    *   `remove <name>`: Removes an alias from the map and updates the file.
    *   `list`: Displays all currently managed aliases.
    *   `search <query>`: filters aliases by name or command.
    *   `edit <name>`: Opens the alias command in the default `$EDITOR`.
    *   `backup` / `restore`: Manages backups of the alias file.
    *   `import`: Migrates existing aliases from `.zshrc`.
    *   **Interactive Mode**: Launched when no command is provided, using `inquirer` for a TUI experience.

## Building and Running

### Prerequisites

*   Node.js (v18+ recommended)
*   pnpm

### Installation

```bash
pnpm install
```

### Development

To run the CLI directly from source using `ts-node`:

```bash
pnpm dev -- help
# Example:
pnpm dev -- add myalias 'echo hello'
```

### Building

To compile the TypeScript source to JavaScript (output in `dist/`):

```bash
pnpm build
```

### Running Production Build

After building, you can run the compiled JavaScript:

```bash
pnpm start -- help
# Or directly via node:
node dist/index.js list
```

## Features & Usage

### 1. Basic Management
```bash
zam add foo 'echo bar'
zam remove foo
zam list
```

### 2. Search
Find aliases by name or command content:
```bash
zam search git
```

### 3. Interactive Mode
Simply run `zam` without arguments to enter an interactive menu where you can browse, search, add, and delete aliases using arrow keys.
```bash
zam
```

### 4. Backup & Restore
Safeguard your aliases:
```bash
zam backup              # Creates a timestamped .bak file in home dir
zam restore <file.bak>  # Restores from a specific backup
```

### 5. Bulk Import
Import legacy aliases from your `.zshrc`:
```bash
zam import
```
*Note: This will comment out the original aliases in `.zshrc` to avoid conflicts.*

### 6. Editing
Edit complex aliases in your default editor (`$EDITOR`):
```bash
zam edit my-complex-alias
```

### 7. Safety: Dry Run
Preview any command without making changes:
```bash
zam --dry-run import
zam -d remove foo
```

## Development Conventions

*   **Type Safety:** The project uses strict TypeScript settings (`"strict": true`, `"module": "NodeNext"`). Ensure all new code is fully typed.
*   **File Handling:** The tool uses synchronous file system operations (`fs.readFileSync`, `fs.writeFileSync`) for simplicity, given the small file sizes of alias lists.
*   **Configuration:** The tool relies on standard `os.homedir()` resolution to locate Zsh configuration files.
*   **Formatting:** Follows standard TypeScript formatting conventions.

## Project Structure

*   `src/index.ts`: Main application logic and CLI definition.
*   `dist/`: Compiled JavaScript output (generated after build).
*   `package.json`: Project metadata, scripts, and dependencies.
*   `tsconfig.json`: TypeScript compiler configuration.
