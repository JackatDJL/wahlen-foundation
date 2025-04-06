import { devModeFlag } from "~/server/flags";
import {
  getCurrentPath,
  getHeaders,
  getShortname,
  handleRouting,
} from "~/server/foundation-router";
import { RouterTestClient } from "./client";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";

export default async function RouterTestPage() {
  const dev = await devModeFlag();
  const shortname = await getShortname();
  const headers = await getHeaders();
  const currentPath = await getCurrentPath();

  if (!dev) {
    return (
      <div className="container mx-auto max-w-4xl py-10">
        <Card>
          <CardContent>
            Development mode is disabled. This page is only available in
            development mode.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl space-y-6 py-10">
      <h1 className="text-2xl font-bold">Router Test Page</h1>

      <Card>
        <CardHeader>
          <CardTitle>Navigation Tests</CardTitle>
        </CardHeader>
        <CardContent>
          <RouterTestClient />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Shortname</CardTitle>
        </CardHeader>
        <CardContent>{shortname}</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current Path</CardTitle>
        </CardHeader>
        <CardContent>{currentPath}</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Headers</CardTitle>
        </CardHeader>
        <CardContent>
          <Collapsible>
            <CollapsibleTrigger className="text-primary underline">
              Toggle Headers
            </CollapsibleTrigger>
            <CollapsibleContent>
              <pre className="mt-2 overflow-auto rounded-md bg-muted p-4">
                {JSON.stringify(headers, null, 2)}
              </pre>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>
    </div>
  );
}
