"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

export interface SearchParams {
  dev?: string;
  shortname?: string;
  [key: string]: string | string[] | undefined;
}

/**
 * Determines if the current environment is in development mode
 */
export async function isDevMode(searchParams: SearchParams): Promise<boolean> {
  return process.env.NODE_ENV === "development" || searchParams.dev === "true";
}

/**
 * Handles routing based on shortname and current route
 * @param searchParams The search parameters from the URL
 * @param currentPath The current path (e.g., from usePathname())
 * @returns An object with the target URL and whether to redirect
 */
export async function handleShortnameRouting(
  searchParams: SearchParams,
  currentPath: string,
): Promise<{ redirectUrl: string | null; shouldRedirect: boolean }> {
  const headerList = await headers();
  const headersObject: Record<string, string> = {};

  headerList.forEach((value: string, key: string) => {
    headersObject[key] = value;
  });

  const shortname = searchParams.shortname;

  // If no shortname, no need to redirect
  if (!shortname) {
    return { redirectUrl: null, shouldRedirect: false };
  }

  // If we're already on the root path, no need to redirect
  if (currentPath === "/") {
    return { redirectUrl: null, shouldRedirect: false };
  }

  const isDev = await isDevMode(searchParams);

  if (isDev) {
    // In dev mode, we keep the shortname as a query parameter
    // but redirect to the root path
    const url = new URL(`https://${headersObject.host}`);
    url.searchParams.set("shortname", shortname);
    if (searchParams.dev === "true") {
      url.searchParams.set("dev", "true");
    }

    return { redirectUrl: url.toString(), shouldRedirect: true };
  } else {
    // In production, redirect to the subdomain's root
    return {
      redirectUrl: `https://${shortname}.wahl.djl.foundation/`,
      shouldRedirect: true,
    };
  }
}

/**
 * Cleans up the URL by removing subdomains of "pr.djl.foundation" and any "shortname" query parameters.
 * This function takes no input and does not return anything—it immediately redirects if cleanup is needed.
 */
export async function cleanup(): Promise<void> {
  const headerList = await headers();
  const headersObject: Record<string, string> = {};
  headerList.forEach((value, key) => {
    headersObject[key] = value;
  });

  const baseDomain = "wahl.djl.foundation";
  const host = headersObject.host ?? "";
  let requiresCleanup = false;

  // Check if the current hostname is a subdomain of the base domain.
  if (host !== baseDomain && host.endsWith(`.${baseDomain}`)) {
    requiresCleanup = true;
  }

  // Retrieve the current URL from the referer header, or fallback to constructing one from the host.
  const referer = headersObject.referer ?? "";
  let currentUrl: URL;
  try {
    currentUrl = new URL(referer || `https://${host}`);
  } catch {
    currentUrl = new URL(`https://${host}`);
  }

  // Remove the "shortname" query parameter if it exists.
  if (currentUrl.searchParams.has("shortname")) {
    requiresCleanup = true;
    currentUrl.searchParams.delete("shortname");
  }

  if (!requiresCleanup) {
    return;
  }

  // Determine the protocol based on the host.
  const protocol =
    host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https";

  // Always redirect to the base domain root.
  const url = new URL("/", `${protocol}://${baseDomain}`);

  // Preserve the "dev" flag if it exists in the current query string.
  if (currentUrl.searchParams.get("dev") === "true") {
    url.searchParams.set("dev", "true");
  }

  // Immediately perform the redirect.
  redirect(url.toString());
  return;
}

/**
 * Generates the correct href for viewing a presentation
 * @param searchParams The current search parameters
 * @param shortname The shortname of the presentation
 * @returns The URL to view the presentation
 */
export async function getViewHref(
  searchParams: SearchParams,
  shortname: string,
): Promise<string> {
  // Abrufen des Host-Headers
  const headerList = await headers();
  const headersObject: Record<string, string> = {};

  headerList.forEach((value: string, key: string) => {
    headersObject[key] = value;
  });
  const host = headersObject.host ?? "";
  const isDev = await isDevMode(searchParams);

  if (isDev) {
    // In dev mode, verwende window.location.origin, da ein Query-Parameter angehängt wird
    const protocol =
      host.includes("localhost") || host.includes("127.0.0.1")
        ? "http"
        : "https";
    const url = new URL("/", `${protocol}://${host}`);
    url.searchParams.set("shortname", shortname);
    if (searchParams.dev === "true") {
      url.searchParams.set("dev", "true");
    }
    return url.toString();
  } else {
    // In production, verwende das Subdomain-Format
    return `https://${shortname}.wahl.djl.foundation/`;
  }
}

/**
 * Generates the correct href for the home page, removing shortname if needed
 * @param searchParams The current search parameters
 * @returns The URL for the home page
 */
export async function getHomeHref(searchParams: SearchParams): Promise<string> {
  const isDev = await isDevMode(searchParams);
  const headerList = await headers();
  const headersObject: Record<string, string> = {};

  headerList.forEach((value: string, key: string) => {
    headersObject[key] = value;
  });
  const host = headersObject.host ?? "wahlen.djl.foundation";

  if (isDev) {
    const protocol =
      host.includes("localhost") || host.includes("127.0.0.1")
        ? "http"
        : "https";
    const url = new URL("/", `${protocol}://${host}`);
    if (searchParams.dev === "true") {
      url.searchParams.set("dev", "true");
    }
    return url.toString();
  } else {
    // In production, always go to the main domain
    return "https://wahlen.djl.foundation/";
  }
}

export async function getLinkHref(
  searchParams: SearchParams,
  href: string,
): Promise<{ resolvedHref: string; prefetch: boolean }> {
  const isDev = await isDevMode(searchParams);
  const headerList = await headers();
  const headersObject: Record<string, string> = {};
  headerList.forEach((value, key) => {
    headersObject[key] = value;
  });
  const currentHost = headersObject.host ?? "";
  const baseDomain = "wahlen.djl.foundation";
  let resolvedHref = href;
  let prefetch = false;

  // Falls href ein relativer Pfad ist, z.B. "/manage"
  if (href.startsWith("/")) {
    if (currentHost === baseDomain) {
      // Wir befinden uns auf der Root-Domain: relative URL beibehalten und prefetch aktivieren
      const protocol =
        currentHost.includes("localhost") || currentHost.includes("127.0.0.1")
          ? "http"
          : "https";
      const url = new URL(href, `${protocol}://${currentHost}`);
      if (isDev && searchParams.dev === "true") {
        url.searchParams.set("dev", "true");
      }
      resolvedHref = url.toString();
      prefetch = true;
    } else {
      // Andernfalls: Immer auf die Root-Domain umstellen und prefetch deaktivieren
      resolvedHref = `https://${baseDomain}${href}`;
      prefetch = false;
    }
  } else {
    // Bei absoluten URLs: Prüfe, ob der Zielhost dem aktuellen Host entspricht
    try {
      const urlObj = new URL(href);
      prefetch = urlObj.host === currentHost;
    } catch (e) {
      console.error("Fehler beim Parsen der URL:", e);
    }
  }

  // Im Dev-Modus: Entferne den "shortname"-Query-Parameter, falls vorhanden
  if (isDev) {
    try {
      const urlObj = new URL(resolvedHref);
      if (urlObj.searchParams.has("shortname")) {
        urlObj.searchParams.delete("shortname");
        resolvedHref = urlObj.toString();
      }
    } catch (e) {
      console.error("Fehler beim Bereinigen der URL im Devmode:", e);
    }
  }

  return { resolvedHref, prefetch };
}
