import * as child_process from 'child_process';
import * as ini from 'ini';
import * as _ from 'lodash';
import * as path from 'path';
import { URL } from 'url';
import { Connection } from 'vscode-languageserver';
import { withInterpreter, asyncExec } from './misc';
import { WorkspaceFolderContext } from '../services/workspaceManager';
import { ExtensionSettings } from '../interfaces/extensionSettings';

export class CommandRunner {
    private connection: Connection;
    private context: WorkspaceFolderContext;
    private settings: ExtensionSettings;
  
    constructor(connection: Connection, context: WorkspaceFolderContext, settings: ExtensionSettings) {
      this.connection = connection;
      this.context = context;
      this.settings = settings;
    }
    
    public async runCommand(
      executable: string,
      args: string, 
      workingDirectory?: string
      ): Promise<{
        stdout: string,
        stderr: string
      }> {
      let executablePath: string
      let command: string
      let runEnv: NodeJS.ProcessEnv | undefined
      const executionEnvironment = await this.context.executionEnvironment;
      const isEEEnabled = this.settings.executionEnvironment.enabled
      const interpreterPath = isEEEnabled? 'python3': this.settings.python.interpreterPath
      if (executable.startsWith('ansible')) {
        executablePath = isEEEnabled ? executable : path.join(path.dirname(this.settings.ansible.path), executable)
      } else {
        executablePath = executable
      }

      // prepare command and env for local run
      if (!isEEEnabled) {
        [command, runEnv] = withInterpreter(
          executablePath,
          args,
          interpreterPath,
          this.settings.python.activationScript,
        );
      } // prepare command executin env run
      else {
        command = executionEnvironment.wrapContainerArgs(`${executable} ${args}`);
        runEnv = undefined
      }
      
      const currentWorkingDirectory = workingDirectory ? workingDirectory : decodeURI(new URL(this.context.workspaceFolder.uri).pathname)
      const result = await asyncExec(command, {
        encoding: 'utf-8',
        cwd: currentWorkingDirectory,
        env: runEnv,
      });

      return result
    }
  }
  