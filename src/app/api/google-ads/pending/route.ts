import { assertGoogleAdsScriptAuthorized } from "@/lib/google-ads-script-auth";
import { listPendingGoogleAdsSyncItems } from "@/lib/link-store";
import { getErrorMessage, getErrorStatus } from "@/lib/route-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    assertGoogleAdsScriptAuthorized(request);

    const { searchParams } = new URL(request.url);
    const items = await listPendingGoogleAdsSyncItems({
      customer_id: searchParams.get("customerId") ?? undefined,
    });

    return Response.json(items);
  } catch (error) {
    return Response.json(
      { detail: getErrorMessage(error) },
      { status: getErrorStatus(error) },
    );
  }
}
