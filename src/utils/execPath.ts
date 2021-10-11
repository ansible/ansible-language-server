// utils function to resolve executable path
import * as path from 'path';
import { ExtensionSettings } from '../interfaces/extensionSettings';

export function getAnsibleCommandExecPath(
  name: string,
  settings: ExtensionSettings
): string {
  if (!name.startsWith('ansible')) {
    return name;
  }
  return name === 'ansible-lint'
    ? settings.ansibleLint.path
    : path.join(path.dirname(settings.ansible.path), name);
}
