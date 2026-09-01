import { assertDashboardAuthorized } from "@/lib/dashboard-auth";
import { getStats } from "@/lib/link-store";
import { getErrorMessage, getErrorStatus } from "@/lib/route-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await assertDashboardAuthorized(request);
    const stats = await getStats();
    return Response.json(stats);
  } catch (error) {
    return Response.json(
      { detail: getErrorMessage(error) },
      { status: getErrorStatus(error) },
    );
  }
}