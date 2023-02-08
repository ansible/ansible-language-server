import { CompletionItem, CompletionItemKind } from "vscode-languageserver";
import { URI } from "vscode-uri";
import { Node, Scalar, YAMLMap, YAMLSeq } from "yaml/types";
import { AncestryBuilder, isPlayParam } from "../utils/yaml";
import * as pathUri from "path";
import { existsSync, readFileSync } from "fs";
import { parseDocument } from "yaml";

/**
 * A function that computes the possible variable auto-completions scope-wise for a given position
 * @param documentUri uri of the document
 * @param path array of nodes leading to that position
 * @returns a list of completion items
 */
export function getVarsCompletion(
  documentUri: string,
  path: Node[],
): CompletionItem[] {
  const varsCompletion = [];
  let varPriority = 0;

  // the loop calculates and traverses till the path reaches the play level from the position where the auto-completion was asked
  while (!isPlayParam(path)) {
    varPriority = varPriority + 1;

    // handle case when it is a dict
    let parentKeyPath = new AncestryBuilder(path)
      .parent(YAMLMap)
      .parent(YAMLMap)
      .getKeyPath();
    if (parentKeyPath) {
      const parentKeyNode = parentKeyPath[parentKeyPath.length - 1];
      if (
        parentKeyNode instanceof Scalar &&
        typeof parentKeyNode.value === "string"
      ) {
        path = parentKeyPath;
        const scopedNode = path[path.length - 3].toJSON();
        if (scopedNode.hasOwnProperty("vars")) {
          const varsObject = scopedNode["vars"];

          if (Array.isArray(varsObject)) {
            varsObject.forEach((element) => {
              Object.keys(element).forEach((key) => {
                varsCompletion.push({ varr: key, priority: varPriority });
              });
            });
          } else {
            Object.keys(varsObject).forEach((key) => {
              varsCompletion.push({ varr: key, priority: varPriority });
            });
          }
        }

        continue;
      }
    }

    // handle case when it is a list
    parentKeyPath = new AncestryBuilder(path)
      .parent(YAMLMap)
      .parent(YAMLSeq)
      .parent(YAMLMap)
      .getKeyPath();
    if (parentKeyPath) {
      const parentKeyNode = parentKeyPath[parentKeyPath.length - 1];
      if (
        parentKeyNode instanceof Scalar &&
        typeof parentKeyNode.value === "string"
      ) {
        path = parentKeyPath;
        const scopedNode = path[path.length - 3].toJSON();
        if (scopedNode.hasOwnProperty("vars")) {
          const varsObject = scopedNode["vars"];

          if (Array.isArray(varsObject)) {
            varsObject.forEach((element) => {
              Object.keys(element).forEach((key) => {
                varsCompletion.push({ varr: key, priority: varPriority });
              });
            });
          } else {
            Object.keys(varsObject).forEach((key) => {
              varsCompletion.push({ varr: key, priority: varPriority });
            });
          }
        }

        continue;
      }
    }
  }

  // At this point path is at play level
  // At play level, there are two more ways in which vars can be defined:
  // 1. vars_prompt
  // 2. vars_files

  // handling vars_prompt
  varPriority = varPriority + 1;
  const playNode = path[path.length - 3].toJSON();
  if (playNode.hasOwnProperty("vars_prompt")) {
    const varsPromptObject = playNode["vars_prompt"];

    varsPromptObject.forEach((element) => {
      varsCompletion.push({ varr: element["name"], priority: varPriority });
    });
  }

  // handling vars_files
  varPriority = varPriority + 1;
  if (playNode.hasOwnProperty("vars_files")) {
    const varsPromptObject = playNode["vars_files"];

    const currentDirectory = pathUri.dirname(URI.parse(documentUri).path);
    varsPromptObject.forEach((element) => {
      let varFilePath;
      if (pathUri.isAbsolute(element)) {
        varFilePath = element;
      } else {
        varFilePath = URI.parse(
          pathUri.resolve(currentDirectory, element),
        ).path;
      }

      // read the vars_file and get the variables declared inside it
      if (existsSync(varFilePath)) {
        const file = readFileSync(varFilePath, {
          encoding: "utf8",
        });

        const yamlDocContent = parseDocument(file).contents.toJSON();

        // variables declared in the file should be in list format only
        if (Array.isArray(yamlDocContent)) {
          yamlDocContent.forEach((element) => {
            if (typeof element === "object") {
              Object.keys(element).forEach((key) => {
                varsCompletion.push({ varr: key, priority: varPriority });
              });
            }
          });
        }
      }
    });
  }

  // return the completions as completion items
  return varsCompletion.map(({ varr, priority }) => {
    const completionItem: CompletionItem = {
      label: varr,
      sortText: `${priority}_${varr}`,
      kind: CompletionItemKind.Variable,
    };
    return completionItem;
  });
}
