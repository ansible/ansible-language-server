import { Connection } from "vscode-languageserver";
import { WorkspaceFolderContext } from "./workspaceManager";
import { CommandRunner } from "../utils/commandRunner";

// Todo:
// 1. file watcher for change in inventory file
// 2. priority
// 3. ansible_host keyword
// 4. support with ee
// 5. run ansible-inventory every time (no lazy loading)

/**
 * Class to extend ansible-inventory executable as a service
 */
export class AnsibleInventory {
  private connection: Connection;
  private context: WorkspaceFolderContext;
  private _hostList: string[] = [];

  constructor(connection: Connection, context: WorkspaceFolderContext) {
    this.connection = connection;
    this.context = context;
  }

  public async initialize() {
    try {
      const settings = await this.context.documentSettings.get(
        this.context.workspaceFolder.uri
      );

      const commandRunner = new CommandRunner(
        this.connection,
        this.context,
        settings
      );

      // Get inventory hosts
      const ansibleInventoryResult = await commandRunner.runCommand(
        "ansible-inventory",
        "--list"
      );

      const inventoryHostsObject = JSON.parse(ansibleInventoryResult.stdout);
      console.log("host object -> ", inventoryHostsObject);
      this._hostList = parseInventoryHosts(inventoryHostsObject);
    } catch (error) {
      console.log("Error from ansibleInventory service", error);
    }
  }

  get hostList(): string[] {
    return this._hostList;
  }
}

// Add jsdoc after finalizing the return type of the function
function parseInventoryHosts(hostObj) {
  const topLevelGroups = hostObj.all.children.filter(
    (item: string) => item !== "ungrouped"
  );

  // console.log("top level groups -> ", topLevelGroups);

  const groupsHavingChildren = topLevelGroups.filter(
    (item) => hostObj[`${item}`].children
  );
  // console.log("groups having children -> ", groupsHavingChildren);

  const otherGroups = [];
  groupRecursive(groupsHavingChildren);

  // console.log("other groups -> ", otherGroups);

  const allGroups = [
    ...topLevelGroups,
    ...groupsHavingChildren,
    ...otherGroups,
  ];

  let allHosts = [...hostObj.ungrouped.hosts];

  for (const group of allGroups) {
    if (hostObj[`${group}`].hosts) {
      allHosts = [...allHosts, ...hostObj[`${group}`].hosts];
    }
  }

  // console.log("all hosts -> ", allHosts);

  function groupRecursive(groupList) {
    for (const host of groupList) {
      if (hostObj[`${host}`].children) {
        groupRecursive(hostObj[`${host}`].children);
      } else {
        otherGroups.push(host);
      }
    }
  }

  return [...allGroups, ...allHosts];
}
