import { refreshDueFinalUrls } from "@/lib/link-store";
import { getErrorMessage, getErrorStatus } from "@/lib/route-errors";
import { assertSchedulerAuthorized } from "@/lib/scheduler-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseLimit(value: string | null) {
  if (!value) {
    return undefined;
  }

  const limit = Number(value);
  if (!Number.isInteger(limit) || limit <= 0) {
    throw Object.assign(new Error("Invalid limit"), { status: 400 });
  }

  return limit;
}

async function handleRequest(request: Request) {
  assertSchedulerAuthorized(request);

  const { searchParams } = new URL(request.url);
  const result = await refreshDueFinalUrls(parseLimit(searchParams.get("limit")));
  return Response.json(result);
}

export async function GET(request: Request) {
  try {
    return await handleRequest(request);
  } catch (error) {
    return Response.json(
      { detail: getErrorMessage(error) },
      { status: getErrorStatus(error) },
    );
  }
}

export async function POST(request: Request) {
  try {
    return await handleRequest(request);
  } catch (error) {
    return Response.json(
      { detail: getErrorMessage(error) },
      { status: getErrorStatus(error) },
    );
  }
}
