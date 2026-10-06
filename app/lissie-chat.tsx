"use client";

import "@copilotkit/react-core/v2/styles.css";
import type { AbstractAgent } from "@ag-ui/client";
import {
  CopilotChat,
  CopilotKitProvider,
  type CopilotKitProviderProps,
  UseAgentUpdate,
  useAgent,
  useRenderTool,
} from "@copilotkit/react-core/v2";
import type { TodoStatus } from "@todo-cat/contract";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import type { ZodType } from "zod";
import { todoCatCatalog } from "@/components/a2ui-catalog";
import { LissieEyes } from "@/components/lissie-eyes";
import { FormError } from "@/components/ui/form";
import { formatDueDate } from "@/lib/due-date";
import {
  addTodoToolInput,
  addTodoToolOutput,
  LIST_CHANGING_TOOLS,
  listTodosToolInput,
  listTodosToolOutput,
  setTodoDoneToolInput,
  setTodoDoneToolOutput,
} from "@/lib/lissie/tool-schemas";

const AGENT_ID = "lissie";

// Mastra memory already holds the conversation, so a run only needs the new message.
const newMessageOnly: CopilotKitProviderProps["messageFilter"] = (messages) =>
  messages.slice(-1);

// Lissie's cards are A2UI her tools return, rendered with our catalog. Nothing generates UI,
// so the catalog's schema and generation guidelines stay out of her context.
const a2ui: CopilotKitProviderProps["a2ui"] = {
  catalog: todoCatCatalog,
  includeSchema: false,
};

/** Connects everything below it to Lissie through the CopilotKit runtime at /api/copilotkit. */
export function LissieProvider({ children }: { children: ReactNode }) {
  return (
    <CopilotKitProvider
      runtimeUrl="/api/copilotkit"
      useSingleEndpoint={false}
      agentId={AGENT_ID}
      messageFilter={newMessageOnly}
      a2ui={a2ui}
      // The runtime only serves Lissie's own routes, so the dev Inspector has nothing to show.
      enableInspector={false}
    >
      {children}
    </CopilotKitProvider>
  );
}

const NoButton = () => null;

/** Lissie's eyes, half-closed while she is answering. */
export function WatchingEyes({ className }: { className?: string }) {
  const { agent } = useAgent({
    agentId: AGENT_ID,
    updates: [UseAgentUpdate.OnRunStatusChanged],
  });
  return <LissieEyes className={className} squint={agent.isRunning} />;
}

/** The conversation with Lissie on the user's one thread. */
export function LissieChat({ threadId }: { threadId: string }) {
  const [failed, setFailed] = useState(false);
  const { agent } = useAgent({
    agentId: AGENT_ID,
    updates: [UseAgentUpdate.OnRunStatusChanged],
  });
  // The next attempt clears the last failure.
  useEffect(() => {
    if (agent.isRunning) setFailed(false);
  }, [agent.isRunning]);
  useRefreshOnListChange(agent);
  useToolCallLines();

  return (
    <div className="flex h-full flex-col">
      <CopilotChat
        className="min-h-0 flex-1"
        threadId={threadId}
        labels={{
          chatInputPlaceholder: "Tell Lissie what needs doing",
          chatDisclaimerText: "",
        }}
        input={{
          // Attachments are off, so the add menu would only be a dead button.
          addMenuButton: NoButton,
          sendButton: { "aria-label": "Send to Lissie" },
        }}
        onError={() => setFailed(true)}
      />
      <div className="px-4 pb-4">
        <FormError>
          {failed && "Lissie couldn't answer that. Send it again in a moment."}
        </FormError>
      </div>
    </div>
  );
}

/**
 * Re-renders the page, and with it the sidebar, as soon as one of Lissie's tools that change
 * the list returns. Live runs only: a replayed history changes nothing.
 */
function useRefreshOnListChange(agent: AbstractAgent) {
  const router = useRouter();
  useEffect(() => {
    const { unsubscribe } = agent.subscribe({
      onToolCallResultEvent: ({ event, messages }) => {
        const call = messages
          .flatMap((message) =>
            message.role === "assistant" ? (message.toolCalls ?? []) : [],
          )
          .find((toolCall) => toolCall.id === event.toolCallId);
        if (call && LIST_CHANGING_TOOLS.has(call.function.name))
          router.refresh();
      },
    });
    return unsubscribe;
  }, [agent, router]);
}

/** One line in the chat for each of Lissie's tool calls, in words rather than JSON. */
function useToolCallLines() {
  useRenderTool(
    {
      name: "listTodos",
      parameters: listTodosToolInput,
      render: ({ status, parameters, result }) => {
        const what = listDescription(parameters.status, parameters.text);
        if (status !== "complete")
          return <ToolCallLine>Checking {what}…</ToolCallLine>;
        const output = parseResult(listTodosToolOutput, result);
        return (
          <ToolCallLine>
            {output
              ? `Checked ${what}: ${countTodos(output.todos.length)}`
              : `Couldn't check ${what}`}
          </ToolCallLine>
        );
      },
    },
    [],
  );
  useRenderTool(
    {
      name: "addTodo",
      parameters: addTodoToolInput,
      render: ({ status, parameters, result }) => {
        if (status !== "complete")
          return (
            <ToolCallLine>
              {parameters.title
                ? `Adding “${parameters.title}”…`
                : "Adding a todo…"}
            </ToolCallLine>
          );
        const todo = parseResult(addTodoToolOutput, result);
        return (
          <ToolCallLine>
            {todo
              ? `Added “${todo.title}”${todo.dueDate ? `, due ${formatDueDate(todo.dueDate)}` : ""}`
              : `Couldn't add “${parameters.title}”`}
          </ToolCallLine>
        );
      },
    },
    [],
  );
  useRenderTool(
    {
      name: "setTodoDone",
      parameters: setTodoDoneToolInput,
      render: ({ status, parameters, result }) => {
        if (status !== "complete")
          return (
            <ToolCallLine>
              {parameters.done === false
                ? "Opening a todo again…"
                : "Marking a todo done…"}
            </ToolCallLine>
          );
        const output = parseResult(setTodoDoneToolOutput, result);
        if (!output || "error" in output)
          return (
            <ToolCallLine>
              {output?.error.code === "todo-not-found"
                ? "Couldn't find that todo"
                : "Couldn't change that todo"}
            </ToolCallLine>
          );
        return (
          <ToolCallLine>
            {output.done
              ? `Marked “${output.title}” done`
              : `Opened “${output.title}” again`}
          </ToolCallLine>
        );
      },
    },
    [],
  );
}

function ToolCallLine({ children }: { children: ReactNode }) {
  return (
    <p className="my-2 border-l-2 border-line pl-3 text-sm text-ink-soft">
      {children}
    </p>
  );
}

function listDescription(status?: TodoStatus, text?: string) {
  const which =
    status === "open"
      ? "your open todos"
      : status === "done"
        ? "your done todos"
        : "your list";
  return text ? `${which} for “${text}”` : which;
}

function countTodos(count: number) {
  if (count === 0) return "nothing there";
  return count === 1 ? "1 todo" : `${count} todos`;
}

/** A tool's result as its output schema describes it, or undefined for anything else, such as an error. */
function parseResult<T>(schema: ZodType<T>, result: string): T | undefined {
  try {
    const parsed = schema.safeParse(JSON.parse(result));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}
