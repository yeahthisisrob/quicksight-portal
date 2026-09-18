import { execFile } from 'node:child_process';

import { logger } from '../../../../shared/utils/logger';
import {
  extractJsonObject,
  type PlannerModel,
  type StructuredRequest,
  type StructuredResult,
} from './PlannerModel';

/** Runs a command with the prompt on stdin and resolves with its stdout. */
export type CommandRunner = (
  command: string,
  args: string[],
  stdin: string,
  timeoutMs: number
) => Promise<string>;

export interface CliSpec {
  provider: 'claude-cli' | 'codex-cli';
  command: string;
  args: string[];
  /** Some CLIs wrap the answer; this digs the model's text out of stdout. */
  unwrap: (stdout: string) => string;
}

/** 8 MiB - a plan answer is a few KB; this is headroom for chatty CLIs. */
const MAX_BUFFER_BYTES = 8_388_608;

export const CLI_SPECS: Record<CliSpec['provider'], CliSpec> = {
  'claude-cli': {
    provider: 'claude-cli',
    command: 'claude',
    // -p: non-interactive; the JSON envelope carries the answer in `result`.
    args: ['-p', '--output-format', 'json'],
    unwrap: (stdout) => {
      try {
        const envelope = JSON.parse(stdout) as { result?: unknown };
        if (typeof envelope.result === 'string') {
          return envelope.result;
        }
      } catch {
        // Not the envelope; treat stdout as the answer itself.
      }
      return stdout;
    },
  },
  'codex-cli': {
    provider: 'codex-cli',
    command: 'codex',
    // exec: non-interactive; "-" reads the prompt from stdin; last message on stdout.
    args: ['exec', '--skip-git-repo-check', '-'],
    unwrap: (stdout) => stdout,
  },
};

export const defaultCommandRunner: CommandRunner = (command, args, stdin, timeoutMs) =>
  new Promise((resolve, reject) => {
    const child = execFile(
      command,
      args,
      { timeout: timeoutMs, maxBuffer: MAX_BUFFER_BYTES, env: process.env },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`${command} failed: ${error.message}${stderr ? `\n${stderr}` : ''}`));
          return;
        }
        resolve(stdout);
      }
    );
    child.stdin?.end(stdin);
  });

/**
 * Local-development provider: shells out to a logged-in `claude` or `codex`
 * on the developer's machine, so the planner runs with no cloud credentials
 * at all. The schema travels in the prompt, since a CLI has no tool-choice
 * parameter; the answer is validated by the caller exactly as any other
 * provider's is.
 */
export class CliPlannerModel implements PlannerModel {
  public readonly provider: string;

  public constructor(
    private readonly spec: CliSpec,
    private readonly timeoutMs: number,
    private readonly run: CommandRunner = defaultCommandRunner
  ) {
    this.provider = spec.provider;
  }

  public async complete(request: StructuredRequest): Promise<StructuredResult> {
    const prompt = [
      request.system,
      '',
      request.user,
      '',
      `Respond with ONLY a JSON object (no prose, no code fence) that validates against this JSON Schema, named ${request.schemaName}:`,
      JSON.stringify(request.schema),
    ].join('\n');

    logger.info('Planner CLI call', { provider: this.provider, label: request.label });
    const stdout = await this.run(this.spec.command, this.spec.args, prompt, this.timeoutMs);
    return {
      output: extractJsonObject(this.spec.unwrap(stdout)),
      provider: this.provider,
      model: this.spec.command,
    };
  }
}
