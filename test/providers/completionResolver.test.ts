/**
 * This is the test file for `doCompletionResolve()` function in the completion provider.
 * `doCompletionResolve()` is called to resolve the selected completion item.
 */

import { expect } from "chai";
import { doCompletionResolve } from "../../src/providers/completionProvider";
import {} from "../../src/providers/validationProvider";
import {
  createTestWorkspaceManager,
  getDoc,
  setFixtureAnsibleCollectionPathEnv,
} from "../helper";

setFixtureAnsibleCollectionPathEnv();

describe("doCompletionResolve()", () => {
  const workspaceManager = createTestWorkspaceManager();

  describe("Resolve completion for module names", () => {
    describe("With useFQCN enabled", () => {
      const tests = [
        {
          name: "module name with full FQCN",
          completionItem: {
            label: "module_3",
            data: {
              documentUri: "dummy/url/for/resolve_completion.yml",
              moduleFqcn: "org_1.coll_3.module_3",
              inlineCollections: ["org_1.coll_3", "ansible.builtin"],
              atEndOfLine: true,
            },
          },
          completionText: "org_1.coll_3.module_3",
        },
      ];

      tests.forEach(({ name, completionItem, completionText }) => {
        it(`should resolve completion for ${name}`, async function () {
          const textDoc = await getDoc("completion/resolve_completion.yml");
          const context = workspaceManager.getContext(textDoc.uri);

          const actualCompletionResolveAtLineEnd = await doCompletionResolve(
            completionItem,
            context
          );

          expect(actualCompletionResolveAtLineEnd.insertText).be.equal(
            `${completionText}:\r\t\t`
          );

          // Check for completion resolution when asked in between of lines
          completionItem.data.atEndOfLine = false;
          const actualCompletionResolveAtInBetween = await doCompletionResolve(
            completionItem,
            context
          );

          expect(actualCompletionResolveAtInBetween.insertText).be.equal(
            `${completionText}`
          );
        });
      });
    });

    describe("With useFQCN disabled", () => {
      const tests = [
        {
          name: "module name with short name since it is present in declared collections in playbook",
          completionItem: {
            label: "module_3",
            data: {
              documentUri: "dummy/uri/for/resolve_completion.yml",
              moduleFqcn: "org_1.coll_3.module_3",
              inlineCollections: ["org_1.coll_3", "ansible.builtin"],
              atEndOfLine: true,
            },
          },
          completionText: "module_3",
        },
        {
          name: "module name with full FQCN since it is not present in declared collections in playbook",
          completionItem: {
            label: "module_1",
            data: {
              documentUri: "dummy/uri/for/resolve_completion.yml",
              moduleFqcn: "org_1.coll_1.module_1",
              inlineCollections: ["org_1.coll_3", "ansible.builtin"],
              atEndOfLine: true,
            },
          },
          completionText: "org_1.coll_1.module_1",
        },
      ];

      tests.forEach(({ name, completionItem, completionText }) => {
        it(`should resolve completion for ${name}`, async function () {
          const textDoc = await getDoc("completion/resolve_completion.yml");
          const context = workspaceManager.getContext(textDoc.uri);

          //   Update setting to stop using FQCN for module names
          const docSettings = context.documentSettings.get(textDoc.uri);
          const cachedDefaultSetting = (await docSettings).ansibleLint.enabled;
          (await docSettings).ansible.useFullyQualifiedCollectionNames = false;

          const actualCompletionResolveAtLineEnd = await doCompletionResolve(
            completionItem,
            context
          );

          expect(actualCompletionResolveAtLineEnd.insertText).be.equal(
            `${completionText}:\r\t\t`
          );

          // Check for completion resolution when asked in between of lines
          completionItem.data.atEndOfLine = false;
          const actualCompletionResolveAtInBetween = await doCompletionResolve(
            completionItem,
            context
          );

          expect(actualCompletionResolveAtInBetween.insertText).be.equal(
            `${completionText}`
          );

          // Revert back the default settings
          (await docSettings).ansible.useFullyQualifiedCollectionNames =
            cachedDefaultSetting;
        });
      });
    });
  });

  describe("Resolve completion for module options and suboptions", () => {
    const tests = [
      {
        name: "option expecting dictionary with `option: \\r\\t\\t`",
        completionItem: {
          label: "opt_1",
          data: {
            documentUri: "dummy/uri/for/resolve_completion.yml",
            type: "dict",
            atEndOfLine: true,
          },
        },
        completionText: "opt_1",
      },
      {
        name: "sub option expecting list with `sub_option: \\r\\t- `",
        completionItem: {
          label: "sub_opt_2",
          data: {
            documentUri: "dummy/uri/for/resolve_completion.yml",
            type: "list",
            atEndOfLine: true,
          },
        },
        completionText: "sub_opt_2",
      },
      {
        name: "sub option expecting string or number or boolean with `sub_option: `",
        completionItem: {
          label: "sub_opt_1",
          data: {
            documentUri: "dummy/uri/for/resolve_completion.yml",
            type: "string",
            atEndOfLine: true,
          },
        },
        completionText: "sub_opt_1",
      },
    ];

    tests.forEach(({ name, completionItem, completionText }) => {
      it(`should resolve completion for ${name}`, async function () {
        const textDoc = await getDoc("completion/resolve_completion.yml");
        const context = workspaceManager.getContext(textDoc.uri);

        const actualCompletionResolveAtLineEnd = await doCompletionResolve(
          completionItem,
          context
        );

        let returnSuffix: string;
        switch (completionItem.data.type) {
          case "list":
            returnSuffix = "\r\t- ";
            break;
          case "dict":
            returnSuffix = "\r\t\t";
            break;
          default:
            returnSuffix = " ";
            break;
        }
        expect(actualCompletionResolveAtLineEnd.insertText).be.equal(
          `${completionText}:${returnSuffix}`
        );

        // Check for completion resolution when asked in between of lines
        completionItem.data.atEndOfLine = false;
        const actualCompletionResolveAtInBetween = await doCompletionResolve(
          completionItem,
          context
        );

        expect(actualCompletionResolveAtInBetween.insertText).be.equal(
          `${completionText}`
        );
      });
    });
  });
});
