"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { cookieOverwrite } from "~/server/foundation-router";

export default function ClientShortnameOverwrite() {
  const [showForm, setShowForm] = useState<boolean | null>(null);
  const [value, setValue] = useState("");

  useEffect(() => {
    const checkOverwrite = async () => {
      try {
        const result = await cookieOverwrite();
        setShowForm(result ? true : false);
      } catch (error) {
        console.error("Error checking cookie overwrite:", error);
        setShowForm(false);
      }
    };

    checkOverwrite();
  }, []);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const expiryTime = 60 * 60; // 1 hour in seconds
    document.cookie = `x-short-overwrite=${encodeURIComponent(value)};path=/;max-age=${expiryTime}`;
  };

  if (showForm === null)
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  if (!showForm) return null;

  return (
    <motion.div
      className="mb-4 w-full"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
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
    </motion.div>
  );
}
