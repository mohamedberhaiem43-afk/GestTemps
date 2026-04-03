let appConfig: any = null;

export async function loadConfig() {
  const response = await fetch('/config.json'); // note: no ../public
  if (!response.ok) {
    throw new Error(`Failed to load config: ${response.status}`);
  }
  appConfig = await response.json();
}

export function getConfig() {
  if (!appConfig) {
    throw new Error('Config not loaded yet!');
  }
  return appConfig;
}
