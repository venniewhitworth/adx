export function assertSchedulerAuthorized(request: Request) {
  const expectedToken = process.env.REFRESH_SCHEDULER_TOKEN?.trim();
  if (!expectedToken) {
    return;
  }

  const providedToken = request.headers.get("x-refresh-scheduler-token")?.trim();
  if (!providedToken || providedToken !== expectedToken) {
    throw Object.assign(new Error("Unauthorized scheduler request"), { status: 401 });
  }
}
