export function getErrorStatus(error: unknown) {
  return typeof error === "object" && error !== null && "status" in error
    ? Number(error.status)
    : 500;
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Server error";
}
