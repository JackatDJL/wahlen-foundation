"use client";

import { useState } from "react";
import { handleRouting } from "~/server/foundation-router";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Checkbox } from "~/components/ui/checkbox";

export function RouterTestClient() {
  const [result, setResult] = useState<string>("");
  const [inputPath, setInputPath] = useState<string>("");
  const [devMode, setDevMode] = useState<boolean>(true);

  const handleTest = async () => {
    setResult((await handleRouting(inputPath, true, !devMode)) ?? "");
  };

  return (
    <div className="mx-auto w-[85%] space-y-4">
      <h2 className="text-xl font-semibold">Navigation Test</h2>
      <form
        className="flex items-center gap-4"
        onSubmit={(e) => e.preventDefault()}
      >
        <Input
          type="text"
          className="flex-1"
          placeholder="Enter path to test"
          value={inputPath}
          onChange={(e) => setInputPath(e.target.value)}
        />
        <Button onClick={handleTest} type="button">
          Test
        </Button>
      </form>
      <div className="flex items-center gap-2">
        <Checkbox
          id="devMode"
          checked={devMode}
          onCheckedChange={(checked) => setDevMode(checked === true)}
        />
        <label htmlFor="devMode" className="text-sm">
          Dev Mode
        </label>
      </div>
      {result && (
        <div className="rounded-md border bg-muted p-4 font-mono text-sm">
          {result}
        </div>
      )}
    </div>
  );
}
