import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { URI } from 'vscode-uri';
import { Connection } from 'vscode-languageserver';
import { v4 as uuidv4 } from 'uuid';
import { asyncExec } from '../utils/misc';
import { WorkspaceFolderContext } from './workspaceManager';
import { IContianerEngine } from '../interfaces/extensionSettings';


export class ExecutionEnvironment {
    private connection: Connection;
    private context: WorkspaceFolderContext;
    private _container_engine: IContianerEngine;
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
        this._container_image = settings.executionEnvironment.image
        this._container_engine = settings.executionEnvironment.containerEngine
        if (this._container_engine === 'auto') {       
          for (const ce of ['podman', 'docker']) {
              try {
                child_process.execSync(`which ${ce}`, {
                  encoding: 'utf-8'
                })
                this._container_engine = <IContianerEngine>ce;
                this.connection.console.log(`Container engine set to: '${ce}'`)
                break
              } catch (error) {
                this.connection.console.error(`Container engine '${ce}' not found`)
              }
            }
        } else {
          try {
            child_process.execSync(`which ${this._container_engine}`, {
              encoding: 'utf-8'
            })            
          } catch (error) {
            this.connection.window.showErrorMessage(`Container engine '${this._container_engine}' not found. Failed with error '${error}'`)
            return
          }
        }
        if (!['podman', 'docker'].includes(this._container_engine)) {
          this.connection.window.showInformationMessage(`Valid contianer engine not found ${this._container_engine}.`)
          return
        }
        const imagePuller = new ImagePuller(
          this.connection,
          this._container_engine,
          this._container_image,
          settings.executionEnvironment.pullPolicy
        )
        const setupDone = await imagePuller.setupImage()
        if (!setupDone) {
          this.connection.window.showWarningMessage(`Execution environment image ${this._container_image} setup failed.`)
          return
        }
        this.fetchPluginDocs()
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
      const containerName = `${this._container_image.replace(/[^a-z0-9]/ig, '_')}`
      
      try {
        const containerImageIdCommand = `${this._container_engine} images ${this._container_image} --format="{{.ID}}" | head -n 1`
        this.connection.console.log(containerImageIdCommand)
        this._container_image_id = child_process.execSync(containerImageIdCommand, {
          encoding: 'utf-8'
        }).trim();
        const hostCacheBasePath = path.resolve(`${process.env.HOME}/.cache/ansible-language-server/${containerName}/${this._container_image_id}`)

        if (!this.runContainer(containerName)) {
          return
        }
        
        if (fs.existsSync(hostCacheBasePath)) {
          ansibleConfig.collections_paths = this.updateCachePaths(ansibleConfig.collections_paths, hostCacheBasePath)
          ansibleConfig.module_locations = this.updateCachePaths(ansibleConfig.module_locations, hostCacheBasePath)
        } else {
          ansibleConfig.collections_paths = await this.copyPluginDocFiles(hostCacheBasePath,
                                  containerName,
                                  ansibleConfig.collections_paths,
                                  '**/ansible_collections')

          const builtin_plugin_locations: string[] = []
          ansibleConfig.module_locations.forEach(modulePath => {
            const pluginsPathParts = modulePath.split(path.sep).slice(0, -1)
            if (modulePath.includes(`${path.sep}site-packages${path.sep}`)) {
              pluginsPathParts.push('plugins')
            }
            builtin_plugin_locations.push(pluginsPathParts.join(path.sep))
          })
          // Copy builtin plugins
          await this.copyPluginDocFiles(hostCacheBasePath,
            containerName,
            builtin_plugin_locations,
            '*')

          // Copy builtin modules
          ansibleConfig.module_locations = await this.copyPluginDocFiles(hostCacheBasePath,
            containerName,
            ansibleConfig.module_locations,
            '**/modules')
        }
      } catch(error) {
        this.connection.window.showErrorMessage(
          `Exception in ExecutionEnvironment service while fetching docs: ${JSON.stringify(error)}`
        )
      } finally {
        this.cleanUpContainer(containerName)
      }
    }
    
    public wrapContainerArgs(command: string): string {
      const workspaceFolderPath = URI.parse(this.context.workspaceFolder.uri).path
      const containerCommand: Array<string> = [this._container_engine]
      containerCommand.push(...['run', '--rm', '--interactive'])
      containerCommand.push(...['--workdir', workspaceFolderPath])

      containerCommand.push(...['-v', `${workspaceFolderPath}:${workspaceFolderPath}`])
      if (this._container_engine === 'podman') {
        // container namespace stuff
        containerCommand.push('--group-add=root')
        containerCommand.push('--ipc=host')

        // docker does not support this option
        containerCommand.push('--quiet')
      } else {
        containerCommand.push(`--user=${process.getuid()}`)
      }
      containerCommand.push(`--name ansible_language_server_${uuidv4()}`)
      containerCommand.push(this._container_image)
      containerCommand.push(command)
      const generatedCommand = containerCommand.join(' ')
      this.connection.console.log(`container engine invocation: ${generatedCommand}`)
      return generatedCommand
    }

    public cleanUpContainer(containerName: string): void {
      [`${this._container_engine} stop ${containerName}`, `${this._container_engine} rm ${containerName}`].forEach((command) => {
        try {
          child_process.execSync(command, {
            cwd: URI.parse(this.context.workspaceFolder.uri).path,
          });
        } catch(error) {
          this.connection.console.log(`cleanup command '${command}' failed with error '${error}'`)
        }
      })
    }

    private isPluginInPath(containerName: string, searchPath: string, pluginFolderPath: string): boolean {
      //const command = this.wrapContainerArgs(`find ${searchPath} -path '${pluginFolderPath}'`)
      const command = `${this._container_engine} exec -i ${containerName} find ${searchPath} -path '${pluginFolderPath}'`
      try {
        this.connection.console.info(`Executing command ${command}`)
        const result = child_process.execSync(command, {
          encoding: 'utf-8',
        }).trim();
        return result !== ''

      } catch (error) {
        this.connection.console.error(error)
        return false
      }
    }

    private runContainer(containerName: string): boolean {
      // ensure container is not running
      this.cleanUpContainer(containerName)
      try {
        const command = `${this._container_engine} run --rm -it -d --name ${containerName} ${this._container_image} bash`
        this.connection.console.log(`run container with command '${command}'`)
        child_process.execSync(command, {
          encoding: 'utf-8'
        });
      } catch (error) {
        this.connection.console.error(`Failed to initialize execution environment '${this._container_image}': ${error}`)
        return false
      }
      return true
    }

    private async copyPluginDocFiles(
      hostPluginDocCacheBasePath: string,
      containerName: string,
      contianerPluginPaths: string[],
      searchKind: string
      ): Promise<string[]> {
      
      const updatedHostDocPath: string[] = []
      if (fs.existsSync(hostPluginDocCacheBasePath)) {
        contianerPluginPaths.forEach((srcPath) => {
          updatedHostDocPath.push(path.join(hostPluginDocCacheBasePath, srcPath))
        })
      } else {
        contianerPluginPaths.forEach((srcPath) => {
          if (srcPath === '' || !this.isPluginInPath(containerName, srcPath, searchKind)) { return }
          const destPath = path.join(hostPluginDocCacheBasePath, srcPath)
          const destPathFolder = destPath.split(path.sep).slice(0, -1).join(path.sep)
          fs.mkdirSync(destPath, { recursive: true });
          const copyCommand = `docker cp ${containerName}:${srcPath} ${destPathFolder}`
          this.connection.console.log(`Copying plugins from container to local cache path ${copyCommand}`)
          asyncExec(copyCommand, {
            encoding: 'utf-8'
          });

          updatedHostDocPath.push(destPath)
        })
      }

      return updatedHostDocPath
    }

    private updateCachePaths(pluginPaths:string[], cacheBasePath:string): string[] {
      const localCachePaths: string[] = []
      pluginPaths.forEach((srcPath) => {
        const destPath = path.join(cacheBasePath, srcPath)
        if (fs.existsSync(destPath)) {
          localCachePaths.push(destPath)
        }
      })
      return localCachePaths
    }
}

export class ImagePuller {
  private connection: Connection;
  private _containerEngine: string;
  private _containerImage: string;
  private _pullPolicy: string;

  constructor(connection: Connection, containerEngine: string, containerImage: string, pullPolicy: string) {
    this.connection = connection
    this._containerEngine = containerEngine;
    this._containerImage = containerImage;
    this._pullPolicy = pullPolicy
  }

  public async setupImage(): Promise<boolean> {
    let setupComplete = false
    const imageTag = this._containerImage.split(':', 2)[1] || 'latest'
    const imagePresent = this.checkForImage()
    const pullRequired = this.determinePull(imagePresent, imageTag)
    if (pullRequired) {
      this.connection.window.showInformationMessage(`Pulling image '${this._containerImage}' with pull-policy '${this._pullPolicy}' and image-tag '${imageTag}'`)
      try {
        const pullCommand = `${this._containerEngine} pull ${this._containerImage}`
        child_process.execSync(pullCommand, {
          encoding: 'utf-8'
        });
        this.connection.window.showInformationMessage(`Container image '${this._containerImage}' pull successful`)
        setupComplete = true
      } catch (error) {
        let errorMsg = `Failed to pull container image ${this._containerEngine} with error '${error}'`
        errorMsg += 'Check the execution environment image name, connectivity to and permissions for the registry, and try again'
        this.connection.window.showErrorMessage(errorMsg)
        setupComplete = false
      }
    } else {
      setupComplete = true
    }
    return setupComplete
  }

  private determinePull(imagePresent: boolean, imageTag: string): boolean {
    let pull: boolean
    if (this._pullPolicy === 'missing' && !imagePresent) {
      pull = true
    } else if (this._pullPolicy === 'always') {
      pull = true
    } else if (this._pullPolicy === 'tag' && imageTag === 'latest') {
      pull = true
    } else if (this._pullPolicy === 'tag' && !imagePresent) {
      pull = true
    } else {
      pull = false
    }
    return pull
  }

  private checkForImage(): boolean {
    try {
      const command = `${this._containerEngine} image inspect ${this._containerImage}`
      this.connection.console.log(`check for container image with command: '${command}'`)
      child_process.execSync(command, {
        encoding: 'utf-8'
      });
      return true
    } catch (error) {
      this.connection.window.showErrorMessage(`'${this._containerImage}' image inspection failed, image assumed to be corrupted or missing`)
      return false
    }
  }
}
