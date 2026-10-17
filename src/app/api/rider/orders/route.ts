import { handle, ok } from "@/server/http";
import { requireRider } from "@/server/riderAuth";
import { riderOrders } from "@/server/services";
export const dynamic = "force-dynamic";
export const GET = handle(async () => ok(await riderOrders((await requireRider()).id)));
