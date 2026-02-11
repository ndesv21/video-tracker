import { NextRequest, NextResponse } from "next/server";
import { getAllVideos, insertVideo } from "@/lib/db";

export async function GET() {
  try {
    const videos = await getAllVideos();
    return NextResponse.json(videos);
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const video = await request.json();
    await insertVideo(video);
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
