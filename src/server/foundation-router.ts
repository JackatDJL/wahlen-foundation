"use server";

import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
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

const catchPathsRegex = new RegExp(`^(\/|\/wahl\/.*)$`);

export async function handleRouting(
  targetPath: string,
  string: boolean = false,
) {
  const headers = await getHeaders();
  const dev = await devModeFlag();
  const shortname = await shortnameOverwrite();

  if (dev || shortname) {
    if (string) return targetPath;
    redirect(targetPath);
  } else {
    if (headers.host !== rootDomain) {
      if (targetPath !== catchPathsRegex.source) {
        if (string) return rootDomain + targetPath;
        redirect(rootDomain + targetPath);
      } else {
        if (string) return headers.host + targetPath;
        redirect(headers.host + targetPath);
      }
    } else {
      if (string) return targetPath;
      redirect(targetPath);
    }
  }
}

export async function cleanup() {
  const path = await getCurrentPath();
  const dev = await devModeFlag();
  const shortname = await shortnameOverwrite();

  if (catchPathsRegex.test(path)) {
    if (dev || shortname) {
      return;
    } else {
      const url = new URL(`https://${rootDomain}/${path}`);
      redirect(url.toString());
    }
  }
}
