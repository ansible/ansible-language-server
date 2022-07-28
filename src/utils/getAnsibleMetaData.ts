import { Connection } from "vscode-languageserver";
import { URI } from "vscode-uri";
import { WorkspaceFolderContext } from "../services/workspaceManager";
import { CommandRunner } from "./commandRunner";

let context: WorkspaceFolderContext;
let connection: Connection;

export async function getAnsibleMetaData(
  contextLocal: WorkspaceFolderContext,
  connectionLocal: Connection
) {
  context = contextLocal;
  connection = connectionLocal;

  const ansibleMetaData = {};

  ansibleMetaData["ansible information"] = await getAnsibleInfo();
  ansibleMetaData["python information"] = await getPythonInfo();
  ansibleMetaData["ansible-lint information"] = await getAnsibleLintInfo();

  // console.log("*** ansible metadata -> ", ansibleMetaData);
  return ansibleMetaData;
}

async function getResultsThroughCommandRunner(cmd, arg) {
  const settings = await context.documentSettings.get(
    context.workspaceFolder.uri
  );
  const commandRunner = new CommandRunner(connection, context, settings);
  const workingDirectory = URI.parse(context.workspaceFolder.uri).path;
  const mountPaths = new Set([workingDirectory]);

  let result;
  try {
    result = await commandRunner.runCommand(
      cmd,
      arg,
      workingDirectory,
      mountPaths
    );

    if (result.stderr) {
      console.log(
        `cmd '${cmd} ${arg} have the following error: ' ${result.stderr}`
      );
      return undefined;
    }
  } catch (error) {
    console.log(
      `cmd '${cmd} ${arg} have the following error: ' ${error.toString()}`
    );
    return undefined;
  }

  return result;
}

async function getAnsibleInfo() {
  const ansibleInfo = {};

  const ansibleVersionObj = (await context.ansibleConfig).ansible_meta_data;
  const ansibleVersionObjKeys = Object.keys(ansibleVersionObj);

  // return empty if ansible --version fails to execute
  if (ansibleVersionObjKeys.length === 0) {
    return ansibleInfo;
  }

  const ansibleVersion = ansibleVersionObjKeys[0].split(" [");
  ansibleInfo["ansible version"] = ansibleVersion[1].slice(0, -1);

  ansibleInfo["ansible location"] = (
    await context.ansibleConfig
  ).ansible_location;

  ansibleInfo["config file path"] = [ansibleVersionObj["config file"]];

  ansibleInfo["ansible collections location"] = (
    await context.ansibleConfig
  ).collections_paths;

  ansibleInfo["ansible module location"] = (
    await context.ansibleConfig
  ).module_locations;

  ansibleInfo["ansible default host list path"] = (
    await context.ansibleConfig
  ).default_host_list;

  // console.log("*** ansible info -> ", ansibleInfo);
  return ansibleInfo;
}

async function getPythonInfo() {
  const pythonInfo = {};

  const pythonVersionResult = await getResultsThroughCommandRunner(
    "python",
    "--version"
  );
  if (pythonVersionResult === undefined) {
    return pythonInfo;
  }

  pythonInfo["python version"] = pythonVersionResult.stdout.trim();

  const pythonPathResult = await getResultsThroughCommandRunner(
    "python",
    '-c "import sys; print(sys.executable)"'
  );
  pythonInfo["python location"] = pythonPathResult.stdout.trim();

  // console.log("*** python info -> ", pythonInfo);
  return pythonInfo;
}

async function getAnsibleLintInfo() {
  const ansibleLintInfo = {};

  const ansibleLintVersionResult = await getResultsThroughCommandRunner(
    "ansible-lint",
    "--version"
  );

  if (ansibleLintVersionResult === undefined) {
    return ansibleLintInfo;
  }

  ansibleLintInfo["ansible-lint version"] =
    ansibleLintVersionResult.stdout.trim();

  // console.log("*** ansible-lint info -> ", ansibleLintInfo);
  return ansibleLintInfo;
}
