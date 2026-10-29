import type { Rider } from "./types";
/** Riders created by the admin (before the application flow) have no status and count as approved. */
export const riderApproved = (r: Pick<Rider, "status">) => !r.status || r.status === "approved";
