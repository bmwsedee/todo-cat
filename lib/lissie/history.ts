import "server-only";
import {
  A2UI_OPERATIONS_KEY,
  A2UIActivityType,
  tryParseA2UIOperations,
} from "@ag-ui/a2ui-middleware";
import type {
  ActivityMessage,
  AssistantMessage,
  Message,
  ToolMessage,
} from "@ag-ui/core";
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
 * The same messages the chat built live: user text, then for each assistant turn its text
 * and tool calls, each call followed by its result (and the card, for a result with A2UI),
 * and text after a call in a message of its own. Stored ids are the ids the chat already used, so the Mastra bridge recognises
 * them as history on the next run; text after a tool call gets the id the bridge gave it.
 */
export function toChatMessages(stored: MastraDBMessage[]): Message[] {
  return stored.flatMap((message): Message[] => {
    if (message.role === "user") {
      const content = textOf(message);
      return content ? [{ id: message.id, role: "user", content }] : [];
    }
    if (message.role === "assistant") return assistantTurn(message);
    return [];
  });
}

function textOf(message: MastraDBMessage) {
  return message.content.parts
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("");
}

function assistantTurn(message: MastraDBMessage): Message[] {
  const turn: Message[] = [];
  let current: AssistantMessage | undefined;
  let results: (ToolMessage | ActivityMessage)[] = [];
  let segments = 0;

  const flush = () => {
    if (current && (current.content || current.toolCalls?.length))
      turn.push(current, ...results);
    current = undefined;
    results = [];
  };
  const open = () => {
    current = {
      id: segments === 0 ? message.id : continuationId(message.id, segments),
      role: "assistant",
      content: "",
    };
    segments += 1;
    return current;
  };

  for (const part of message.content.parts) {
    if (part.type === "text") {
      // Text after a tool call renders below it, so it starts a message of its own.
      if (current?.toolCalls?.length) flush();
      const segment = current ?? open();
      segment.content += part.text;
    } else if (part.type === "tool-invocation") {
      const call = part.toolInvocation;
      // A call that never got a result would show as running forever.
      if (call.state !== "result" && call.state !== "output-error") continue;
      const segment = current ?? open();
      segment.toolCalls = [
        ...(segment.toolCalls ?? []),
        {
          id: call.toolCallId,
          type: "function",
          function: {
            name: call.toolName,
            arguments: JSON.stringify(call.args ?? {}),
          },
        },
      ];
      results.push({
        id: `${call.toolCallId}-result`,
        role: "tool",
        toolCallId: call.toolCallId,
        content:
          call.state === "result"
            ? JSON.stringify(call.result)
            : (call.errorText ?? "The tool failed"),
        ...(call.state === "output-error" && { error: call.errorText }),
      });
      if (call.state === "result")
        results.push(...a2uiCard(call.toolCallId, call.result));
    }
  }
  flush();
  return turn;
}

/**
 * The card a tool result with A2UI operations painted below it (showProgress), under the id
 * and in the shape the A2UI middleware gave it live; none for any other result.
 */
function a2uiCard(toolCallId: string, result: unknown): ActivityMessage[] {
  const parsed = tryParseA2UIOperations(JSON.stringify(result));
  if (!parsed) return [];
  return [
    {
      id: `a2ui-surface-${toolCallId}`,
      role: "activity",
      activityType: A2UIActivityType,
      content: { [A2UI_OPERATIONS_KEY]: parsed.operations },
    },
  ];
}

// The id @ag-ui/mastra gives the `index`-th run of text after a tool call in a stored turn
// (MastraAgent.continuationMessageId, private there), so a replay matches the live chat.
function continuationId(baseId: string, index: number) {
  return index <= 1 ? `${baseId}-agui-text` : `${baseId}-agui-text-${index}`;
}
