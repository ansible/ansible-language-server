import { TextDocument } from "vscode-languageserver-textdocument";
import { expect } from "chai";
import {
  createTestWorkspaceManager,
  getDoc,
  resolveDocUri,
  enableExecutionEnvironmentSettings,
  disableExecutionEnvironmentSettings,
  setFixtureAnsibleCollectionPathEnv,
} from "../helper";
import { doHover } from "../../src/providers/hoverProvider";
import { Position } from "vscode-languageserver";
import { WorkspaceFolderContext } from "../../src/services/workspaceManager";
import { getDefinition } from "../../src/providers/definitionProvider";
import { fileExists } from "../../src/utils/misc";
import { URI } from "vscode-uri";

// export async function fileExists(filePath: string): Promise<boolean> {
//   return !!(await fs.stat(filePath).catch(() => false));
// }

function testModuleNamesForDefinition(
  context: WorkspaceFolderContext,
  textDoc: TextDocument,
) {
  const tests = [
    {
      word: "definition for buitin modules (ansible.builtin.debug)",
      position: { line: 5, character: 8 } as Position,
      selectionRange: {
        start: { line: 5, character: 6 },
        end: { line: 5, character: 27 },
      },
      provideDefinition: true,
    },
    {
      word: "no definition for invalid module names",
      position: { line: 13, character: 8 } as Position,
      selectionRange: {
        start: { line: 13, character: 6 },
        end: { line: 13, character: 15 },
      },
      provideDefinition: false,
    },
    {
      word: "definition for collection modules (org_1.coll_3.module_3)",
      position: { line: 18, character: 8 } as Position,
      selectionRange: {
        start: { line: 18, character: 6 },
        end: { line: 18, character: 27 },
      },
      provideDefinition: true,
    },
  ];

  tests.forEach(({ word, position, selectionRange, provideDefinition }) => {
    it(`should provide '${word}'`, async function () {
      const actualDefinition = await getDefinition(
        textDoc,
        position,
        await context.docsLibrary,
      );

      if (!provideDefinition) {
        expect(actualDefinition).to.be.null;
        return;
      }

      expect(actualDefinition).to.have.length(1);

      const definition = actualDefinition[0];

      // file uri check
      expect(definition.targetUri.startsWith("file:///")).to.be.true;
      expect(definition.targetUri).satisfy((fileUri: string) =>
        fileExists(URI.parse(fileUri).path),
      );

      // nodule name range check in the playbook
      expect(definition.originSelectionRange).to.deep.equal(selectionRange);

      // original document range checks
      expect(definition).to.haveOwnProperty("targetRange");
      expect(definition).to.haveOwnProperty("targetSelectionRange");
    });
  });
}

describe("getDefinition()", function () {
  const workspaceManager = createTestWorkspaceManager();
  let fixtureFilePath = "definition/playbook_for_module_definition.yml";
  let fixtureFileUri = resolveDocUri(fixtureFilePath);
  let context = workspaceManager.getContext(fixtureFileUri);

  let textDoc = getDoc(fixtureFilePath);
  let docSettings = context.documentSettings.get(textDoc.uri);

  describe("Module name definitions", function () {
    describe("With EE enabled @ee", function () {
      before(async function () {
        setFixtureAnsibleCollectionPathEnv(
          "/home/runner/.ansible/collections:/usr/share/ansible",
        );
        await enableExecutionEnvironmentSettings(docSettings);
      });

      testModuleNamesForDefinition(context, textDoc);

      after(async function () {
        setFixtureAnsibleCollectionPathEnv();
        await disableExecutionEnvironmentSettings(docSettings);
      });
    });

    describe("With EE disabled", function () {
      before(async function () {
        setFixtureAnsibleCollectionPathEnv();
        await disableExecutionEnvironmentSettings(docSettings);
      });

      testModuleNamesForDefinition(context, textDoc);
    });
  });
});
