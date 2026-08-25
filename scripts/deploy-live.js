const { spawnSync } = require('child_process');

const LIVE_DEPLOYMENT_ID = process.env.FLEXX_LIVE_DEPLOYMENT_ID ||
  'AKfycbzyTXr9WejAhnay9AhItrQ-XGYfkLxKfEmk750se4i0KTCRPCVOD2xkzFtmHGmmLcfj';

const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const description = process.argv.slice(2).join(' ') ||
  `Live deploy ${new Date().toISOString().slice(0, 10)}`;

function runClasp(args) {
  const result = spawnSync(npxCommand, ['clasp'].concat(args), {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: false,
    stdio: ['inherit', 'pipe', 'pipe']
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }

  return `${result.stdout || ''}\n${result.stderr || ''}`;
}

console.log('Pushing source to Apps Script...');
runClasp(['push', '--force']);

console.log(`Creating Apps Script version: ${description}`);
const versionOutput = runClasp(['version', description]);
const versionMatch = versionOutput.match(/Created version\s+(\d+)/i);

if (!versionMatch) {
  console.error('Could not find the created version number in clasp output.');
  process.exit(1);
}

const versionNumber = versionMatch[1];
console.log(`Redeploying live web app ${LIVE_DEPLOYMENT_ID} @${versionNumber}...`);
runClasp([
  'redeploy',
  LIVE_DEPLOYMENT_ID,
  '--versionNumber',
  versionNumber,
  '--description',
  description
]);

console.log(`Live deployment updated to version ${versionNumber}.`);
