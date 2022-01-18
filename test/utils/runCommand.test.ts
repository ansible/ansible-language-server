import { CommandRunner } from '../../src/utils/commandRunner';
import { expect } from 'chai';
import { WorkspaceManager } from '../../src/services/workspaceManager';
import { createConnection } from 'vscode-languageserver/node';
import { getDoc } from './helper';


describe('commandRunner', () => {
  it('ansible-force-color', async function () {
    this.timeout(10000);
    process.argv.push('--node-ipc');
    const connection = createConnection();
    const workspaceManager = new WorkspaceManager(connection);
    const textDoc = await getDoc('yaml/ancestryBuilder.yml');
    const context = workspaceManager.getContext(textDoc.uri);
    const settings = await context.documentSettings.get(textDoc.uri);

    const commandRunner = new CommandRunner(
      connection,
      context,
      settings
    );
    const proc = await commandRunner.runCommand('ansible-config', 'dump');
    // ensure that by default coloring is disabled as its presence can break
    // parsing of output of multiple tools, including: ansible-playbook, ansible-config and ansible-lint.
    expect(proc.stdout).contains(
      'ANSIBLE_FORCE_COLOR(env: ANSIBLE_FORCE_COLOR) = False\nANSIBLE_NOCOLOR(default) = False'
    );
  });
});
