export function loadLocalEnv() {
  try {
    process.loadEnvFile();
  } catch {
    /* .env optional */
  }
}
