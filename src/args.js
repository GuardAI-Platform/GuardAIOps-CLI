const BOOLEAN_FLAGS = new Set([
  'mock',
  'changed',
  'json',
  'comment',
  'pr-comment',
  'mr-comment',
  'help',
]);
const VALUE_FLAGS = new Set(['api-url', 'fail-on', 'base', 'path', 'code-quality-file']);

export function parseArgs(argv) {
  const flags = {};
  const positional = [];
  const errors = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '-h') {
      flags.help = true;
      continue;
    }

    if (!token.startsWith('--')) {
      positional.push(token);
      continue;
    }

    const body = token.slice(2);
    const equalsAt = body.indexOf('=');
    const name = equalsAt === -1 ? body : body.slice(0, equalsAt);

    if (BOOLEAN_FLAGS.has(name)) {
      flags[name] = true;
      continue;
    }

    if (VALUE_FLAGS.has(name)) {
      let value;
      if (equalsAt === -1) {
        index += 1;
        value = argv[index];
      } else {
        value = body.slice(equalsAt + 1);
      }
      if (value === undefined || value.startsWith('--')) {
        errors.push(`option --${name} requires a value`);
        continue;
      }
      flags[name] = value;
      continue;
    }

    errors.push(`unknown option ${token}`);
  }

  return { flags, positional, errors };
}
