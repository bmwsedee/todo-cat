"use client";

import "@copilotkit/react-core/v2/styles.css";
import {
  CopilotChat,
  CopilotKitProvider,
  type CopilotKitProviderProps,
  UseAgentUpdate,
  useAgent,
} from "@copilotkit/react-core/v2";
import { type ReactNode, useEffect, useState } from "react";
import { LissieEyes } from "@/components/lissie-eyes";
import { FormError } from "@/components/ui/form";

const AGENT_ID = "lissie";

// Mastra memory already holds the conversation, so a run only needs the new message.
const newMessageOnly: CopilotKitProviderProps["messageFilter"] = (messages) =>
  messages.slice(-1);

/** Connects everything below it to Lissie through the CopilotKit runtime at /api/copilotkit. */
export function LissieProvider({ children }: { children: ReactNode }) {
  return (
    <CopilotKitProvider
      runtimeUrl="/api/copilotkit"
      useSingleEndpoint={false}
      agentId={AGENT_ID}
      messageFilter={newMessageOnly}
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
