import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { URI } from 'vscode-uri';
import { Connection } from 'vscode-languageserver';
import { v4 as uuidv4 } from 'uuid';
import { ImagePuller } from '../utils/imagePuller';
import { asyncExec } from '../utils/misc';
import { WorkspaceFolderContext } from './workspaceManager';
import { IContainerEngine } from '../interfaces/extensionSettings';

export class ExecutionEnvironment {
  private connection: Connection;
  private context: WorkspaceFolderContext;
  private _container_engine: IContainerEngine;
  private _container_image: string;
  private _container_image_id: string;

  constructor(connection: Connection, context: WorkspaceFolderContext) {
    this.connection = connection;
    this.context = context;
  }

  public async initialize(): Promise<void> {
    try {
      const settings = await this.context.documentSettings.get(
        this.context.workspaceFolder.uri
      );
      this._container_image = settings.executionEnvironment.image;
      this._container_engine = settings.executionEnvironment.containerEngine;
      if (this._container_engine === 'auto') {
        for (const ce of ['podman', 'docker']) {
          try {
            child_process.execSync(`which ${ce}`, {
              encoding: 'utf-8',
            });
            this._container_engine = <IContainerEngine>ce;
            this.connection.console.log(`Container engine set to: '${ce}'`);
            break;
          } catch (error) {
            this.connection.console.info(`Container engine '${ce}' not found`);
          }
        }
      } else {
        try {
          child_process.execSync(`which ${this._container_engine}`, {
            encoding: 'utf-8',
          });
        } catch (error) {
          this.connection.window.showErrorMessage(
            `Container engine '${this._container_engine}' not found. Failed with error '${error}'`
          );
          return;
        }
      }
      if (!['podman', 'docker'].includes(this._container_engine)) {
        this.connection.window.showInformationMessage(
          'No valid container engine found.'
        );
        return;
      }
      const imagePuller = new ImagePuller(
        this.connection,
        this.context,
        this._container_engine,
        this._container_image,
        settings.executionEnvironment.pullPolicy
      );
      const setupDone = await imagePuller.setupImage();
      if (!setupDone) {
        this.connection.window.showErrorMessage(
          `Execution environment image '${this._container_image}' setup failed.
           For more details check output console logs for ansible-language-server`
        );
        return;
      }
      this.fetchPluginDocs();
    } catch (error) {
      if (error instanceof Error) {
        this.connection.window.showErrorMessage(error.message);
      } else {
        this.connection.console.error(
          `Exception in ExecutionEnvironment service: ${JSON.stringify(error)}`
        );
      }
    }
  }

  async fetchPluginDocs(): Promise<void> {
    const ansibleConfig = await this.context.ansibleConfig;
    const containerName = `${this._container_image.replace(
      /[^a-z0-9]/gi,
      '_'
    )}`;

    try {
      const containerImageIdCommand = `${this._container_engine} images ${this._container_image} --format="{{.ID}}" | head -n 1`;
      this.connection.console.log(containerImageIdCommand);
      this._container_image_id = child_process
        .execSync(containerImageIdCommand, {
          encoding: 'utf-8',
        })
        .trim();
      const hostCacheBasePath = path.resolve(
        `${process.env.HOME}/.cache/ansible-language-server/${containerName}/${this._container_image_id}`
      );

      const isContainerRunning = this.runContainer(containerName);
      if (!isContainerRunning) {
        return;
      }

      if (fs.existsSync(hostCacheBasePath)) {
        ansibleConfig.collections_paths = this.updateCachePaths(
          ansibleConfig.collections_paths,
          hostCacheBasePath
        );
        ansibleConfig.module_locations = this.updateCachePaths(
          ansibleConfig.module_locations,
          hostCacheBasePath
        );
      } else {
        ansibleConfig.collections_paths = await this.copyPluginDocFiles(
          hostCacheBasePath,
          containerName,
          ansibleConfig.collections_paths,
          '**/ansible_collections'
        );

        const builtin_plugin_locations: string[] = [];
        ansibleConfig.module_locations.forEach((modulePath) => {
          const pluginsPathParts = modulePath.split(path.sep).slice(0, -1);
          if (pluginsPathParts.includes('site-packages')) {
            // ansible-config returns default builtin configured module path
            // as ``<python-path>/site-packages/ansible/modules`` to copy other plugins
            // to local cache strip the ``modules`` part from the path and append
            // ``plugins`` folder.
            pluginsPathParts.push('plugins');
          }
          builtin_plugin_locations.push(pluginsPathParts.join(path.sep));
        });
        // Copy builtin plugins
        await this.copyPluginDocFiles(
          hostCacheBasePath,
          containerName,
          builtin_plugin_locations,
          '*'
        );

        // Copy builtin modules
        ansibleConfig.module_locations = await this.copyPluginDocFiles(
          hostCacheBasePath,
          containerName,
          ansibleConfig.module_locations,
          '**/modules'
        );
      }
    } catch (error) {
      this.connection.window.showErrorMessage(
        `Exception in ExecutionEnvironment service while fetching docs: ${JSON.stringify(
          error
        )}`
      );
    } finally {
      this.cleanUpContainer(containerName);
    }
  }

  public wrapContainerArgs(command: string): string {
    const workspaceFolderPath = URI.parse(
      this.context.workspaceFolder.uri
    ).path;
    const containerCommand: Array<string> = [this._container_engine];
    containerCommand.push(...['run', '--rm']);
    containerCommand.push(...['--workdir', workspaceFolderPath]);

    containerCommand.push(
      ...['-v', `${workspaceFolderPath}:${workspaceFolderPath}`]
    );
    if (this._container_engine === 'podman') {
      // container namespace stuff
      containerCommand.push('--group-add=root');
      containerCommand.push('--ipc=host');

      // docker does not support this option
      containerCommand.push('--quiet');
    } else {
      containerCommand.push(`--user=${process.getuid()}`);
    }
    containerCommand.push(`--name ansible_language_server_${uuidv4()}`);
    containerCommand.push(this._container_image);
    containerCommand.push(command);
    const generatedCommand = containerCommand.join(' ');
    this.connection.console.log(
      `container engine invocation: ${generatedCommand}`
    );
    return generatedCommand;
  }

  public cleanUpContainer(containerName: string): void {
    [
      `${this._container_engine} stop ${containerName}`,
      `${this._container_engine} rm ${containerName}`,
    ].forEach((command) => {
      try {
        child_process.execSync(command, {
          cwd: URI.parse(this.context.workspaceFolder.uri).path,
        });
      } catch (error) {
        this.connection.console.log(
          `cleanup command '${command}' failed with error '${error}'`
        );
      }
    });
  }

  private isPluginInPath(
    containerName: string,
    searchPath: string,
    pluginFolderPath: string
  ): boolean {
    const command = `${this._container_engine} exec ${containerName} find ${searchPath} -path '${pluginFolderPath}'`;
    try {
      this.connection.console.info(`Executing command ${command}`);
      const result = child_process
        .execSync(command, {
          encoding: 'utf-8',
        })
        .trim();
      return result !== '';
    } catch (error) {
      this.connection.console.error(error);
      return false;
    }
  }

  private runContainer(containerName: string): boolean {
    // ensure container is not running
    this.cleanUpContainer(containerName);
    try {
      const command = `${this._container_engine} run --rm -it -d --name ${containerName} ${this._container_image} bash`;
      this.connection.console.log(`run container with command '${command}'`);
      child_process.execSync(command, {
        encoding: 'utf-8',
      });
    } catch (error) {
      this.connection.window.showErrorMessage(
        `Failed to initialize execution environment '${this._container_image}': ${error}`
      );
      return false;
    }
    return true;
  }

  private async copyPluginDocFiles(
    hostPluginDocCacheBasePath: string,
    containerName: string,
    containerPluginPaths: string[],
    searchKind: string
  ): Promise<string[]> {
    const updatedHostDocPath: string[] = [];
    if (fs.existsSync(hostPluginDocCacheBasePath)) {
      containerPluginPaths.forEach((srcPath) => {
        updatedHostDocPath.push(path.join(hostPluginDocCacheBasePath, srcPath));
      });
    } else {
      containerPluginPaths.forEach((srcPath) => {
        if (
          srcPath === '' ||
          !this.isPluginInPath(containerName, srcPath, searchKind)
        ) {
          return;
        }
        const destPath = path.join(hostPluginDocCacheBasePath, srcPath);
        const destPathFolder = destPath
          .split(path.sep)
          .slice(0, -1)
          .join(path.sep);
        fs.mkdirSync(destPath, { recursive: true });
        const copyCommand = `docker cp ${containerName}:${srcPath} ${destPathFolder}`;
        this.connection.console.log(
          `Copying plugins from container to local cache path ${copyCommand}`
        );
        asyncExec(copyCommand, {
          encoding: 'utf-8',
        });

        updatedHostDocPath.push(destPath);
      });
    }

    return updatedHostDocPath;
  }

  private updateCachePaths(
    pluginPaths: string[],
    cacheBasePath: string
  ): string[] {
    const localCachePaths: string[] = [];
    pluginPaths.forEach((srcPath) => {
      const destPath = path.join(cacheBasePath, srcPath);
      if (fs.existsSync(destPath)) {
        localCachePaths.push(destPath);
      }
    });
    return localCachePaths;
  }
}
