"use client";

import type React from "react";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { cookieOverwrite } from "~/server/foundation-router";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";

export default function ClientShortnameOverwrite() {
  const [showForm, setShowForm] = useState<boolean | null>(null);
  const [value, setValue] = useState("");
  const [showDevControls, setShowDevControls] = useState(false);
  const [cleanupDisabled, setCleanupDisabled] = useState(true);

  useEffect(() => {
    const checkOverwrite = async () => {
      try {
        const result = await cookieOverwrite();
        setShowForm(result ? true : false);

        // Check if we're in development mode
        const isDev = process.env.NODE_ENV === "development";
        setShowDevControls(isDev);

        // Check if the cleanup-force-off cookie exists
        const cookieValue = document.cookie
          .split("; ")
          .find((row) => row.startsWith("x-cleanup-force-off="))
          ?.split("=")[1];

        // Set the switch state based on the cookie (default to true if no cookie)
        setCleanupDisabled(
          cookieValue === undefined ? true : cookieValue === "true",
        );
      } catch (error) {
        console.error("Error checking cookie overwrite:", error);
        setShowForm(false);
      }
    };

    void checkOverwrite();
  }, []);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const expiryTime = 60 * 60; // 1 hour in seconds
    document.cookie = `x-short-overwrite=${encodeURIComponent(value)};path=/;max-age=${expiryTime}`;
  };

  const handleCleanupToggle = (checked: boolean) => {
    setCleanupDisabled(checked);

    if (checked) {
      // When on (cleanup disabled), set the cookie
      document.cookie = `x-cleanup-force-off=true;path=/;max-age=${60 * 60}`; // 1 hour
    } else {
      // When off (cleanup enabled), remove the cookie
      document.cookie = "x-cleanup-force-off=;path=/;max-age=0";
    }
  };

  if (showForm === null)
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  if (!showForm && !showDevControls) return null;

  return (
    <motion.div
      className="mb-4 w-full space-y-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="flex flex-wrap items-center gap-2"
        >
          <input
            type="text"
            name="x-short-overwrite"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Enter shortname overwrite"
            className="rounded border border-border bg-background/50 px-3 py-1 text-sm text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <motion.button
            type="submit"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            className="rounded bg-primary/20 px-3 py-1 text-sm font-medium text-primary transition-colors hover:bg-primary/30"
          >
            Set
          </motion.button>
        </form>
      )}

      {showDevControls && (
        <div className="flex items-center space-x-2">
          <Switch
            id="cleanup-toggle"
            checked={cleanupDisabled}
            onCheckedChange={handleCleanupToggle}
          />
          <Label
            htmlFor="cleanup-toggle"
            className="text-sm text-muted-foreground"
          >
            Disable Cleanup {cleanupDisabled ? "(Disabled)" : "(Enabled)"}
          </Label>
        </div>
      )}
    </motion.div>
  );
}
