"use client";

import { useState } from "react";
import { handleRouting } from "~/server/foundation-router";

export function RouterTestClient() {
  const [result, setResult] = useState<string>("");
  const [inputPath, setInputPath] = useState<string>("");
  const handleTest = async () => {
    setResult(await handleRouting(inputPath, true));
  };

  return (
    <div className="space-y-2">
      <h2 className="text-xl font-semibold">Navigation Test</h2>
      <form
        className="flex items-center gap-2 rounded-md border bg-muted p-4"
        onSubmit={(e) => e.preventDefault()}
      >
        <input
          type="text"
          className="flex-1 rounded-md border px-3 py-2"
          placeholder="Enter path to test"
          value={inputPath}
          onChange={(e) => setInputPath(e.target.value)}
        />
        <button
          className="rounded-md bg-primary px-3 py-2 text-primary-foreground"
          onClick={handleTest}
          type="button"
        >
          Test
        </button>
      </form>
      <div className="rounded-md border bg-muted p-4 font-mono text-sm">
        {result}
      </div>
    </div>
  );
}
