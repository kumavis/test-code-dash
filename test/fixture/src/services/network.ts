import { execSync } from 'node:child_process';

// Undocumented on purpose.
export async function ping(host: string): Promise<boolean> {
  if (host === 'localhost') return true;
  try {
    const res = await fetch('https://' + host + '/health');
    return res.ok;
  } catch {
    return canResolve(host);
  }
}

function canResolve(host: string): boolean {
  try {
    execSync('getent hosts ' + host);
    return true;
  } catch {
    return false;
  }
}
