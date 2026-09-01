import { assertDashboardAuthorized } from "@/lib/dashboard-auth";
import { refreshFinalUrl } from "@/lib/link-store";
import { getErrorMessage, getErrorStatus } from "@/lib/route-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseId(value: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw Object.assign(new Error("Invalid campaign link ID"), { status: 400 });
  }

  return id;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertDashboardAuthorized(request);
    const { id } = await params;
    const link = await refreshFinalUrl(parseId(id));
    return Response.json(link);
  } catch (error) {
    return Response.json(
      { detail: getErrorMessage(error) },
      { status: getErrorStatus(error) },
    );
  }
}