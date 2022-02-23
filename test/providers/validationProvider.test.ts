import { expect } from 'chai';
import { Position } from 'vscode';
import {
  createTestWorkspaceManager,
  getDoc,
  setFixtureAnsibleCollectionPathEnv,
} from '../helper';

setFixtureAnsibleCollectionPathEnv();

describe('doValidate()', () => {
  const workspaceManager = createTestWorkspaceManager();

  describe('Ansible diagnostics', () => {
    describe('Diagnostics using ansible-playbook --syntax-check', () => {
      const tests = [
        {
          name: 'no host',
          file: 'diagnostics/noHost.yml',
          diagnosticReport: [
            {
              severity: 1,
              // eslint-disable-next-line quotes
              message: "the field 'hosts' is required but was not set",
              range: {
                start: { line: 0, character: 0 } as Position,
                end: {
                  line: 0,
                  character: Number.MAX_SAFE_INTEGER,
                } as Position,
              },
              source: 'Ansible',
            },
          ],
        },
        {
          name: 'empty playbook',
          file: 'diagnostics/empty.yml',
          diagnosticReport: [
            {
              severity: 1,
              message: 'Empty playbook',
              range: {
                start: { line: 0, character: 0 } as Position,
                end: {
                  line: 0,
                  character: Number.MAX_SAFE_INTEGER,
                } as Position,
              },
              source: 'Ansible',
            },
          ],
        },
      ];

      tests.forEach(({ name, file, diagnosticReport }) => {
        it(`should provide diagnostics for ${name}`, async function () {
          const textDoc = await getDoc(file);
          const context = workspaceManager.getContext(textDoc.uri);

          const actualDiagnostics = await context.ansiblePlaybook.doValidate(
            textDoc
          );

          expect(actualDiagnostics.size).to.equal(diagnosticReport.length);

          Array.from(actualDiagnostics.values()).forEach((diag, i) => {
            const actDiag = diag[i];
            const expDiag = diagnosticReport[i];

            expect(actDiag.message).include(expDiag.message);
            expect(actDiag.range).to.deep.equal(expDiag.range);
            expect(actDiag.severity).to.equal(expDiag.severity);
            expect(actDiag.source).to.equal(expDiag.source);
          });
        });
      });
    });
  });
});
