import { assertDashboardAuthorized } from "@/lib/dashboard-auth";
import { deleteLink, updateLink } from "@/lib/link-store";
import { getErrorMessage, getErrorStatus } from "@/lib/route-errors";
import type { AdLinkUpdate } from "@/types/ad-link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseId(value: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw Object.assign(new Error("Invalid link ID"), { status: 400 });
  }

  return id;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertDashboardAuthorized(request);
    const { id } = await params;
    const body = (await request.json()) as AdLinkUpdate;
    const link = await updateLink(parseId(id), body);
    return Response.json(link);
  } catch (error) {
    return Response.json(
      { detail: getErrorMessage(error) },
      { status: getErrorStatus(error) },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertDashboardAuthorized(request);
    const { id } = await params;
    await deleteLink(parseId(id));
    return new Response(null, { status: 204 });
  } catch (error) {
    return Response.json(
      { detail: getErrorMessage(error) },
      { status: getErrorStatus(error) },
    );
  }
}