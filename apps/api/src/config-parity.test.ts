import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

/**
 * The development database is provisioned two ways — Docker in CI, a portable binary locally
 * (there is no Docker on the development machine) — and the two must describe the same server.
 * `sql_mode` is the setting that matters: without `STRICT_TRANS_TABLES` MySQL silently
 * truncates instead of rejecting, so a bug that fails in production passes locally, and
 * `ONLY_FULL_GROUP_BY` decides whether a grouped query is legal at all.
 *
 * CLAUDE.md records that these must stay in step. This test is what makes that true rather
 * than aspirational. A third copy is generated into `.services/my.ini` from the script below,
 * so checking the script covers it.
 */

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, `file://${repoRoot}`), 'utf8');
}

/** Order is not meaningful to MySQL, so compare as sets. */
function normalise(mode: string): string[] {
  return mode
    .split(',')
    .map((flag) => flag.trim())
    .filter(Boolean)
    .sort();
}

interface ComposeFile {
  services: {
    mysql: { image: string; ports: string[]; command: string[] };
    mailpit: { ports: string[] };
  };
}

const compose = parseYaml(read('docker/docker-compose.dev.yml')) as ComposeFile;
const devSetup = read('scripts/dev-setup.ps1');

describe('docker-compose.dev.yml and dev-setup.ps1 describe the same services', () => {
  it('agrees on sql_mode', () => {
    const fromCompose = compose.services.mysql.command.find((arg) => arg.startsWith('--sql-mode='));
    expect(fromCompose, 'compose sets no --sql-mode').toBeDefined();

    const fromScript = /^sql-mode=(.+)$/m.exec(devSetup)?.[1];
    expect(fromScript, 'dev-setup.ps1 writes no sql-mode into my.ini').toBeDefined();

    expect(normalise(fromScript!)).toEqual(normalise(fromCompose!.replace('--sql-mode=', '')));
  });

  it('sets the two modes that change query semantics', () => {
    const mode = compose.services.mysql.command.find((arg) => arg.startsWith('--sql-mode=')) ?? '';
    expect(mode).toContain('STRICT_TRANS_TABLES');
    expect(mode).toContain('ONLY_FULL_GROUP_BY');
  });

  it('agrees on the MySQL port, and it is neither XAMPP nor silkgrain', () => {
    const composePort = compose.services.mysql.ports[0]?.split(':')[0];
    const scriptPort = /mysql = (\d+);/.exec(devSetup)?.[1];

    expect(composePort).toBe('3308');
    expect(scriptPort).toBe('3308');
    // 3306 is XAMPP's MariaDB, 3307 is the silkgrain project. Neither is ours.
    expect(['3306', '3307']).not.toContain(composePort);
  });

  it('agrees on the Mailpit ports', () => {
    const [smtp, ui] = compose.services.mailpit.ports.map((mapping) => mapping.split(':')[0]);
    expect(smtp).toBe('1026');
    expect(ui).toBe('8026');
    expect(devSetup).toContain('mailpit = 1026');
    expect(devSetup).toContain('$MailpitUiPort = 8026');
  });

  it('pins MySQL to the same 8.0.x in both places', () => {
    const composeVersion = /mysql:(\d+\.\d+\.\d+)/.exec(compose.services.mysql.image)?.[1];
    const scriptVersion = /\$MysqlVersion = '([\d.]+)'/.exec(devSetup)?.[1];
    expect(composeVersion).toBe(scriptVersion);
  });
});

describe('the front-end ports agree with what the API is told to allow', () => {
  const APPS = ['web-choice', 'web-global', 'web-umrah', 'admin'] as const;
  const envExample = read('.env.example');

  /** Ports silkgrain and XAMPP own on this machine. Charva must never pick one. */
  const TAKEN = ['3001', '5173', '5174', '4173', '1025', '8025', '3306', '3307'];

  const devPorts = APPS.map((app) => {
    const config = read(`apps/${app}/vite.config.ts`);
    return {
      app,
      dev: /server: \{ port: (\d+)/.exec(config)?.[1],
      preview: /preview: \{ port: (\d+)/.exec(config)?.[1],
      proxy: /target: 'http:\/\/127\.0\.0\.1:(\d+)'/.exec(config)?.[1],
    };
  });

  it('lists every dev server in CORS_ORIGINS', () => {
    const allowed = /^CORS_ORIGINS=(.+)$/m.exec(envExample)?.[1] ?? '';
    for (const { app, dev } of devPorts) {
      expect(dev, `${app} declares no dev port`).toBeDefined();
      expect(allowed, `${app} on ${dev!} is missing from CORS_ORIGINS`).toContain(
        `http://localhost:${dev!}`,
      );
    }
  });

  it('proxies to the port the API actually listens on', () => {
    const apiPort = /^API_PORT=(\d+)$/m.exec(envExample)?.[1];
    expect(apiPort).toBe('3002');
    for (const { app, proxy } of devPorts) {
      expect(proxy, `${app} proxies to ${proxy ?? 'nothing'} but the API is on ${apiPort!}`).toBe(
        apiPort,
      );
    }
  });

  it('picks no port another project on this machine already owns', () => {
    const apiPort = /^API_PORT=(\d+)$/m.exec(envExample)?.[1];
    const ours = [apiPort, ...devPorts.flatMap(({ dev, preview }) => [dev, preview])];
    for (const port of ours) {
      expect(TAKEN, `port ${port ?? '?'} belongs to silkgrain or XAMPP`).not.toContain(port);
    }
  });

  it('gives every app a distinct pair of ports', () => {
    const all = devPorts.flatMap(({ dev, preview }) => [dev, preview]);
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('dev-setup.ps1 stays readable by Windows PowerShell 5.1', () => {
  it('contains no byte above 127', () => {
    // PowerShell 5.1 reads BOM-less files as ANSI, so a UTF-8 dash becomes bytes it parses as
    // a string delimiter and the script fails with syntax errors pointing at unrelated lines.
    const bytes = readFileSync(new URL('scripts/dev-setup.ps1', `file://${repoRoot}`));
    const offending = [...bytes].filter((byte) => byte > 127);
    expect(offending).toHaveLength(0);
  });
});
