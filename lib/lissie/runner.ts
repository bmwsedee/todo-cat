import "server-only";
import { type BaseEvent, EventType, type Message } from "@ag-ui/core";
import {
  type AgentRunnerConnectRequest,
  InMemoryAgentRunner,
} from "@copilotkit/runtime/v2";
import { from, type Observable, of, switchMap } from "rxjs";

/**
 * CopilotKit's in-memory runner, except that connecting to an idle thread replays the
 * conversation from Mastra memory. The in-memory runner only knows the runs since the
 * process started, so on its own the chat would come back empty after a restart.
 */
export class MastraHistoryRunner extends InMemoryAgentRunner {
  constructor(
    private readonly loadHistory: (threadId: string) => Promise<Message[]>,
  ) {
    super();
  }

  override connect(request: AgentRunnerConnectRequest) {
    // A live run exists only in this process, so attach to it the in-memory way.
    return from(this.isRunning({ threadId: request.threadId })).pipe(
      switchMap((running) =>
        running ? super.connect(request) : this.replay(request.threadId),
      ),
    );
  }

  private replay(threadId: string): Observable<BaseEvent> {
    return from(this.loadHistory(threadId)).pipe(
      switchMap((messages) => {
        const runId = crypto.randomUUID();
        return of<BaseEvent[]>(
          { type: EventType.RUN_STARTED, threadId, runId },
          { type: EventType.MESSAGES_SNAPSHOT, messages },
          { type: EventType.RUN_FINISHED, threadId, runId },
        );
      }),
    );
  }
}
