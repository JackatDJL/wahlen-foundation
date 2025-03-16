"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { GitHub, Mail, Navigation, Shield } from "react-feather";

export default function Footer() {
  return (
    <motion.footer
      className="border-t border-border bg-gradient-to-r from-primary/10 via-primary/5 to-secondary/10 py-8 print:bg-white print:text-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <p className="font-medium text-muted-foreground print:text-black">
              Wahlen Foundation
            </p>
            <p className="text-sm text-muted-foreground print:text-black">
              Making elections accessible anywhere, anytime.
              <br />
              The new Digital Era.
            </p>
          </motion.div>

          <motion.div
            className="flex items-center gap-6"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            {/* Normal links - hidden when printing */}
            <Link
              href="/terms"
              prefetch
              className="text-muted-foreground transition-colors hover:text-primary print:hidden"
            >
              <Navigation className="h-5 w-5" />
              <span className="sr-only">Terms</span>
            </Link>
            <Link
              href="/privacy"
              prefetch
              className="text-muted-foreground transition-colors hover:text-primary print:hidden"
            >
              <Shield className="h-5 w-5" />
              <span className="sr-only">Privacy</span>
            </Link>
            <Link
              href="https://github.com/djl-foundation"
              className="text-muted-foreground transition-colors hover:text-primary print:hidden"
            >
              <GitHub className="h-5 w-5" />
              <span className="sr-only">GitHub</span>
            </Link>
            <Link
              href="mailto:contact@djl.foundation"
              className="text-muted-foreground transition-colors hover:text-primary print:hidden"
            >
              <Mail className="h-5 w-5" />
              <span className="sr-only">Email</span>
            </Link>

            {/* Print-only links with text */}
            <Link
              href="https://github.com/djl-foundation"
              className="hidden transition-colors hover:text-primary print:block print:text-blue-700 print:no-underline"
            >
              <GitHub className="inline-block h-5 w-5" />
              <span className="ml-1">@djl-foundation</span>
            </Link>
            <Link
              href="mailto:contact@djl.foundation"
              className="hidden transition-colors hover:text-primary print:block print:text-blue-700 print:no-underline"
            >
              <Mail className="inline-block h-5 w-5" />
              <span className="ml-1">contact@djl.foundation</span>
            </Link>
          </motion.div>
        </div>

        <motion.div
          className="mt-6 border-t border-border/30 pt-6 text-center text-sm text-muted-foreground print:text-black"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
          >
            <p className="pt-1 text-center text-sm text-muted-foreground print:text-black">
              The Wahlen Foundation and the DJL Foundation do not endorse any
              elections hosted on this platform.
            </p>
          </motion.div>
          <p>
            © {new Date().getFullYear()} By Jack @ DJL Foundation. All rights
            reserved.
          </p>
        </motion.div>
      </div>
    </motion.footer>
  );
}
