/**
 * This is the test file for `doCompletionResolve()` function in the completion provider.
 * `doCompletionResolve()` is called to resolve the selected completion item.
 */

import { expect } from "chai";
import { Position } from "vscode-languageserver";
import {
  doCompletion,
  doCompletionResolve,
} from "../../src/providers/completionProvider";
import {} from "../../src/providers/validationProvider";
import {
  createTestWorkspaceManager,
  getDoc,
  setFixtureAnsibleCollectionPathEnv,
  smartFilter,
} from "../helper";

setFixtureAnsibleCollectionPathEnv();

describe("doCompletionResolve()", () => {
  const workspaceManager = createTestWorkspaceManager();
  it("TESTING", async function () {
    const textDoc = await getDoc("completion/simple_tasks.yml");
    const context = workspaceManager.getContext(textDoc.uri);

    // Call doCompletion to get the list of completion items and filter the desired item
    const actualCompletion = await doCompletion(
      textDoc,
      { line: 7, character: 21 } as Position,
      context
    );
    const filteredCompletion = smartFilter(
      actualCompletion,
      "ansible.builtin.debug"
    );

    console.log("FILTERED LIST -> ", filteredCompletion);

    const completionItem = filteredCompletion[0].item;

    const actualCompletionResolve = await doCompletionResolve(
      completionItem,
      context
    );

    console.log("ACTUAL COMPLETION RESOLVE -> ", actualCompletionResolve);

    expect(actualCompletionResolve.textEdit).not.to.be.null;
  });
});
