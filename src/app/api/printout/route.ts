import { NextResponse } from "next/server";
import { getCurrentPath, getHeaders } from "~/server/foundation-router";

export async function GET() {
  const headersObject = await getHeaders();
  const current = await getCurrentPath();
  return NextResponse.json({
    headers: headersObject,
    currentPath: current,
    timestamp: new Date().toISOString(),
  });
}
