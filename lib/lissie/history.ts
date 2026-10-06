import "server-only";
import type { Message } from "@ag-ui/core";
import type { MastraDBMessage } from "@mastra/core/agent";
import { mastra } from "@/lib/lissie/mastra";

/** The thread's stored conversation as chat messages, or none when the thread does not exist yet. */
export async function loadLissieHistory(threadId: string): Promise<Message[]> {
  const memory = await mastra.getAgent("lissie").getMemory();
  if (!memory) throw new Error("Lissie has no memory configured");

  const thread = await memory.getThreadById({ threadId });
  if (!thread) return [];
  const { messages } = await memory.recall({
    threadId,
    resourceId: thread.resourceId,
    perPage: false,
  });
  return toChatMessages(messages);
}

/**
 * Keeps the text of user and assistant messages under their stored ids, which are the ids
 * the chat already used, so the Mastra bridge recognises them as history on the next run.
 * Lissie has no tools yet; once she does, tool calls need converting here too.
 */
export function toChatMessages(stored: MastraDBMessage[]): Message[] {
  return stored.flatMap((message): Message[] => {
    if (message.role !== "user" && message.role !== "assistant") return [];
    const content = message.content.parts
      .flatMap((part) => (part.type === "text" ? [part.text] : []))
      .join("");
    if (!content) return [];
    return [{ id: message.id, role: message.role, content }];
  });
}
