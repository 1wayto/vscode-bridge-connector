export function normalizeCommand(command: string): string {
  if (!command) {
    return command;
  }
  return command.trim();
}
