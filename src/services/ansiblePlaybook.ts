import * as child_process from 'child_process';
import { URL } from 'url';
import { promisify } from 'util';
import {
  Connection,
  Diagnostic,
  DiagnosticSeverity,
  Position,
  Range,
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { withInterpreter } from '../utils/misc';
import { WorkspaceFolderContext } from './workspaceManager';
const exec = promisify(child_process.exec);

/**
 * Acts as an interface to ansible-playbook command.
 */
export class AnsiblePlaybook {
  private useProgressTracker = false;

  constructor(
    private connection: Connection,
    private context: WorkspaceFolderContext
  ) {
    this.useProgressTracker =
      !!context.clientCapabilities.window?.workDoneProgress;
  }

  /**
   * Acts as an interface to ansible-playbook <file> --syntax-check command and a cache of its output.
   * ansible syntax-check may provide diagnostics for more than just the file for which
   * it was triggered, and this is reflected in the implementation.
   *
   * Perform ansible syntax-check for the given document.
   */
  public async doValidate(
    textDocument: TextDocument
  ): Promise<Map<string, Diagnostic[]>> {
    const docPath = new URL(textDocument.uri).pathname;
    let diagnostics: Map<string, Diagnostic[]> = new Map();
    const progressTracker = this.useProgressTracker
      ? await this.connection.window.createWorkDoneProgress()
      : {
          begin: () => {}, // eslint-disable-line @typescript-eslint/no-empty-function
          done: () => {}, // eslint-disable-line @typescript-eslint/no-empty-function
        };

    const workingDirectory = new URL(this.context.workspaceFolder.uri).pathname;

    try {
      const settings = await this.context.documentSettings.get(
        textDocument.uri
      );

      progressTracker.begin(
        'ansible syntax-check',
        undefined,
        'Processing files...'
      );

      const [command, env] = withInterpreter(
        `${settings.ansible.path}-playbook`,
        `${docPath} --syntax-check`,
        settings.python.interpreterPath,
        settings.python.activationScript
      );

      await exec(command, {
        encoding: 'utf-8',
        cwd: workingDirectory,
        env: env,
      });
    } catch (error) {
      if (error instanceof Error) {
        const execError = error as child_process.ExecException & {
          // according to the docs, these are always available
          stdout: string;
          stderr: string;
        };

        // This is the regex to extract the filename, line and column number from the strerr produced by syntax-check command
        const ansibleSyntaxCheckRegex =
          /The error appears to be in '(?<filename>.*)': line (?<line>\d+), column (?<column>\d+)/;

        const result = ansibleSyntaxCheckRegex.exec(execError.stderr);

        diagnostics = result
          ? this.processReport(
              execError.message,
              result.groups.filename,
              parseInt(result.groups.line),
              parseInt(result.groups.column)
            )
          : this.processReport(execError.message, docPath, 1, 1);

        if (execError.stderr) {
          this.connection.console.info(
            `[ansible syntax-check] ${execError.stderr}`
          );
        }
      } else {
        this.connection.console.error(
          `Exception in AnsibleSyntaxCheck service: ${JSON.stringify(error)}`
        );
      }
    }

    progressTracker.done();
    return diagnostics;
  }

  private processReport(
    result: string,
    fileName: string,
    line: number,
    column: number
  ): Map<string, Diagnostic[]> {
    const diagnostics: Map<string, Diagnostic[]> = new Map();
    if (!result) {
      this.connection.console.warn(
        'Standard output from ansible syntax-check is suspiciously empty.'
      );
      return diagnostics;
    }
    try {
      const start: Position = {
        line: line - 1,
        character: column - 1,
      };
      const end: Position = {
        line: line - 1,
        character: Number.MAX_SAFE_INTEGER,
      };
      const range: Range = {
        start: start,
        end: end,
      };

      const severity: DiagnosticSeverity = DiagnosticSeverity.Error;

      const locationUri = `file://${fileName}`;

      let fileDiagnostics = diagnostics.get(locationUri);
      if (!fileDiagnostics) {
        fileDiagnostics = [];
        diagnostics.set(locationUri, fileDiagnostics);
      }

      const message: string = result;
      fileDiagnostics.push({
        message: message,
        range: range || Range.create(0, 0, 0, 0),
        severity: severity,
        source: 'Ansible',
      });
    } catch (error) {
      this.connection.window.showErrorMessage(
        'Could not parse ansible syntax-check output. Please check your ansible installation & configuration.' +
          ' More info in `Ansible Server` output.'
      );
      let message: string;
      if (error instanceof Error) {
        message = error.message;
      } else {
        message = JSON.stringify(error);
      }
      this.connection.console.error(
        `Exception while parsing ansible syntax-check output: ${message}` +
          `\nTried to parse the following:\n${result}`
      );
    }
    return diagnostics;
  }
}
