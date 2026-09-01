import { NextResponse } from "next/server";
import { resolveRedirectBySlug } from "@/lib/link-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const resolved = await resolveRedirectBySlug(slug);
    return NextResponse.redirect(resolved.targetUrl, { status: 307 });
  } catch {
    return NextResponse.redirect(new URL("/", request.url), { status: 307 });
  }
}
