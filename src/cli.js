import { EXIT } from './exit-codes.js';
import { readVersion } from './version.js';
import { scan } from './commands/scan.js';

const USAGE = `GuardAI CLI

Usage:
  guardai <command> [options]

Commands:
  scan        Scan infrastructure code for governance violations
  version     Print the CLI version
  help        Show this message

Run 'guardai scan --help' for scan options.

Exit codes:
  0  passed
  1  violations found
  2  usage error
  3  GuardAI failed to run
`;

export async function run(args) {
  const [command] = args;

  if (command === undefined || command === 'help' || command === '--help' || command === '-h') {
    console.log(USAGE);
    return EXIT.OK;
  }

  if (command === 'version' || command === '--version' || command === '-v') {
    console.log(readVersion());
    return EXIT.OK;
  }

  if (command === 'scan') {
    return scan(args.slice(1));
  }

  console.error(`guardai: unknown command '${command}'\n`);
  console.error(USAGE);
  return EXIT.USAGE_ERROR;
}
