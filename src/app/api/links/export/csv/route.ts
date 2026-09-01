import { assertDashboardAuthorized } from "@/lib/dashboard-auth";
import { exportLinksCsv, parseFiltersFromSearchParams } from "@/lib/link-store";
import { getErrorMessage, getErrorStatus } from "@/lib/route-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await assertDashboardAuthorized(request);
    const { searchParams } = new URL(request.url);
    const csv = await exportLinksCsv(parseFiltersFromSearchParams(searchParams));

    return new Response(`\uFEFF${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="adxkit-links.csv"',
      },
    });
  } catch (error) {
    return Response.json(
      { detail: getErrorMessage(error) },
      { status: getErrorStatus(error) },
    );
  }
}