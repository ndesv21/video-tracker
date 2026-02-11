import { NextRequest, NextResponse } from "next/server";
import { getSettingsDb, saveSettingsDb } from "@/lib/db";

export async function GET() {
  try {
    const settings = await getSettingsDb();
    return NextResponse.json(settings);
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const settings = await request.json();
    await saveSettingsDb(settings);
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
