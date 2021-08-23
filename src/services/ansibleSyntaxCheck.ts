import * as child_process from 'child_process';
import { ExecException } from 'child_process';
import { URL } from 'url';
import { promisify } from 'util';
import {
  Connection,
  Diagnostic,
  DiagnosticSeverity,
  DidChangeWatchedFilesParams,
  Position,
  Range,
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { IAnsibleLintConfig } from '../interfaces/ansibleLintConfig';
import { withInterpreter } from '../utils/misc';
import { WorkspaceFolderContext } from './workspaceManager';
const exec = promisify(child_process.exec);

/**
 * Acts as and interface to ansible syntax check and a cache of its output.
 *
 * ansible syntax-check may provide diagnostics for more than just the file for which
 * linting was triggered, and this is reflected in the implementation.
 */
export class AnsibleSyntaxCheck {
  private connection: Connection;
  private context: WorkspaceFolderContext;
  private useProgressTracker = false;

  private configCache: Map<string, IAnsibleLintConfig> = new Map();

  constructor(connection: Connection, context: WorkspaceFolderContext) {
    this.connection = connection;
    this.context = context;
    this.useProgressTracker =
      !!context.clientCapabilities.window?.workDoneProgress;
  }

  /**
   * Perform ansible syntax-check for the given document.
   *
   * In case no errors are found for the current document, and linting has been
   * performed on opening the document, then only the cache is cleared, and not
   * the diagnostics on the client side. That way old diagnostics will persist
   * until the file is changed. This allows inspecting more complex errors
   * reported in other files.
   */
  public async doValidate(
    textDocument: TextDocument
  ): Promise<Map<string, Diagnostic[]>> {
    const docPath = new URL(textDocument.uri).pathname;
    let diagnostics: Map<string, Diagnostic[]> = new Map();
    let progressTracker;
    if (this.useProgressTracker) {
      progressTracker = await this.connection.window.createWorkDoneProgress();
    }

    const workingDirectory = new URL(this.context.workspaceFolder.uri).pathname;

    try {
      const settings = await this.context.documentSettings.get(
        textDocument.uri
      );

      if (progressTracker) {
        progressTracker.begin(
          'ansible syntex-check',
          undefined,
          'Processing files...'
        );
      }

      const [command, env] = withInterpreter(
        settings.ansiblePlaybook.path,
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
        const execError = error as ExecException & {
          // according to the docs, these are always available
          stdout: string;
          stderr: string;
        };

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

    if (progressTracker) {
      progressTracker.done();
    }
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
      // console.debug(error);
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

  public handleWatchedDocumentChange(
    params: DidChangeWatchedFilesParams
  ): void {
    for (const fileEvent of params.changes) {
      // remove from cache on any change
      this.configCache.delete(fileEvent.uri);
    }
  }
}