// Set at build time (scripts/build.sh); "dev" when run from source.
declare const __AGENTPAGER_VERSION__: string | undefined;
export const VERSION = typeof __AGENTPAGER_VERSION__ === 'string' ? __AGENTPAGER_VERSION__ : 'dev';
