import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const envPath = join(process.cwd(), '.env');

if (!existsSync(envPath)) {
  console.error('\x1b[31mError: .env file not found!\x1b[0m');
  process.exit(1);
}

console.log('\x1b[33mReading environment variables from .env...\x1b[0m');

// Read and parse .env file
const envFileContent = readFileSync(envPath, 'utf8');
const envVars = envFileContent
  .split('\n')
  .map(line => line.trim())
  .filter(line => line.length > 0 && !line.startsWith('#'))
  .join(',');

console.log('\x1b[36mStarting Cloud Run deployment...\x1b[0m');

const deployCommand = `gcloud run deploy frontend-web ` +
  `--source . ` +
  `--region us-central1 ` +
  `--allow-unauthenticated ` +
  `--set-env-vars="${envVars}"`;

try {
  // Execute the gcloud command and pipe output to the console
  execSync(deployCommand, { stdio: 'inherit' });
  console.log('\x1b[32mDeployment successful!\x1b[0m');
} catch (error) {
  console.error('\x1b[31mDeployment failed.\x1b[0m');
  process.exit(1);
}
