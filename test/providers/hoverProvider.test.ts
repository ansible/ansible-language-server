import { TextDocument } from "vscode-languageserver-textdocument";
import { expect } from "chai";
import {
  createTestWorkspaceManager,
  getDoc,
  resolveDocUri,
  enableExecutionEnvironmentSettings,
  disableExecutionEnvironmentSettings,
  setFixtureAnsibleCollectionPathEnv,
  unSetFixtureAnsibleCollectionPathEnv,
} from "../helper";
import { doHover } from "../../src/providers/hoverProvider";
import { Position } from "vscode-languageserver";
import { WorkspaceFolderContext } from "../../src/services/workspaceManager";

function testPlayKeywords(
  context: WorkspaceFolderContext,
  textDoc: TextDocument
) {
  const tests = [
    {
      word: "name",
      position: { line: 0, character: 4 } as Position,
      doc: "Identifier. Can be used for documentation, or in tasks/handlers.",
    },
    {
      word: "host",
      position: { line: 1, character: 4 } as Position,
      doc: "A list of groups, hosts or host pattern that translates into a list of hosts that are the play’s target.",
    },
    {
      word: "tasks",
      position: { line: 3, character: 4 } as Position,
      doc: "Main list of tasks to execute in the play, they run after roles and before post_tasks.",
    },
  ];

  tests.forEach(({ word, position, doc }) => {
    it(`should provide hovering for '${word}'`, async function () {
      const actualHover = await doHover(
        textDoc,
        position,
        await context.docsLibrary
      );
      expect(actualHover.contents["value"]).includes(doc);
    });
  });
}

function testTaskKeywords(
  context: WorkspaceFolderContext,
  textDoc: TextDocument
) {
  const tests = [
    {
      word: "register",
      position: { line: 6, character: 8 } as Position,
      doc: "Name of variable that will contain task status and module return data.",
    },
  ];

  tests.forEach(({ word, position, doc }) => {
    it(`should provide hovering for '${word}'`, async function () {
      const actualHover = await doHover(
        textDoc,
        position,
        await context.docsLibrary
      );
      expect(actualHover.contents["value"]).includes(doc);
    });
  });
}

function testBlockKeywords(
  context: WorkspaceFolderContext,
  textDoc: TextDocument
) {
  const tests = [
    {
      word: "become",
      position: { line: 11, character: 8 } as Position,
      doc: "Boolean that controls if privilege escalation is used or not on Task execution. Implemented by the become plugin.",
    },
  ];

  tests.forEach(({ word, position, doc }) => {
    it(`should provide hovering for '${word}'`, async function () {
      const actualHover = await doHover(
        textDoc,
        position,
        await context.docsLibrary
      );
      expect(actualHover.contents["value"]).includes(doc);
    });
  });
}

function testRoleKeywords(
  context: WorkspaceFolderContext,
  textDoc: TextDocument
) {
  const tests = [
    {
      word: "tags",
      position: { line: 6, character: 8 } as Position,
      doc: "Tags applied to the task or included tasks, this allows selecting subsets of tasks from the command line.",
    },
  ];

  tests.forEach(({ word, position, doc }) => {
    it(`should provide hovering for '${word}'`, async function () {
      const actualHover = await doHover(
        textDoc,
        position,
        await context.docsLibrary
      );
      expect(actualHover.contents["value"]).includes(doc);
    });
  });
}

function testModuleNames(
  context: WorkspaceFolderContext,
  textDoc: TextDocument
) {
  const tests = [
    {
      word: "ansible.builtin.debug",
      position: { line: 4, character: 8 } as Position,
      doc: "Print statements during execution",
    },
    {
      word: "ansible.builtin.debug -> msg",
      position: { line: 5, character: 10 } as Position,
      doc: "The customized message that is printed. If omitted, prints a generic message.",
    },
  ];

  tests.forEach(({ word, position, doc }) => {
    it(`should provide hovering for '${word}'`, async function () {
      const actualHover = await doHover(
        textDoc,
        position,
        await context.docsLibrary
      );
      expect(actualHover.contents["value"]).includes(doc);
    });
  });
}

function testNoHover(context: WorkspaceFolderContext, textDoc: TextDocument) {
  it("should not provide hovering for values", async function () {
    const actualHover = await doHover(
      textDoc,
      { line: 13, character: 24 } as Position,
      await context.docsLibrary
    );
    expect(actualHover).to.be.null;
  });

  it("should not provide hovering for improper module name and options", async function () {
    const actualHover = await doHover(
      textDoc,
      { line: 13, character: 8 } as Position,
      await context.docsLibrary
    );
    expect(actualHover).to.be.null;
  });

  it("should not provide hovering for improper module option", async function () {
    const actualHover = await doHover(
      textDoc,
      { line: 14, character: 10 } as Position,
      await context.docsLibrary
    );
    expect(actualHover).to.be.null;
  });
}

describe("doHover()", () => {
  const workspaceManager = createTestWorkspaceManager();
  let fixtureFilePath = "hover/tasks.yml";
  let fixtureFileUri = resolveDocUri(fixtureFilePath);
  let context = workspaceManager.getContext(fixtureFileUri);

  let textDoc = getDoc(fixtureFilePath);
  let docSettings = context.documentSettings.get(textDoc.uri);

  describe("Play keywords hover", () => {
    describe("With EE enabled", () => {
      before(async () => {
        setFixtureAnsibleCollectionPathEnv(
          "/home/runner/.ansible/collections:/usr/share/ansible"
        );
        enableExecutionEnvironmentSettings(docSettings);
      });

      testPlayKeywords(context, textDoc);

      after(async () => {
        unSetFixtureAnsibleCollectionPathEnv();
        disableExecutionEnvironmentSettings(docSettings);
      });
    });

    describe("With EE disabled", () => {
      before(async () => {
        unSetFixtureAnsibleCollectionPathEnv();
        disableExecutionEnvironmentSettings(docSettings);
      });

      testPlayKeywords(context, textDoc);
    });
  });

  describe("Task keywords hover", () => {
    describe("With EE enabled", () => {
      before(async () => {
        setFixtureAnsibleCollectionPathEnv(
          "/home/runner/.ansible/collections:/usr/share/ansible"
        );
        enableExecutionEnvironmentSettings(docSettings);
      });

      testTaskKeywords(context, textDoc);

      after(async () => {
        unSetFixtureAnsibleCollectionPathEnv();
        disableExecutionEnvironmentSettings(docSettings);
      });
    });

    describe("With EE disabled", () => {
      before(async () => {
        unSetFixtureAnsibleCollectionPathEnv();
        disableExecutionEnvironmentSettings(docSettings);
      });

      testTaskKeywords(context, textDoc);
    });
  });

  describe("Block keywords hover", () => {
    describe("With EE enabled", () => {
      before(async () => {
        setFixtureAnsibleCollectionPathEnv(
          "/home/runner/.ansible/collections:/usr/share/ansible"
        );
        enableExecutionEnvironmentSettings(docSettings);
      });

      testBlockKeywords(context, textDoc);

      after(async () => {
        unSetFixtureAnsibleCollectionPathEnv();
        disableExecutionEnvironmentSettings(docSettings);
      });
    });

    describe("With EE disabled", () => {
      before(async () => {
        unSetFixtureAnsibleCollectionPathEnv();
        disableExecutionEnvironmentSettings(docSettings);
      });

      testBlockKeywords(context, textDoc);
    });
  });

  describe("Role keywords hover", () => {
    fixtureFilePath = "hover/roles.yml";
    fixtureFileUri = resolveDocUri(fixtureFilePath);
    context = workspaceManager.getContext(fixtureFileUri);

    textDoc = getDoc(fixtureFilePath);
    docSettings = context.documentSettings.get(textDoc.uri);

    describe("With EE enabled", () => {
      before(async () => {
        setFixtureAnsibleCollectionPathEnv(
          "/home/runner/.ansible/collections:/usr/share/ansible"
        );
        enableExecutionEnvironmentSettings(docSettings);
      });

      testRoleKeywords(context, textDoc);

      after(async () => {
        unSetFixtureAnsibleCollectionPathEnv();
        disableExecutionEnvironmentSettings(docSettings);
      });
    });

    describe("With EE disabled", () => {
      before(async () => {
        unSetFixtureAnsibleCollectionPathEnv();
        disableExecutionEnvironmentSettings(docSettings);
      });

      testRoleKeywords(context, textDoc);
    });
  });

  describe("Module name and options hover", () => {
    fixtureFilePath = "hover/tasks.yml";
    fixtureFileUri = resolveDocUri(fixtureFilePath);
    context = workspaceManager.getContext(fixtureFileUri);

    textDoc = getDoc(fixtureFilePath);
    docSettings = context.documentSettings.get(textDoc.uri);
    describe("With EE enabled", () => {
      before(async () => {
        setFixtureAnsibleCollectionPathEnv(
          "/home/runner/.ansible/collections:/usr/share/ansible"
        );
        enableExecutionEnvironmentSettings(docSettings);
      });

      testModuleNames(context, textDoc);

      after(async () => {
        unSetFixtureAnsibleCollectionPathEnv();
        disableExecutionEnvironmentSettings(docSettings);
      });
    });

    describe("With EE disabled", () => {
      before(async () => {
        unSetFixtureAnsibleCollectionPathEnv();
        disableExecutionEnvironmentSettings(docSettings);
      });

      testModuleNames(context, textDoc);
    });
  });

  describe("No hover", () => {
    describe("With EE enabled", () => {
      before(async () => {
        setFixtureAnsibleCollectionPathEnv(
          "/home/runner/.ansible/collections:/usr/share/ansible"
        );
        enableExecutionEnvironmentSettings(docSettings);
      });

      testNoHover(context, textDoc);

      after(async () => {
        unSetFixtureAnsibleCollectionPathEnv();
        disableExecutionEnvironmentSettings(docSettings);
      });
    });

    describe("With EE disabled", () => {
      before(async () => {
        unSetFixtureAnsibleCollectionPathEnv();
        disableExecutionEnvironmentSettings(docSettings);
      });

      testNoHover(context, textDoc);
    });
  });
});
