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

export async function getShortname() {
  const overwrite = await shortnameOverwrite();
  const headers = await getHeaders();
  if (overwrite) return overwrite;
  if (headers.host !== rootDomain) {
    return null;
  } else {
    const shortname = headers.host.split(".")[0];
    return shortname;
  }
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
  const url = headersObject["x-clerk-clerk-url"];
  const currentPath = url ? new URL(url).pathname : "/";
  return currentPath;
}

const rootDomain = "wahlen.djl.foundation";

const onlyCatchDomainPages = [
  "/page",
  "/[catchoneroute]",
  "/[...catchallfollowing]",
  "/(ignore)",
];

const allowBooth = ["/booth1", "/booth2"];

function matchesNextJsSyntax(path: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    if (pattern.startsWith("[...") && pattern.endsWith("]")) {
      // Match recursive catch-all routes
      const base = pattern.slice(4, -1);
      return path.startsWith(base);
    } else if (pattern.startsWith("[") && pattern.endsWith("]")) {
      // Match single dynamic routes
      const base = pattern.slice(1, -1);
      return path === base || path.startsWith(`${base}/`);
    } else {
      // Match static routes
      return path === pattern;
    }
  });
}

export async function handleRouting(
  targetPath: string,
  string = false,
  overwriteDevModeDisabled = false,
) {
  const headers = await getHeaders();
  const dev = overwriteDevModeDisabled ? false : await devModeFlag();
  const shortname = await getShortname();
  const isCatchDomain =
    shortname?.endsWith(".wahl.djl.foundation") ||
    (headers.host && headers.host.endsWith(".wahl.djl.foundation"));
  const isRootDomain = headers.host === rootDomain;

  if (isRootDomain) {
    if (
      matchesNextJsSyntax(targetPath, onlyCatchDomainPages) &&
      !matchesNextJsSyntax(targetPath, allowBooth)
    ) {
      notFound();
      return;
    }
    if (string) return targetPath;
    redirect(targetPath);
  } else if (isCatchDomain) {
    if (
      !matchesNextJsSyntax(targetPath, onlyCatchDomainPages) &&
      !matchesNextJsSyntax(targetPath, allowBooth)
    ) {
      if (dev) {
        if (string) return targetPath;
        redirect(targetPath);
      } else {
        if (string) return `${rootDomain}${targetPath}`;
        redirect(`${rootDomain}${targetPath}`);
      }
    } else {
      if (string) return targetPath;
      redirect(targetPath);
    }
  } else {
    if (string) return targetPath;
    redirect(targetPath);
  }
}

export async function cleanup() {
  const headers = await getHeaders();
  const path = await getCurrentPath();
  const dev = await devModeFlag();
  const shortname = await getShortname();
  const isCatchDomain =
    shortname?.endsWith(".wahl.djl.foundation") ||
    (headers.host && headers.host.endsWith(".wahl.djl.foundation"));
  const isRootDomain = headers.host === rootDomain;

  if (isRootDomain) {
    if (
      matchesNextJsSyntax(path, onlyCatchDomainPages) &&
      !matchesNextJsSyntax(path, allowBooth)
    ) {
      notFound();
      return;
    }
  } else if (isCatchDomain) {
    if (
      !matchesNextJsSyntax(path, onlyCatchDomainPages) &&
      !matchesNextJsSyntax(path, allowBooth)
    ) {
      if (!dev) {
        const url = new URL(`${rootDomain}${path}`);
        redirect(url.toString());
      }
    }
  }
}
