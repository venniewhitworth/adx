import { assertDashboardAuthorized } from "@/lib/dashboard-auth";
import { createLink, listLinks, parseFiltersFromSearchParams } from "@/lib/link-store";
import { getErrorMessage, getErrorStatus } from "@/lib/route-errors";
import type { AdLinkCreate } from "@/types/ad-link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await assertDashboardAuthorized(request);
    const { searchParams } = new URL(request.url);
    const links = await listLinks(parseFiltersFromSearchParams(searchParams));
    return Response.json(links);
  } catch (error) {
    return Response.json(
      { detail: getErrorMessage(error) },
      { status: getErrorStatus(error) },
    );
  }
}

export async function POST(request: Request) {
  try {
    await assertDashboardAuthorized(request);
    const body = (await request.json()) as AdLinkCreate;
    const link = await createLink(body);
    return Response.json(link, { status: 201 });
  } catch (error) {
    return Response.json(
      { detail: getErrorMessage(error) },
      { status: getErrorStatus(error) },
    );
  }
}