"use server";

import { randomUUID } from "crypto";
import { redirect, notFound } from "next/navigation";
import { cookies, headers } from "next/headers";
import { devModeFlag, shortnameDevInterface } from "~/server/flags";

export async function cookieOverwrite() {
  return (await shortnameDevInterface()) === "@ovr/cookie";
}

async function shortnameOverwrite() {
  const res = await shortnameDevInterface();
  switch (res) {
    case "@ovr/cookie":
      const cook = await cookies();
      return cook.get("x-short-overwrite")?.value ?? randomUUID();
    case "@ovr/not-found":
      return randomUUID();
    default:
      return res;
  }
}

// Function to check if a domain is a custom domain (not wahlen.djl.foundation or *.wahl.djl.foundation)
async function fetchCustomDomain(_host: string) {
  // This will be implemented later to fetch organization shortname from custom domain
  // For now, return empty string as requested
  return "";
}

/**
 * Shortname represents the Organisation
 * The election is path based
 */
export async function getShortname() {
  const overwrite = await shortnameOverwrite();
  const headersList = await getHeaders();
  const host = headersList.host ?? "";

  if (overwrite) return overwrite;

  // Check if we're on the root domain
  if (host === rootDomain || host.includes("vercel.app")) {
    return "";
  }

  // Check if we're on a catch domain
  if (host.endsWith(".wahl.djl.foundation")) {
    const shortname = host.split(".")[0];
    return shortname;
  }

  // Check if we're on a custom domain
  if (!host.includes("localhost") && !host.includes("vercel.app")) {
    return await fetchCustomDomain(host);
  }

  return "";
}

export async function getHeaders() {
  const headerList = await headers();
  const headersObject: Record<string, string> = {};

  headerList.forEach((value: string, key: string) => {
    headersObject[key] = value;
  });

  return headersObject;
}

export async function getCurrentPath() {
  const headersObject = await getHeaders();
  const url = headersObject["x-url"] ?? headersObject["x-clerk-clerk-url"];
  const currentPath = url ? new URL(url).pathname : "/";
  return currentPath;
}

const rootDomain = "wahlen.djl.foundation";

// Pages that are allowed on catch domains (organization subdomains)
const allCatchDomainPages = [
  "/",
  "/dashboard",
  "/manage//[shortname]",
  "/wahl//[shortname]",
];

// Pages that are not allowed on the root domain
const rootDisallowedPages = ["/wahl//[shortname]"];

/**
 * Checks if a path matches any of the provided Next.js-style patterns.
 *
 * Supported pattern types:
 * 1. Static patterns: "/dashboard", "/settings"
 *    - Matches exact paths only
 *
 * 2. Dynamic segments: "/users/[id]", "/manage/[shortname]"
 *    - [param] matches any value at that segment position
 *
 * 3. Catch-all segments: "/docs/[...slug]", "/wahl/[shortname]/[...path]"
 *    - [...param] matches any number of segments at that position
 *
 * 4. Recursive wildcards: "/manage//[shortname]", "/wahl//[shortname]//[...path]"
 *    - // acts as a recursive wildcard
 *    - "/manage//[shortname]" matches "/manage", "/manage/org1", "/manage/org1/settings"
 *    - "/wahl//[shortname]//[...path]" matches "/wahl", "/wahl/election1", "/wahl/election1/results/detailed"
 *
 * @param {string} path - The path to check
 * @param {string[]} patterns - Array of patterns to match against
 * @returns {boolean} True if the path matches any of the patterns
 *
 * @example
 * // Returns true
 * matchesNextJsSyntax("/manage/org1", ["/manage/[shortname]"]);
 *
 * @example
 * // Returns true for all of these paths
 * matchesNextJsSyntax("/manage", ["/manage//[shortname]"]);
 * matchesNextJsSyntax("/manage/org1", ["/manage//[shortname]"]);
 * matchesNextJsSyntax("/manage/org1/settings", ["/manage//[shortname]"]);
 */
function matchesNextJsSyntax(path: string, patterns: string[]): boolean {
  // For debugging
  // console.log(`Checking if path "${path}" matches any patterns:`, patterns);

  return patterns.some((pattern) => {
    let isMatch = false;

    // Handle recursive wildcard patterns with //
    if (pattern.includes("//")) {
      // Split the pattern by // to get segments
      const segments = pattern.split("//");
      const baseSegment = segments[0] ?? "";

      // If path exactly matches or starts with the base segment, it's a match
      if (path === baseSegment || path.startsWith(baseSegment + "/")) {
        isMatch = true;
      }

      // For patterns with multiple // segments, check recursively
      else if (segments.length > 2) {
        // Reconstruct remaining pattern after first //
        const remainingPattern = segments.slice(1).join("//");
        // Check if any part of the path after the base segment matches the remaining pattern
        const pathAfterBase = path.substring(baseSegment.length);
        if (pathAfterBase?.startsWith("/")) {
          const pathParts = pathAfterBase.split("/").filter(Boolean);

          // Try matching at each level of the path
          for (let i = 0; i < pathParts.length; i++) {
            const subPath = "/" + pathParts.slice(0, i + 1).join("/");
            // Recursively check if this subpath matches the remaining pattern
            if (matchesNextJsSyntax(subPath, ["/" + remainingPattern])) {
              isMatch = true;
              break;
            }
          }
        }
      }
    }
    // Handle catch-all routes ([...param])
    else if (pattern.includes("[...") && pattern.endsWith("]")) {
      const basePath = pattern.split("[...")[0] ?? "";
      isMatch = path.startsWith(basePath);
    }
    // Handle dynamic segments ([param])
    else if (pattern.includes("[") && pattern.endsWith("]")) {
      const parts = pattern.split("/");
      const pathParts = path.split("/");

      // If the pattern has more parts than the path, it can't match
      if (parts.length > pathParts.length) {
        isMatch = false;
      } else {
        // Assume it matches until proven otherwise
        isMatch = true;

        for (let i = 0; i < parts.length; i++) {
          // Skip dynamic segments as they match anything
          if (parts[i]?.startsWith("[") && parts[i]?.endsWith("]")) {
            continue;
          }
          // If any static segment doesn't match, the whole pattern doesn't match
          if (parts[i] !== pathParts[i]) {
            isMatch = false;
            break;
          }
        }
      }
    }
    // Handle exact matches
    else {
      isMatch = path === pattern;
    }

    // For debugging
    // console.log(`  Pattern "${pattern}" matches: ${isMatch}`);

    return isMatch;
  });
}

export async function handleRouting(
  targetPath: string,
  string = false,
  devModeForceDisable = false,
) {
  const headersList = await getHeaders();
  const host = headersList.host ?? "";
  const dev = devModeForceDisable ? false : await devModeFlag();

  // If in dev mode, always return the target path or redirect to it
  if (dev) {
    if (string) return targetPath;
    redirect(targetPath);
  }

  const shortname = await getShortname();

  // Determine if we're on a catch domain or custom domain
  const isCatchDomain = host.endsWith(".wahl.djl.foundation") || !!shortname;
  const isRootDomain = host === rootDomain || !shortname;

  // For development environment
  const isDevEnvironment =
    host.includes("localhost") || host.includes("vercel.app");

  // console.log({
  // targetPath,
  // host,
  // shortname,
  // isCatchDomain,
  // isRootDomain,
  // isDevEnvironment,
  // });

  // If we're on the root domain
  if (isRootDomain || (isDevEnvironment && !isCatchDomain)) {
    // console.log("Checking if path is allowed on root domain");
    // Check if the target path is not allowed on root domain
    if (matchesNextJsSyntax(targetPath, rootDisallowedPages)) {
      // console.log("Path is not allowed on root domain, returning notFound");
      if (string) return "notFound";
      notFound();
      return;
    }

    // console.log("Path is allowed on root domain, redirecting");
    // Otherwise, allow navigation
    if (string) return targetPath;
    redirect(targetPath);
  }
  // If we're on a catch domain or custom domain
  else if (isCatchDomain || (!isRootDomain && !isDevEnvironment)) {
    // console.log("Checking if path is allowed on catch domain");
    // If the target path is allowed on catch domains, navigate directly
    if (matchesNextJsSyntax(targetPath, allCatchDomainPages)) {
      // console.log("Path is allowed on catch domain, redirecting");
      if (string) return targetPath;
      redirect(targetPath);
    }
    // If the target path is not allowed on catch domains, redirect to root domain
    else {
      // console.log(
      // "Path is not allowed on catch domain, redirecting to root domain",
      // );
      const fullUrl = `https://${rootDomain}${targetPath}`;
      if (string) return fullUrl;
      redirect(fullUrl);
    }
  }
  // Fallback for any other case
  else {
    // console.log("Fallback case, redirecting to target path");
    if (string) return targetPath;
    redirect(targetPath);
  }
}

export async function cleanup() {
  // Check if cleanup is forced off via cookie
  const cookieStore = await cookies();
  const cleanupForceOff =
    cookieStore.get("x-cleanup-force-off")?.value === "true";
  if (cleanupForceOff) {
    return;
  }

  const headersList = await getHeaders();
  const host = headersList.host ?? "";
  const path = await getCurrentPath();
  const dev = await devModeFlag();

  // If in dev mode, always return without doing any cleanup
  if (dev) {
    return;
  }

  const shortname = await getShortname();

  // Determine if we're on a catch domain or custom domain
  const isCatchDomain = host.endsWith(".wahl.djl.foundation") || !!shortname;
  const isRootDomain = host === rootDomain;

  // For development environment
  const isDevEnvironment =
    host.includes("localhost") || host.includes("vercel.app");

  // console.log({
  //   path,
  //   host,
  //   shortname,
  //   isCatchDomain,
  //   isRootDomain,
  //   isDevEnvironment,
  // });

  // If we're on the root domain
  if (isRootDomain || (isDevEnvironment && !isCatchDomain)) {
    // console.log("Checking if current path is allowed on root domain");
    // Check if the current path is not allowed on root domain
    if (matchesNextJsSyntax(path, rootDisallowedPages)) {
      // console.log(
      //   "Current path is not allowed on root domain, returning notFound",
      // );
      notFound();
      return;
    }
  }
  // If we're on a catch domain or custom domain
  else if (isCatchDomain || (!isRootDomain && !isDevEnvironment)) {
    // console.log("Checking if current path is allowed on catch domain");
    // If the current path is not allowed on catch domains, redirect to root domain
    if (!matchesNextJsSyntax(path, allCatchDomainPages)) {
      // console.log(
      //   "Current path is not allowed on catch domain, redirecting to root domain",
      // );
      const fullUrl = `https://${rootDomain}${path}`;
      redirect(fullUrl);
    }
  }

  // If we reach here, the user is where they're supposed to be, so do nothing
  // console.log("User is where they're supposed to be, doing nothing");
  return;
}
