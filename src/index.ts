#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { select, input, confirm as askConfirm, search } from '@inquirer/prompts';

// Directory structure
export const ZAM_DIR = path.join(os.homedir(), '.zam');
export const BACKUPS_DIR = path.join(ZAM_DIR, 'backups');
export const METADATA_FILE = path.join(ZAM_DIR, 'metadata.json');
export const ALIASES_FILE = path.join(os.homedir(), '.zsh_aliases_managed');
export const ZSHRC_FILE = path.join(os.homedir(), '.zshrc');

export const program = new Command();

// Metadata types
export interface AliasMetadata {
  tag?: string;
  created?: string;
}

export interface MetadataMap {
  [aliasName: string]: AliasMetadata;
}

// Ensure ~/.zam directory structure exists
function ensureZamDir() {
  if (!fs.existsSync(ZAM_DIR)) {
    fs.mkdirSync(ZAM_DIR, { recursive: true });
  }
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }
}

// Read metadata from ~/.zam/metadata.json
function readMetadata(): MetadataMap {
  ensureZamDir();
  if (!fs.existsSync(METADATA_FILE)) {
    return {};
  }
  try {
    const content = fs.readFileSync(METADATA_FILE, 'utf8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

// Write metadata to ~/.zam/metadata.json
function writeMetadata(metadata: MetadataMap) {
  ensureZamDir();
  fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2), 'utf8');
}

// Update metadata for a single alias
function setAliasMetadata(aliasName: string, data: Partial<AliasMetadata>) {
  const metadata = readMetadata();
  metadata[aliasName] = { ...metadata[aliasName], ...data };
  writeMetadata(metadata);
}

// Remove metadata for an alias
function removeAliasMetadata(aliasName: string) {
  const metadata = readMetadata();
  delete metadata[aliasName];
  writeMetadata(metadata);
}

// Get tag for an alias
function getAliasTag(aliasName: string): string | undefined {
  const metadata = readMetadata();
  return metadata[aliasName]?.tag;
}

// Highlight matching text in search results
function highlightMatch(text: string, query: string): string {
  if (!query) return text;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const idx = lowerText.indexOf(lowerQuery);
  if (idx === -1) return text;
  return text.slice(0, idx) +
         chalk.bgYellow.black(text.slice(idx, idx + query.length)) +
         text.slice(idx + query.length);
}

program
  .name('zam')
  .description('Zsh Alias Manager - Easily manage your zsh aliases')
  .version('1.0.0')
  .option('-d, --dry-run', 'Simulate actions without writing to files');

function getOptions() {
  return program.opts();
}

// Helper to ensure files exist and are linked
function ensureSetup() {
  const options = getOptions();

  if (!fs.existsSync(ALIASES_FILE)) {
    if (options.dryRun) {
      console.log(chalk.blue(`[Dry Run] Would create managed aliases file at ${ALIASES_FILE}`));
    } else {
      fs.writeFileSync(ALIASES_FILE, '# Managed by Zsh Alias Manager (zam)\n', 'utf8');
      console.log(chalk.green(`Created managed aliases file at ${ALIASES_FILE}`));
    }
  }

  // If zshrc doesn't exist (unlikely but possible), warn or create empty
  if (!fs.existsSync(ZSHRC_FILE)) {
    console.warn(chalk.yellow(`Warning: ${ZSHRC_FILE} not found. You might need to manually source ${ALIASES_FILE}`));
    return;
  }

  const zshrcContent = fs.readFileSync(ZSHRC_FILE, 'utf8');
  const sourceLine = `source ${ALIASES_FILE}`;
  const sourceLineAlt = `source "${ALIASES_FILE}"`;

  if (!zshrcContent.includes(sourceLine) && !zshrcContent.includes(sourceLineAlt)) {
    if (options.dryRun) {
      console.log(chalk.blue(`[Dry Run] Would add source instruction to ${ZSHRC_FILE}`));
    } else {
      fs.appendFileSync(ZSHRC_FILE, `\n# Added by Zsh Alias Manager (zam)\n[ -f "${ALIASES_FILE}" ] && source "${ALIASES_FILE}"\n`, 'utf8');
      console.log(chalk.green(`Added source instruction to ${ZSHRC_FILE}`));
      console.log(chalk.blue('Please restart your shell or run "source ~/.zshrc" to apply changes.'));
    }
  }
}

export interface AliasMap {
  [key: string]: string;
}

export function parseAliases(content: string): AliasMap {
  const aliases: AliasMap = {};
  const lines = content.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    // Rudimentary parsing for 'alias name=command'
    // We expect the file we manage to be fairly clean, but we should handle basic variations
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (!trimmed.startsWith('alias ')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;

    const key = trimmed.substring(6, eqIndex).trim();
    let value = trimmed.substring(eqIndex + 1).trim();

    // Strip surrounding quotes
    if ((value.startsWith("'" ) && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
      value = value.substring(1, value.length - 1);
    }
    
    // Unescape single quotes if we escaped them
    value = value.replace(/'\\''/g, "'");

    aliases[key] = value;
  }
  return aliases;
}

function readAliases(skipSetup = false): AliasMap {
  if (!skipSetup) ensureSetup();
  
  // In dry-run, the file might not exist yet if we just "pretended" to create it.
  if (!fs.existsSync(ALIASES_FILE)) {
    return {};
  }

  const content = fs.readFileSync(ALIASES_FILE, 'utf8');
  return parseAliases(content);
}

function writeAliases(aliases: AliasMap) {
  const options = getOptions();
  const lines = ['# Managed by Zsh Alias Manager (zam)'];
  
  // Sort keys for consistent file output
  const sortedKeys = Object.keys(aliases).sort();

  for (const name of sortedKeys) {
    const command = aliases[name];
    // Escape single quotes in command for storage: ' -> '\''
    const escapedCommand = command.replace(/'/g, "'\\''");
    lines.push(`alias ${name}='${escapedCommand}'`);
  }
  
  const content = lines.join('\n') + '\n';

  if (options.dryRun) {
    console.log(chalk.blue(`[Dry Run] Would write the following content to ${ALIASES_FILE}:`));
    console.log(chalk.dim(content));
  } else {
    fs.writeFileSync(ALIASES_FILE, content, 'utf8');
  }
}

// --- Commands ---

program
  .command('add')
  .argument('<name>', 'Name of the alias')
  .argument('<command>', 'Command to run')
  .option('-t, --tag <tag>', 'Tag/category for the alias (e.g., git, docker)')
  .description('Add a new alias')
  .action((name, command, options) => {
    try {
      const aliases = readAliases();
      if (aliases[name]) {
        console.log(chalk.yellow(`Overwriting existing alias '${name}' (was: ${aliases[name]})`));
      }
      aliases[name] = command;
      writeAliases(aliases);

      // Save metadata (tag and created date)
      if (!getOptions().dryRun) {
        const metaData: AliasMetadata = { created: new Date().toISOString() };
        if (options.tag) {
          metaData.tag = options.tag;
        }
        setAliasMetadata(name, metaData);

        const tagInfo = options.tag ? chalk.dim(` [${options.tag}]`) : '';
        console.log(chalk.green(`Alias '${name}' added successfully!${tagInfo}`));
        console.log(chalk.dim('Run "source ~/.zshrc" (or open a new terminal) to use it.'));
      }
    } catch (err: any) {
      console.error(chalk.red('Error adding alias:'), err.message);
    }
  });

program
  .command('remove')
  .argument('<name>', 'Name of the alias to remove')
  .description('Remove an existing alias')
  .action((name) => {
    try {
      const aliases = readAliases();
      if (!aliases[name]) {
        console.error(chalk.red(`Alias '${name}' not found.`));
        return;
      }
      delete aliases[name];
      writeAliases(aliases);
      if (!getOptions().dryRun) {
        removeAliasMetadata(name);
        console.log(chalk.green(`Alias '${name}' removed successfully!`));
        console.log(chalk.dim('Run "source ~/.zshrc" (or open a new terminal) to apply.'));
      }
    } catch (err: any) {
      console.error(chalk.red('Error removing alias:'), err.message);
    }
  });

program
  .command('rename')
  .argument('<oldName>', 'Current alias name')
  .argument('<newName>', 'New alias name')
  .description('Rename an existing alias')
  .action((oldName, newName) => {
    try {
      const aliases = readAliases();
      if (!aliases[oldName]) {
        console.error(chalk.red(`Alias '${oldName}' not found.`));
        return;
      }
      if (aliases[newName]) {
        console.error(chalk.red(`Alias '${newName}' already exists.`));
        return;
      }

      // Move the alias
      aliases[newName] = aliases[oldName];
      delete aliases[oldName];
      writeAliases(aliases);

      if (!getOptions().dryRun) {
        // Migrate metadata
        const metadata = readMetadata();
        if (metadata[oldName]) {
          metadata[newName] = metadata[oldName];
          delete metadata[oldName];
          writeMetadata(metadata);
        }
        console.log(chalk.green(`Alias '${oldName}' renamed to '${newName}'.`));
        console.log(chalk.dim('Run "source ~/.zshrc" (or open a new terminal) to apply.'));
      }
    } catch (err: any) {
      console.error(chalk.red('Error renaming alias:'), err.message);
    }
  });

program
  .command('list')
  .option('-t, --tag <tag>', 'Filter by tag')
  .description('List all managed aliases')
  .action((options) => {
    try {
      const aliases = readAliases();
      const metadata = readMetadata();
      let entries = Object.entries(aliases);

      // Filter by tag if specified
      if (options.tag) {
        entries = entries.filter(([name]) =>
          metadata[name]?.tag?.toLowerCase() === options.tag.toLowerCase()
        );
      }

      if (entries.length === 0) {
        if (options.tag) {
          console.log(chalk.yellow(`No aliases found with tag '${options.tag}'.`));
        } else {
          console.log(chalk.yellow('No aliases found.'));
        }
        return;
      }

      const tagInfo = options.tag ? ` (tag: ${options.tag})` : '';
      console.log(chalk.bold(`Managed Aliases${tagInfo}:`));
      for (const [name, cmd] of entries) {
        const tag = metadata[name]?.tag;
        const tagDisplay = tag ? chalk.dim(` [${tag}]`) : '';
        console.log(`  ${chalk.cyan(name)}${tagDisplay} = ${chalk.white(cmd)}`);
      }
    } catch (err: any) {
      console.error(chalk.red('Error listing aliases:'), err.message);
    }
  });

program
  .command('search')
  .argument('<query>', 'Text to search for (in name or command)')
  .option('-t, --tag <tag>', 'Filter by tag')
  .description('Search for an alias by name or command')
  .action((query, options) => {
    try {
      const aliases = readAliases();
      const metadata = readMetadata();
      const results: { name: string, cmd: string, tag?: string }[] = [];
      const lowerQuery = query.toLowerCase();

      for (const [name, cmd] of Object.entries(aliases)) {
        // Filter by tag first if specified
        if (options.tag && metadata[name]?.tag?.toLowerCase() !== options.tag.toLowerCase()) {
          continue;
        }

        if (name.toLowerCase().includes(lowerQuery) || cmd.toLowerCase().includes(lowerQuery)) {
          results.push({ name, cmd, tag: metadata[name]?.tag });
        }
      }

      if (results.length === 0) {
        console.log(chalk.yellow(`No aliases found matching '${query}'`));
        return;
      }

      console.log(chalk.bold(`Found ${results.length} matches:`));
      for (const res of results) {
        const tagDisplay = res.tag ? chalk.dim(` [${res.tag}]`) : '';
        const highlightedName = highlightMatch(res.name, query);
        const highlightedCmd = highlightMatch(res.cmd, query);
        console.log(`  ${chalk.cyan(highlightedName)}${tagDisplay} = ${chalk.white(highlightedCmd)}`);
      }
    } catch (err: any) {
      console.error(chalk.red('Error searching aliases:'), err.message);
    }
  });


function runBackup() {
    try {
      ensureZamDir();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(BACKUPS_DIR, `zam-backup-${timestamp}.bak`);

      if (getOptions().dryRun) {
        console.log(chalk.blue(`[Dry Run] Would copy ${ALIASES_FILE} to ${backupPath}`));
        return;
      }

      if (!fs.existsSync(ALIASES_FILE)) {
        console.error(chalk.red('No managed aliases file found to backup.'));
        return;
      }

      fs.copyFileSync(ALIASES_FILE, backupPath);
      console.log(chalk.green(`Backup created: ${path.basename(backupPath)}`));
      console.log(chalk.dim(`Location: ${backupPath}`));
    } catch (err: any) {
      console.error(chalk.red('Error creating backup:'), err.message);
    }
}

program
  .command('backup')
  .description('Backup managed aliases to a file')
  .action(() => {
    runBackup();
  });

program
  .command('backups')
  .description('List available backups')
  .action(() => {
    try {
      ensureZamDir();
      if (!fs.existsSync(BACKUPS_DIR)) {
        console.log(chalk.yellow('No backups found.'));
        return;
      }

      const files = fs.readdirSync(BACKUPS_DIR)
        .filter(f => f.endsWith('.bak'))
        .sort()
        .reverse(); // Most recent first

      if (files.length === 0) {
        console.log(chalk.yellow('No backups found.'));
        return;
      }

      console.log(chalk.bold('Available backups:'));
      files.forEach((f, i) => {
        const stats = fs.statSync(path.join(BACKUPS_DIR, f));
        const date = stats.mtime.toLocaleDateString();
        const time = stats.mtime.toLocaleTimeString();
        console.log(`  ${chalk.cyan(i + 1 + '.')} ${f} ${chalk.dim(`(${date} ${time})`)}`);
      });
      console.log(chalk.dim(`\nRestore with: zam restore ~/.zam/backups/<filename>`));
    } catch (err: any) {
      console.error(chalk.red('Error listing backups:'), err.message);
    }
  });


function runRestore(file: string) {
    try {
      const targetPath = path.resolve(file);
      if (!fs.existsSync(targetPath)) {
        console.error(chalk.red(`Backup file not found: ${targetPath}`));
        return;
      }

      if (getOptions().dryRun) {
        console.log(chalk.blue(`[Dry Run] Would overwrite ${ALIASES_FILE} with content from ${targetPath}`));
        return;
      }

      fs.copyFileSync(targetPath, ALIASES_FILE);
      console.log(chalk.green('Aliases restored successfully!'));
      console.log(chalk.dim('Run "source ~/.zshrc" to apply.'));
    } catch (err: any) {
      console.error(chalk.red('Error restoring backup:'), err.message);
    }
}

program
  .command('restore')
  .argument('<file>', 'Path to the backup file to restore')
  .description('Restore aliases from a backup file')
  .action((file) => {
    runRestore(file);
  });

program
  .command('edit')
  .argument('<name>', 'Name of the alias to edit')
  .description('Edit an alias using your default editor')
  .action(async (name) => {
    try {
      const aliases = readAliases();
      if (!aliases[name]) {
        console.error(chalk.red(`Alias '${name}' not found.`));
        return;
      }

      // We can't easily "edit" a single line in a file with $EDITOR in a standard way without creating a temp file.
      // So we will create a temp file with the command, let the user edit it, then read it back.
      const tmpFile = path.join(os.tmpdir(), `zam-edit-${name}-${Date.now()}.sh`);
      fs.writeFileSync(tmpFile, aliases[name], 'utf8');

      const editor = process.env.EDITOR || 'vi';
      
      if (getOptions().dryRun) {
        console.log(chalk.blue(`[Dry Run] Would open ${editor} to edit alias '${name}'`));
        return;
      }

      const child = spawn(editor, [tmpFile], {
        stdio: 'inherit'
      });

      child.on('exit', (code) => {
        if (code === 0) {
          const newCommand = fs.readFileSync(tmpFile, 'utf8').trim();
          if (newCommand && newCommand !== aliases[name]) {
            aliases[name] = newCommand;
            writeAliases(aliases);
            console.log(chalk.green(`Alias '${name}' updated.`));
          } else {
            console.log(chalk.yellow('No changes made.'));
          }
        } else {
          console.error(chalk.red('Editor exited with error code.'));
        }
        fs.unlinkSync(tmpFile);
      });

    } catch (err: any) {
      console.error(chalk.red('Error editing alias:'), err.message);
    }
  });


function runImport() {
    try {
      const options = getOptions();
      if (!fs.existsSync(ZSHRC_FILE)) {
        console.error(chalk.red('.zshrc not found.'));
        return;
      }

      const zshrcContent = fs.readFileSync(ZSHRC_FILE, 'utf8');
      const lines = zshrcContent.split('\n');
      const managedAliases = readAliases();
      let importedCount = 0;
      const newZshrcLines: string[] = [];

      // Regex to match "alias name='command'" or "alias name=command"
      // We are looking for un-managed aliases
      const aliasLineRegex = /^alias\s+([^=]+)=(.+)/;

      for (const line of lines) {
        const trimmed = line.trim();
        const match = trimmed.match(aliasLineRegex);
        
        // Skip if it's already commented or looks like our sourced line
        if (!trimmed.startsWith('alias') || trimmed.startsWith('#')) {
          newZshrcLines.push(line);
          continue;
        }

        if (match) {
          const name = match[1].trim();
          // Extract value logic similar to parseAliases
          const eqIndex = trimmed.indexOf('=');
          let value = trimmed.substring(eqIndex + 1).trim();
          if ((value.startsWith("'" ) && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
            value = value.substring(1, value.length - 1);
          }
          
          if (managedAliases[name]) {
            console.log(chalk.yellow(`Skipping import of '${name}' (already managed).`));
            newZshrcLines.push(line);
          } else {
            managedAliases[name] = value;
            importedCount++;
            // Comment out the line in .zshrc
            newZshrcLines.push(`# [Moved to zam] ${line}`);
            console.log(chalk.cyan(`Importing '${name}'...`));
          }
        } else {
          newZshrcLines.push(line);
        }
      }

      if (importedCount > 0) {
        if (options.dryRun) {
          console.log(chalk.blue(`[Dry Run] Would import ${importedCount} aliases.`));
          console.log(chalk.blue(`[Dry Run] Would comment out imported aliases in ${ZSHRC_FILE}`));
        } else {
          writeAliases(managedAliases);
          fs.writeFileSync(ZSHRC_FILE, newZshrcLines.join('\n'), 'utf8');
          console.log(chalk.green(`Successfully imported ${importedCount} aliases.`));
          console.log(chalk.green(`Original lines in .zshrc have been commented out.`));
        }
      } else {
        console.log(chalk.yellow('No new aliases found to import.'));
      }

    } catch (err: any) {
      console.error(chalk.red('Error importing aliases:'), err.message);
    }
}

program
  .command('import')
  .description('Import existing aliases from .zshrc')
  .action(() => {
    runImport();
  });

// Interactive Mode (Default)
program
  .command('interactive', { isDefault: true, hidden: true })
  .description('Interactive mode')
  .action(async () => {
    let isFirstRun = true;

    try {
      while (true) {
        // Only clear on first run, then use separator
        if (isFirstRun) {
          console.clear();
          isFirstRun = false;
        } else {
          console.log('\n' + chalk.dim('─'.repeat(40)) + '\n');
        }

        const aliases = readAliases();
        const metadata = readMetadata();
        const names = Object.keys(aliases).sort();
        const aliasCount = names.length;

        // Header with alias count
        const countText = aliasCount === 1 ? '1 alias' : `${aliasCount} aliases`;
        console.log(chalk.bold.magenta(` Zsh Alias Manager (${countText}) `));

        let action: string;

        if (aliasCount === 0) {
          action = await select({
            message: 'What would you like to do?',
            choices: [
              { name: 'Add Alias', value: 'Add Alias' },
              { name: 'Import from .zshrc', value: 'Import from .zshrc' },
              { name: 'Restore Backup', value: 'Restore Backup' },
              { name: 'Exit', value: 'Exit' }
            ]
          });
        } else {
          action = await select({
            message: 'Main Menu',
            choices: [
              { name: 'Search/Filter', value: 'Search/Filter' },
              { name: 'Add New', value: 'Add New' },
              { name: 'Edit Alias', value: 'Edit Alias' },
              { name: 'Delete Alias', value: 'Delete Alias' },
              { name: 'Rename Alias', value: 'Rename Alias' },
              { name: 'List All', value: 'List All' },
              { name: 'Import from .zshrc', value: 'Import from .zshrc' },
              { name: 'Backup/Restore', value: 'Backup/Restore' },
              { name: 'Exit', value: 'Exit' }
            ]
          });
        }

        if (action === 'Exit') {
          console.log(chalk.blue('\nBye!'));
          return;
        }

        if (action === 'Import from .zshrc') {
          runImport();
        }
        else if (action === 'Backup/Restore') {
          const subAction = await select({
            message: 'Backup/Restore',
            choices: [
              { name: 'Create Backup', value: 'backup' },
              { name: 'List Backups', value: 'list' },
              { name: 'Restore from Backup', value: 'restore' },
              { name: 'Back', value: 'back' }
            ]
          });

          if (subAction === 'backup') {
            runBackup();
          } else if (subAction === 'list') {
            ensureZamDir();
            const files = fs.existsSync(BACKUPS_DIR)
              ? fs.readdirSync(BACKUPS_DIR).filter(f => f.endsWith('.bak')).sort().reverse()
              : [];
            if (files.length === 0) {
              console.log(chalk.yellow('No backups found.'));
            } else {
              console.log(chalk.bold('Available backups:'));
              files.forEach((f, i) => {
                const stats = fs.statSync(path.join(BACKUPS_DIR, f));
                console.log(`  ${chalk.cyan(i + 1 + '.')} ${f} ${chalk.dim(`(${stats.mtime.toLocaleString()})`)}`);
              });
            }
          } else if (subAction === 'restore') {
            const filePath = await input({ message: 'Path to backup file:' });
            if (filePath) {
              runRestore(filePath);
            }
          }
        }
        else if (action === 'Add Alias' || action === 'Add New') {
          const name = await input({ message: 'Alias name:' });
          if (!name) continue;

          const command = await input({ message: 'Command:' });
          if (!command) continue;

          const tag = await input({ message: 'Tag (optional, e.g., git, docker):' });

          aliases[name] = command;
          writeAliases(aliases);

          const metaData: AliasMetadata = { created: new Date().toISOString() };
          if (tag) metaData.tag = tag;
          setAliasMetadata(name, metaData);

          console.log(chalk.green(`Alias '${name}' added.`));
        }
        else if (action === 'Edit Alias') {
          // Use search for fuzzy selection
          const selected = await search({
            message: 'Search and select alias to edit:',
            source: async (term) => {
              const filtered = names.filter(n =>
                !term || n.toLowerCase().includes(term.toLowerCase()) ||
                aliases[n].toLowerCase().includes(term.toLowerCase())
              );
              return filtered.map(n => ({
                name: `${n} = ${aliases[n]}`,
                value: n
              }));
            }
          });

          if (selected) {
            const newCommand = await input({
              message: 'New command:',
              default: aliases[selected]
            });
            if (newCommand && newCommand !== aliases[selected]) {
              aliases[selected] = newCommand;
              writeAliases(aliases);
              console.log(chalk.green(`Alias '${selected}' updated.`));
            } else {
              console.log(chalk.yellow('No changes made.'));
            }
          }
        }
        else if (action === 'Delete Alias') {
          // Use search for fuzzy selection
          const selected = await search({
            message: 'Search and select alias to delete:',
            source: async (term) => {
              const filtered = names.filter(n =>
                !term || n.toLowerCase().includes(term.toLowerCase()) ||
                aliases[n].toLowerCase().includes(term.toLowerCase())
              );
              return filtered.map(n => ({
                name: `${n} = ${aliases[n]}`,
                value: n
              }));
            }
          });

          if (selected) {
            console.log(chalk.dim(`  ${selected} = ${aliases[selected]}`));
            const confirmed = await askConfirm({ message: `Delete '${selected}'?` });

            if (confirmed) {
              delete aliases[selected];
              writeAliases(aliases);
              removeAliasMetadata(selected);
              console.log(chalk.green(`Alias '${selected}' deleted.`));
            }
          }
        }
        else if (action === 'Rename Alias') {
          const selected = await search({
            message: 'Search and select alias to rename:',
            source: async (term) => {
              const filtered = names.filter(n =>
                !term || n.toLowerCase().includes(term.toLowerCase()) ||
                aliases[n].toLowerCase().includes(term.toLowerCase())
              );
              return filtered.map(n => ({
                name: `${n} = ${aliases[n]}`,
                value: n
              }));
            }
          });

          if (selected) {
            const newName = await input({ message: 'New name:' });
            if (newName && newName !== selected) {
              if (aliases[newName]) {
                console.log(chalk.red(`Alias '${newName}' already exists.`));
              } else {
                aliases[newName] = aliases[selected];
                delete aliases[selected];
                writeAliases(aliases);

                // Migrate metadata
                if (metadata[selected]) {
                  const meta = readMetadata();
                  meta[newName] = meta[selected];
                  delete meta[selected];
                  writeMetadata(meta);
                }
                console.log(chalk.green(`Alias renamed: ${selected} → ${newName}`));
              }
            }
          }
        }
        else if (action === 'Search/Filter') {
          const query = await input({ message: 'Search:' });

          const matches = names.filter(n =>
            n.toLowerCase().includes(query.toLowerCase()) ||
            aliases[n].toLowerCase().includes(query.toLowerCase())
          );

          if (matches.length === 0) {
            console.log(chalk.yellow('No matches found.'));
          } else {
            console.log(chalk.bold(`Found ${matches.length} matches:`));
            matches.forEach(m => {
              const tag = metadata[m]?.tag;
              const tagDisplay = tag ? chalk.dim(` [${tag}]`) : '';
              console.log(`  ${highlightMatch(m, query)}${tagDisplay} = ${highlightMatch(aliases[m], query)}`);
            });
          }
        }
        else if (action === 'List All') {
          if (aliasCount === 0) {
            console.log(chalk.yellow('No aliases found.'));
          } else {
            console.log(chalk.bold('All Aliases:'));
            for (const name of names) {
              const tag = metadata[name]?.tag;
              const tagDisplay = tag ? chalk.dim(` [${tag}]`) : '';
              console.log(`  ${chalk.cyan(name)}${tagDisplay} = ${chalk.white(aliases[name])}`);
            }
          }
        }
      }
    } catch (err: any) {
      if (err instanceof Error && err.name === 'ExitPromptError') {
        // Handle Ctrl+C gracefully
        console.log(chalk.blue('\nBye!'));
      } else {
        console.error(chalk.red('Error in interactive mode:'), err.message || err);
      }
    }
  });

// Only run CLI when this file is executed directly (not imported for testing)
// Use realpathSync to handle symlinks (e.g., when installed globally via npm)
function checkIsMainModule(): boolean {
  try {
    const currentFilePath = new URL(import.meta.url).pathname;
    const executedFilePath = fs.realpathSync(process.argv[1]);
    const resolvedCurrentPath = fs.realpathSync(currentFilePath);
    // Guard against mocked fs that returns undefined
    if (!executedFilePath || !resolvedCurrentPath) {
      return false;
    }
    return resolvedCurrentPath === executedFilePath;
  } catch {
    // If realpathSync fails (e.g., during tests), assume not main module
    return false;
  }
}

if (checkIsMainModule()) {
  await program.parseAsync();
}