import { CliError } from "./output.js";

export async function openBrowser(value: string, baseUrl: string) {
  const url = new URL(value);
  if (
    url.origin !== baseUrl ||
    url.username ||
    url.password ||
    !["http:", "https:"].includes(url.protocol)
  )
    throw new CliError("UNSAFE_BROWSER_URL", "Browser URL must use the selected API origin");
  // open uses platform argument arrays/encoded PowerShell, never an interpolated shell command.
  try {
    const { default: open } = await import("open");
    await open(url.href, { wait: false });
  } catch {
    throw new CliError(
      "BROWSER_UNAVAILABLE",
      "Unable to open browser; use --no-browser or --print-url",
      5,
    );
  }
}
