import { assertGoogleAdsScriptAuthorized } from "@/lib/google-ads-script-auth";
import { reportGoogleAdsSyncResult } from "@/lib/link-store";
import { getErrorMessage, getErrorStatus } from "@/lib/route-errors";
import type { GoogleAdsSyncReport } from "@/types/ad-link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertGoogleAdsScriptAuthorized(request);

    const body = (await request.json()) as GoogleAdsSyncReport;
    const link = await reportGoogleAdsSyncResult(body);
    return Response.json(link);
  } catch (error) {
    return Response.json(
      { detail: getErrorMessage(error) },
      { status: getErrorStatus(error) },
    );
  }
}
