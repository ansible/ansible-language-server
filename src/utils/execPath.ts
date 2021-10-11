// utils function to resolve executable path
import * as path from 'path';
import { ExtensionSettings } from '../interfaces/extensionSettings';

export function getAnsibleCommandExecPath(name: string, settings: ExtensionSettings): string {
    let executablePath = name
    if (name.startsWith('ansible')) {
        if (name === 'ansible-lint') {
            executablePath = settings.ansibleLint.path
        } else {
            executablePath = path.join(path.dirname(settings.ansible.path), name)
        }
    }
    return executablePath
}
