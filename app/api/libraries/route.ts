import { NextRequest, NextResponse } from "next/server";

const APPKEY = "27cd5b3c12a58afb8fd7cd73ecae7f4c";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  if (!lat || !lng) {
    return NextResponse.json({ error: "lat and lng are required" }, { status: 400 });
  }

  const url = new URL("https://api.calil.jp/library");
  url.searchParams.set("appkey", APPKEY);
  url.searchParams.set("geocode", `${lat},${lng}`);
  url.searchParams.set("limit", "30");
  url.searchParams.set("format", "json");

  try {
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Calil API responded ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to fetch from Calil API" }, { status: 500 });
  }
}
