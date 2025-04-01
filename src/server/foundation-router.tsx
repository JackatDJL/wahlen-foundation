"use server";

import { randomUUID } from "crypto";
import { Redirect } from "next";
import { cookies } from "next/headers";
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

export async function handleRouting(currentPath?: string, targetPath?: string) {
  // Build the Header List
  // Check if Root return
  // Check devMode or overwriteInterface !null
  // Check if host is roothost or catchhost
  //
}
