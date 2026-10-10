import { NextResponse } from "next/server";
import { getAssets } from "@/lib/assets";

export const dynamic = "force-dynamic";

export async function GET() {
  const { assets, source } = await getAssets();
  return NextResponse.json({
    assets,
    source,
    configured: Boolean(process.env.OC_API_KEY && process.env.OC_SECRET_KEY)
  });
}
