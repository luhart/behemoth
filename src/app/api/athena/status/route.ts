import { NextResponse } from "next/server";

import { AthenaPreviewClient } from "@/lib/athena/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = await new AthenaPreviewClient().connectionStatus();
  return NextResponse.json(status);
}
