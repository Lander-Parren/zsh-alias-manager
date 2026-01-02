import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Mock fs module - need to handle package.json read at module load time
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    default: {
      ...actual,
      readFileSync: vi.fn((filePath: string, encoding?: string) => {
        // Return actual package.json for version reading
        if (typeof filePath === 'string' && filePath.includes('package.json')) {
          return actual.readFileSync(filePath, encoding as BufferEncoding);
        }
        return '';
      }),
      existsSync: vi.fn(() => true),
      writeFileSync: vi.fn(),
      mkdirSync: vi.fn(),
      copyFileSync: vi.fn(),
      readdirSync: vi.fn(() => []),
      statSync: vi.fn(() => ({ mtime: new Date() })),
      appendFileSync: vi.fn(),
      unlinkSync: vi.fn(),
      realpathSync: vi.fn((p: string) => p),
    },
    readFileSync: vi.fn((filePath: string, encoding?: string) => {
      if (typeof filePath === 'string' && filePath.includes('package.json')) {
        return actual.readFileSync(filePath, encoding as BufferEncoding);
      }
      return '';
    }),
    existsSync: vi.fn(() => true),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    copyFileSync: vi.fn(),
    readdirSync: vi.fn(() => []),
    statSync: vi.fn(() => ({ mtime: new Date() })),
    appendFileSync: vi.fn(),
    unlinkSync: vi.fn(),
    realpathSync: vi.fn((p: string) => p),
  };
});

import { parseAliases, program, ALIASES_FILE, ZSHRC_FILE, ZAM_DIR, BACKUPS_DIR, METADATA_FILE } from '../src/index.js';

// Helper to capture console output
let consoleOutput: string[] = [];
let consoleErrors: string[] = [];

const mockConsole = () => {
  consoleOutput = [];
  consoleErrors = [];
  vi.spyOn(console, 'log').mockImplementation((...args) => {
    consoleOutput.push(args.map(String).join(' '));
  });
  vi.spyOn(console, 'error').mockImplementation((...args) => {
    consoleErrors.push(args.map(String).join(' '));
  });
  vi.spyOn(console, 'warn').mockImplementation((...args) => {
    consoleOutput.push(args.map(String).join(' '));
  });
};

// Helper to run CLI command
const runCommand = async (args: string[]) => {
  // Reset program state for fresh parsing
  program.commands.forEach((cmd) => {
    cmd._actionResults = [];
  });
  await program.parseAsync(['node', 'zam', ...args]);
};

describe('parseAliases', () => {
  it('parses simple alias', () => {
    const content = "alias foo='bar'";
    const result = parseAliases(content);
    expect(result).toEqual({ foo: 'bar' });
  });

  it('parses alias with double quotes', () => {
    const content = 'alias foo="bar baz"';
    const result = parseAliases(content);
    expect(result).toEqual({ foo: 'bar baz' });
  });

  it('parses multiple aliases', () => {
    const content = `# Comment
alias foo='bar'
alias baz='qux'`;
    const result = parseAliases(content);
    expect(result).toEqual({ foo: 'bar', baz: 'qux' });
  });

  it('ignores comments', () => {
    const content = `# This is a comment
alias foo='bar'
# Another comment`;
    const result = parseAliases(content);
    expect(result).toEqual({ foo: 'bar' });
  });

  it('ignores empty lines', () => {
    const content = `
alias foo='bar'

alias baz='qux'
`;
    const result = parseAliases(content);
    expect(result).toEqual({ foo: 'bar', baz: 'qux' });
  });

  it('ignores lines without alias prefix', () => {
    const content = `export PATH=/usr/bin
alias foo='bar'
source ~/.bashrc`;
    const result = parseAliases(content);
    expect(result).toEqual({ foo: 'bar' });
  });

  it('handles alias without quotes', () => {
    const content = 'alias foo=bar';
    const result = parseAliases(content);
    expect(result).toEqual({ foo: 'bar' });
  });

  it('handles escaped single quotes', () => {
    const content = "alias foo='echo '\\''hello'\\'''";
    const result = parseAliases(content);
    expect(result).toEqual({ foo: "echo 'hello'" });
  });

  it('handles complex commands', () => {
    const content = "alias gs='git status'";
    const result = parseAliases(content);
    expect(result).toEqual({ gs: 'git status' });
  });

  it('returns empty object for empty content', () => {
    const result = parseAliases('');
    expect(result).toEqual({});
  });

  it('returns empty object for content with only comments', () => {
    const content = `# Comment 1
# Comment 2`;
    const result = parseAliases(content);
    expect(result).toEqual({});
  });
});

describe('CLI Commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConsole();

    // Default mock implementations
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('# Managed by Zsh Alias Manager (zam)\n');
    vi.mocked(fs.writeFileSync).mockImplementation(() => {});
    vi.mocked(fs.appendFileSync).mockImplementation(() => {});
    vi.mocked(fs.copyFileSync).mockImplementation(() => {});
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
    vi.mocked(fs.readdirSync).mockReturnValue([]);
    // Throw by default to prevent CLI auto-run during tests
    vi.mocked(fs.realpathSync).mockImplementation(() => { throw new Error('mock'); });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('add command', () => {
    it('adds a new alias', async () => {
      vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
        if (filePath === ALIASES_FILE) {
          return '# Managed by Zsh Alias Manager (zam)\n';
        }
        if (filePath === ZSHRC_FILE) {
          return `source ${ALIASES_FILE}`;
        }
        return '';
      });

      await runCommand(['add', 'myalias', 'echo hello']);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        ALIASES_FILE,
        expect.stringContaining("alias myalias='echo hello'"),
        'utf8'
      );
      expect(consoleOutput.join(' ')).toContain('added successfully');
    });

    it('overwrites existing alias with warning', async () => {
      vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
        if (filePath === ALIASES_FILE) {
          return "# Managed by Zsh Alias Manager (zam)\nalias myalias='old command'";
        }
        if (filePath === ZSHRC_FILE) {
          return `source ${ALIASES_FILE}`;
        }
        return '';
      });

      await runCommand(['add', 'myalias', 'new command']);

      expect(consoleOutput.join(' ')).toContain('Overwriting');
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        ALIASES_FILE,
        expect.stringContaining("alias myalias='new command'"),
        'utf8'
      );
    });
  });

  describe('remove command', () => {
    it('removes an existing alias', async () => {
      vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
        if (filePath === ALIASES_FILE) {
          return "# Managed by Zsh Alias Manager (zam)\nalias myalias='echo hello'";
        }
        if (filePath === ZSHRC_FILE) {
          return `source ${ALIASES_FILE}`;
        }
        return '';
      });

      await runCommand(['remove', 'myalias']);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        ALIASES_FILE,
        expect.not.stringContaining('myalias'),
        'utf8'
      );
      expect(consoleOutput.join(' ')).toContain('removed successfully');
    });

    it('shows error for non-existent alias', async () => {
      vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
        if (filePath === ALIASES_FILE) {
          return '# Managed by Zsh Alias Manager (zam)\n';
        }
        if (filePath === ZSHRC_FILE) {
          return `source ${ALIASES_FILE}`;
        }
        return '';
      });

      await runCommand(['remove', 'nonexistent']);

      expect(consoleErrors.join(' ')).toContain('not found');
    });
  });

  describe('list command', () => {
    it('lists all aliases', async () => {
      vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
        if (filePath === ALIASES_FILE) {
          return "# Managed\nalias foo='bar'\nalias baz='qux'";
        }
        if (filePath === ZSHRC_FILE) {
          return `source ${ALIASES_FILE}`;
        }
        return '';
      });

      await runCommand(['list']);

      expect(consoleOutput.join(' ')).toContain('foo');
      expect(consoleOutput.join(' ')).toContain('bar');
      expect(consoleOutput.join(' ')).toContain('baz');
      expect(consoleOutput.join(' ')).toContain('qux');
    });

    it('shows message when no aliases exist', async () => {
      vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
        if (filePath === ALIASES_FILE) {
          return '# Managed by Zsh Alias Manager (zam)\n';
        }
        if (filePath === ZSHRC_FILE) {
          return `source ${ALIASES_FILE}`;
        }
        return '';
      });

      await runCommand(['list']);

      expect(consoleOutput.join(' ')).toContain('No aliases found');
    });
  });

  describe('search command', () => {
    beforeEach(() => {
      vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
        if (filePath === ALIASES_FILE) {
          return "# Managed\nalias gs='git status'\nalias gp='git push'\nalias ll='ls -la'";
        }
        if (filePath === ZSHRC_FILE) {
          return `source ${ALIASES_FILE}`;
        }
        return '';
      });
    });

    it('finds aliases by name', async () => {
      await runCommand(['search', 'gs']);

      expect(consoleOutput.join(' ')).toContain('gs');
      expect(consoleOutput.join(' ')).toContain('git status');
    });

    it('finds aliases by command content', async () => {
      await runCommand(['search', 'git']);

      expect(consoleOutput.join(' ')).toContain('gs');
      expect(consoleOutput.join(' ')).toContain('gp');
      expect(consoleOutput.join(' ')).not.toContain('ll');
    });

    it('shows message when no matches found', async () => {
      await runCommand(['search', 'nonexistent']);

      expect(consoleOutput.join(' ')).toContain('No aliases found matching');
    });

    it('search is case-insensitive', async () => {
      await runCommand(['search', 'GIT']);

      expect(consoleOutput.join(' ')).toContain('gs');
      expect(consoleOutput.join(' ')).toContain('gp');
    });
  });

  describe('backup command', () => {
    it('creates a backup file', async () => {
      vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
        if (filePath === ZSHRC_FILE) {
          return `source ${ALIASES_FILE}`;
        }
        return '';
      });

      await runCommand(['backup']);

      expect(fs.copyFileSync).toHaveBeenCalledWith(
        ALIASES_FILE,
        expect.stringMatching(/zam-backup-.*\.bak/)
      );
      expect(consoleOutput.join(' ')).toContain('Backup created');
    });

    it('shows error when no aliases file exists', async () => {
      vi.mocked(fs.existsSync).mockImplementation((filePath) => {
        if (filePath === ALIASES_FILE) return false;
        return true;
      });
      vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
        if (filePath === ZSHRC_FILE) {
          return `source ${ALIASES_FILE}`;
        }
        return '';
      });

      await runCommand(['backup']);

      expect(consoleErrors.join(' ')).toContain('No managed aliases file found');
    });
  });

  describe('restore command', () => {
    it('restores from backup file', async () => {
      const backupPath = '/mock/home/backup.bak';
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
        if (filePath === ZSHRC_FILE) {
          return `source ${ALIASES_FILE}`;
        }
        return '';
      });

      await runCommand(['restore', backupPath]);

      expect(fs.copyFileSync).toHaveBeenCalledWith(
        path.resolve(backupPath),
        ALIASES_FILE
      );
      expect(consoleOutput.join(' ')).toContain('restored successfully');
    });

    it('shows error for non-existent backup file', async () => {
      vi.mocked(fs.existsSync).mockImplementation((filePath) => {
        if (String(filePath).includes('nonexistent')) return false;
        return true;
      });
      vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
        if (filePath === ZSHRC_FILE) {
          return `source ${ALIASES_FILE}`;
        }
        return '';
      });

      await runCommand(['restore', '/nonexistent/backup.bak']);

      expect(consoleErrors.join(' ')).toContain('Backup file not found');
    });
  });

  describe('import command', () => {
    it('imports aliases from .zshrc', async () => {
      vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
        if (filePath === ALIASES_FILE) {
          return '# Managed by Zsh Alias Manager (zam)\n';
        }
        if (filePath === ZSHRC_FILE) {
          return `export PATH=/usr/bin
alias myalias='echo hello'
alias other='test command'
source ${ALIASES_FILE}`;
        }
        return '';
      });

      await runCommand(['import']);

      // Should write the imported aliases
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        ALIASES_FILE,
        expect.stringContaining('myalias'),
        'utf8'
      );

      // Should comment out the old aliases in .zshrc
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        ZSHRC_FILE,
        expect.stringContaining('# [Moved to zam]'),
        'utf8'
      );

      expect(consoleOutput.join(' ')).toContain('Successfully imported');
    });

    it('skips already managed aliases', async () => {
      vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
        if (filePath === ALIASES_FILE) {
          return "# Managed\nalias existing='already here'";
        }
        if (filePath === ZSHRC_FILE) {
          return `alias existing='duplicate'
source ${ALIASES_FILE}`;
        }
        return '';
      });

      await runCommand(['import']);

      expect(consoleOutput.join(' ')).toContain('Skipping');
      expect(consoleOutput.join(' ')).toContain('already managed');
    });

    it('shows message when no aliases to import', async () => {
      vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
        if (filePath === ALIASES_FILE) {
          return '# Managed by Zsh Alias Manager (zam)\n';
        }
        if (filePath === ZSHRC_FILE) {
          return `export PATH=/usr/bin
source ${ALIASES_FILE}`;
        }
        return '';
      });

      await runCommand(['import']);

      expect(consoleOutput.join(' ')).toContain('No new aliases found');
    });
  });

  describe('dry-run mode', () => {
    it('does not write files with --dry-run flag', async () => {
      vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
        if (filePath === ALIASES_FILE) {
          return '# Managed by Zsh Alias Manager (zam)\n';
        }
        if (filePath === ZSHRC_FILE) {
          return `source ${ALIASES_FILE}`;
        }
        return '';
      });

      await runCommand(['--dry-run', 'add', 'test', 'echo test']);

      expect(consoleOutput.join(' ')).toContain('[Dry Run]');
      // writeFileSync should only be called for reading, not for writing the alias
      const writeFileCalls = vi.mocked(fs.writeFileSync).mock.calls;
      const aliasWriteCalls = writeFileCalls.filter(
        (call) => call[0] === ALIASES_FILE && String(call[1]).includes('alias test')
      );
      expect(aliasWriteCalls).toHaveLength(0);
    });

    it('shows what would be backed up with --dry-run', async () => {
      vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
        if (filePath === ZSHRC_FILE) {
          return `source ${ALIASES_FILE}`;
        }
        return '';
      });

      await runCommand(['--dry-run', 'backup']);

      expect(consoleOutput.join(' ')).toContain('[Dry Run]');
      expect(consoleOutput.join(' ')).toContain('Would copy');
      expect(fs.copyFileSync).not.toHaveBeenCalled();
    });
  });
});

describe('ensureSetup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConsole();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates aliases file if it does not exist', async () => {
    vi.mocked(fs.existsSync).mockImplementation((filePath) => {
      if (filePath === ALIASES_FILE) return false;
      return true;
    });
    vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
      if (filePath === ZSHRC_FILE) {
        return `source ${ALIASES_FILE}`;
      }
      return '';
    });

    await runCommand(['list']);

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      ALIASES_FILE,
      expect.stringContaining('# Managed by Zsh Alias Manager'),
      'utf8'
    );
  });

  it('adds source line to .zshrc if missing', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
      if (filePath === ALIASES_FILE) {
        return '# Managed by Zsh Alias Manager (zam)\n';
      }
      if (filePath === ZSHRC_FILE) {
        return 'export PATH=/usr/bin'; // No source line
      }
      return '';
    });

    await runCommand(['list']);

    expect(fs.appendFileSync).toHaveBeenCalledWith(
      ZSHRC_FILE,
      expect.stringContaining('source'),
      'utf8'
    );
  });

  it('does not add source line if already present', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
      if (filePath === ALIASES_FILE) {
        return '# Managed by Zsh Alias Manager (zam)\n';
      }
      if (filePath === ZSHRC_FILE) {
        return `source ${ALIASES_FILE}`;
      }
      return '';
    });

    await runCommand(['list']);

    expect(fs.appendFileSync).not.toHaveBeenCalled();
  });
});

describe('rename command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConsole();
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.writeFileSync).mockImplementation(() => {});
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renames an existing alias', async () => {
    vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
      if (filePath === ALIASES_FILE) {
        return "# Managed\nalias oldname='echo hello'";
      }
      if (filePath === ZSHRC_FILE) {
        return `source ${ALIASES_FILE}`;
      }
      if (filePath === METADATA_FILE) {
        return '{}';
      }
      return '';
    });

    await runCommand(['rename', 'oldname', 'newname']);

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      ALIASES_FILE,
      expect.stringContaining('newname'),
      'utf8'
    );
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      ALIASES_FILE,
      expect.not.stringContaining('oldname'),
      'utf8'
    );
    expect(consoleOutput.join(' ')).toContain('renamed');
  });

  it('shows error when source alias does not exist', async () => {
    vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
      if (filePath === ALIASES_FILE) {
        return '# Managed by Zsh Alias Manager (zam)\n';
      }
      if (filePath === ZSHRC_FILE) {
        return `source ${ALIASES_FILE}`;
      }
      if (filePath === METADATA_FILE) {
        return '{}';
      }
      return '';
    });

    await runCommand(['rename', 'nonexistent', 'newname']);

    expect(consoleErrors.join(' ')).toContain('not found');
  });

  it('shows error when target alias already exists', async () => {
    vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
      if (filePath === ALIASES_FILE) {
        return "# Managed\nalias oldname='echo old'\nalias newname='echo new'";
      }
      if (filePath === ZSHRC_FILE) {
        return `source ${ALIASES_FILE}`;
      }
      if (filePath === METADATA_FILE) {
        return '{}';
      }
      return '';
    });

    await runCommand(['rename', 'oldname', 'newname']);

    expect(consoleErrors.join(' ')).toContain('already exists');
  });
});

describe('tags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConsole();
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.writeFileSync).mockImplementation(() => {});
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('adds alias with tag', async () => {
    vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
      if (filePath === ALIASES_FILE) {
        return '# Managed by Zsh Alias Manager (zam)\n';
      }
      if (filePath === ZSHRC_FILE) {
        return `source ${ALIASES_FILE}`;
      }
      if (filePath === METADATA_FILE) {
        return '{}';
      }
      return '';
    });

    await runCommand(['add', 'gs', 'git status', '--tag', 'git']);

    expect(consoleOutput.join(' ')).toContain('added successfully');
    expect(consoleOutput.join(' ')).toContain('[git]');

    // Should write metadata with tags array
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      METADATA_FILE,
      expect.stringContaining('"tags"'),
      'utf8'
    );
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      METADATA_FILE,
      expect.stringContaining('"git"'),
      'utf8'
    );
  });

  it('filters list by tag', async () => {
    vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
      if (filePath === ALIASES_FILE) {
        return "# Managed\nalias gs='git status'\nalias gp='git push'\nalias ll='ls -la'";
      }
      if (filePath === ZSHRC_FILE) {
        return `source ${ALIASES_FILE}`;
      }
      if (filePath === METADATA_FILE) {
        return JSON.stringify({
          gs: { tag: 'git' },
          gp: { tag: 'git' },
          ll: { tag: 'shell' }
        });
      }
      return '';
    });

    await runCommand(['list', '--tag', 'git']);

    expect(consoleOutput.join(' ')).toContain('gs');
    expect(consoleOutput.join(' ')).toContain('gp');
    expect(consoleOutput.join(' ')).not.toContain('ll');
  });

  it('shows message when no aliases match tag filter', async () => {
    vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
      if (filePath === ALIASES_FILE) {
        return "# Managed\nalias foo='bar'";
      }
      if (filePath === ZSHRC_FILE) {
        return `source ${ALIASES_FILE}`;
      }
      if (filePath === METADATA_FILE) {
        return '{}';
      }
      return '';
    });

    await runCommand(['list', '--tag', 'nonexistent']);

    expect(consoleOutput.join(' ')).toContain('No aliases found with tag');
  });

  it('adds alias with multiple tags', async () => {
    vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
      if (filePath === ALIASES_FILE) {
        return '# Managed\n';
      }
      if (filePath === ZSHRC_FILE) {
        return `source ${ALIASES_FILE}`;
      }
      if (filePath === METADATA_FILE) {
        return '{}';
      }
      return '';
    });

    await runCommand(['add', 'gs', 'git status', '--tag', 'git', '--tag', 'common']);

    expect(consoleOutput.join(' ')).toContain('added successfully');
    expect(consoleOutput.join(' ')).toContain('[git, common]');
  });

  it('filters by tag when alias has multiple tags', async () => {
    vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
      if (filePath === ALIASES_FILE) {
        return "# Managed\nalias gs='git status'\nalias ll='ls -la'";
      }
      if (filePath === ZSHRC_FILE) {
        return `source ${ALIASES_FILE}`;
      }
      if (filePath === METADATA_FILE) {
        return JSON.stringify({
          gs: { tags: ['git', 'common'] },
          ll: { tags: ['shell'] }
        });
      }
      return '';
    });

    await runCommand(['list', '--tag', 'common']);

    expect(consoleOutput.join(' ')).toContain('gs');
    expect(consoleOutput.join(' ')).not.toContain('ll');
  });

  it('handles legacy single tag format', async () => {
    vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
      if (filePath === ALIASES_FILE) {
        return "# Managed\nalias gs='git status'\nalias ll='ls -la'";
      }
      if (filePath === ZSHRC_FILE) {
        return `source ${ALIASES_FILE}`;
      }
      if (filePath === METADATA_FILE) {
        // Legacy format with single 'tag' field
        return JSON.stringify({
          gs: { tag: 'git' },
          ll: { tag: 'shell' }
        });
      }
      return '';
    });

    await runCommand(['list', '--tag', 'git']);

    expect(consoleOutput.join(' ')).toContain('gs');
    expect(consoleOutput.join(' ')).not.toContain('ll');
  });
});

describe('backups command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConsole();
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists available backups', async () => {
    vi.mocked(fs.readdirSync).mockReturnValue([
      'zam-backup-2024-01-01.bak' as unknown as fs.Dirent,
      'zam-backup-2024-01-02.bak' as unknown as fs.Dirent
    ]);
    vi.mocked(fs.statSync).mockReturnValue({
      mtime: new Date('2024-01-01'),
      isFile: () => true,
      isDirectory: () => false,
    } as fs.Stats);
    vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
      if (filePath === ZSHRC_FILE) {
        return `source ${ALIASES_FILE}`;
      }
      return '';
    });

    await runCommand(['backups']);

    expect(consoleOutput.join(' ')).toContain('Available backups');
    expect(consoleOutput.join(' ')).toContain('zam-backup-2024-01-01.bak');
    expect(consoleOutput.join(' ')).toContain('zam-backup-2024-01-02.bak');
  });

  it('shows message when no backups exist', async () => {
    vi.mocked(fs.readdirSync).mockReturnValue([]);
    vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
      if (filePath === ZSHRC_FILE) {
        return `source ${ALIASES_FILE}`;
      }
      return '';
    });

    await runCommand(['backups']);

    expect(consoleOutput.join(' ')).toContain('No backups found');
  });
});
