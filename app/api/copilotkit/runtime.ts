import "server-only";
import { MastraAgent } from "@ag-ui/mastra";
import {
  CopilotRuntime,
  createCopilotRuntimeHandler,
  type RouteInfo,
} from "@copilotkit/runtime/v2";
import { loadLissieHistory } from "@/lib/lissie/history";
import { mastra } from "@/lib/lissie/mastra";
import { MastraHistoryRunner } from "@/lib/lissie/runner";
import { lissieThreadId } from "@/lib/lissie/thread";
import { getUserId } from "@/lib/session";

export const LISSIE_AGENT_ID = "lissie";

const runtime = new CopilotRuntime({
  // Per request, so Mastra memory is scoped to the caller: resource = user id.
  agents: async ({ request }) =>
    MastraAgent.getLocalAgents({
      mastra,
      resourceId: await requireUserId(request),
    }),
  runner: new MastraHistoryRunner(loadLissieHistory),
});

/**
 * The CopilotKit runtime over AG-UI, with authorization in front of every route it serves:
 * no session is 401, and only runtime info and Lissie's run, connect and stop on the
 * caller's own thread get through. Everything else, including the in-memory runner's
 * `/threads` routes (which would list, read and clear every user's threads), is 404.
 */
export const copilotKitHandler = createCopilotRuntimeHandler({
  runtime,
  basePath: "/api/copilotkit",
  hooks: {
    // Runs before routing, on every request.
    onRequest: async ({ request }) => {
      await requireUserId(request);
    },
    onBeforeHandler: async ({ request, route }) => {
      if (route.method === "info") return;
      const ownThread = lissieThreadId(await requireUserId(request));
      if ((await requestedThread(request, route)) !== ownThread) {
        throw reject(404, "Lissie only talks to you in your own thread.");
      }
    },
  },
});

/** The Lissie thread a request addresses, or undefined for any route this app does not serve. */
async function requestedThread(request: Request, route: RouteInfo) {
  switch (route.method) {
    case "agent/stop":
      return route.agentId === LISSIE_AGENT_ID ? route.threadId : undefined;
    case "agent/run":
    case "agent/connect": {
      if (route.agentId !== LISSIE_AGENT_ID) return undefined;
      // These carry the thread in the body; clone it, the handler still reads it.
      const body: unknown = await request
        .clone()
        .json()
        .catch(() => undefined);
      return body && typeof body === "object" && "threadId" in body
        ? body.threadId
        : undefined;
    }
    default:
      return undefined;
  }
}

async function requireUserId(request: Request) {
  const userId = await getUserId(request.headers);
  if (!userId) throw reject(401, "Sign in to talk to Lissie.");
  return userId;
}

// The runtime turns a thrown Response into the reply.
function reject(status: 401 | 404, message: string) {
  return Response.json(
    { error: status === 401 ? "unauthorized" : "not-found", message },
    { status },
  );
}
