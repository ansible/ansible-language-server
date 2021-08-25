import * as child_process from 'child_process';
import { ExecException } from 'child_process';
import { promisify } from 'util';

const exec = promisify(child_process.exec);

export async function libraryChecker(
  libraryName: string,
  checkArg: string
): Promise<boolean> {
  let success = true;

  try {
    await exec(`${libraryName} ${checkArg}`, {
      encoding: 'utf-8',
    });
  } catch (error) {
    if (error instanceof Error) {
      success = false;
    }
  }

  return success;
}
