import { devModeFlag } from "~/server/flags";
import {
  getCurrentPath,
  getHeaders,
  getShortname,
  handleRouting,
} from "~/server/foundation-router";
import { RouterTestClient } from "./client";

export default async function RouterTestPage() {
  const dev = await devModeFlag();
  const shortname = await getShortname();
  const headers = await getHeaders();
  const currentPath = await getCurrentPath();

  if (!dev) {
    return (
      <div>
        Development mode is disabled. This page is only available in development
        mode.
      </div>
    );
  }

  return (
    <div className="container space-y-6 py-10">
      <h1 className="text-2xl font-bold">Router Test Page</h1>

      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Shortname</h2>
        <div className="rounded-md border bg-muted p-4">{shortname}</div>
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Current Path</h2>
        <div className="rounded-md border bg-muted p-4">{currentPath}</div>
      </div>

      <div className="space-y-2">
        <RouterTestClient />
      </div>

      <div className="space-y-2">
        <details className="rounded-md border p-4">
          <summary className="cursor-pointer text-xl font-semibold">
            Headers
          </summary>
          <pre className="mt-2 overflow-auto rounded-md bg-muted p-4">
            {JSON.stringify(headers, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
}
