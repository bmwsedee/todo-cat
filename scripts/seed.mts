// Seeds the dev database with a demo user and a dozen todos from the last two weeks.
// `npm run db:seed` migrates first and runs this with tsx under the `react-server` condition,
// so `server-only` resolves to its empty build. Rerunning it gives the same user and list
// (the todos get new ids). Todos go through the service like any other caller.
// @next/env is CommonJS, so Node only offers it as a default import.
import nextEnv from "@next/env";
import { eq } from "drizzle-orm";

nextEnv.loadEnvConfig(process.cwd());

// lib/db.ts reads DATABASE_URL on import, so these load after .env.
const { auth } = await import("@/lib/auth");
const { db } = await import("@/lib/db");
const { user } = await import("@/lib/schema");
const { addTodo, deleteTodo, listTodos, updateTodo } = await import(
  "@/lib/todo-service"
);

const demo = {
  name: "Demo",
  email: "demo@todo-cat.dev",
  password: "cat-person-2026",
};

// Offsets are days relative to today (UTC), so the list always looks recent.
// `created` and `done` are [days ago, hour]; `due` is days from today.
type Fixture = {
  title: string;
  created: [number, number];
  due?: number;
  done?: [number, number];
};
const fixtures: Fixture[] = [
  {
    title: "Book Lissie's yearly check-up at the vet",
    created: [14, 9],
    due: -10,
    done: [11, 16],
  },
  {
    title: "Buy the good tuna, not the cheap one",
    created: [13, 18],
    done: [13, 19],
  },
  { title: "Replace the shredded scratching post", created: [12, 20], due: 3 },
  { title: "Renew passport", created: [11, 8], due: 21 },
  {
    title: "Call the landlord about the dripping tap",
    created: [10, 12],
    done: [7, 10],
  },
  { title: "Pay the electricity bill", created: [9, 19], due: -1 },
  { title: "Finish the quarterly report", created: [8, 9], due: 2 },
  { title: "Clean out the fridge", created: [6, 21], done: [2, 11] },
  { title: "Plan Saturday's hike", created: [5, 13] },
  { title: "Return the library books", created: [4, 17], due: 0 },
  {
    title: "Order a new phone case",
    created: [3, 10],
    due: 5,
    done: [1, 15],
  },
  { title: "Stop feeding Lissie at 5 a.m.", created: [1, 7] },
  { title: "Back up the laptop", created: [1, 22], due: 7 },
];

const DAY = 24 * 60 * 60 * 1000;
const today = new Date().setUTCHours(0, 0, 0, 0);
const at = ([daysAgo, hour]: [number, number]) =>
  new Date(today - daysAgo * DAY + hour * 60 * 60 * 1000);
const dueIn = (days: number) =>
  new Date(today + days * DAY).toISOString().slice(0, 10);

async function demoUserId() {
  const [existing] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, demo.email));
  if (!existing) {
    const { user: created } = await auth.api.signUpEmail({ body: demo });
    return created.id;
  }
  // Undo any changes made while trying the app, so every run ends in the same state.
  const ctx = await auth.$context;
  await ctx.internalAdapter.updateUser(existing.id, { name: demo.name });
  await ctx.internalAdapter.updatePassword(
    existing.id,
    await ctx.password.hash(demo.password),
  );
  return existing.id;
}

const userId = await demoUserId();

for (const todo of await listTodos(userId)) {
  await deleteTodo(userId, todo.id);
}
for (const fixture of fixtures) {
  const todo = await addTodo(
    userId,
    {
      title: fixture.title,
      dueDate: fixture.due === undefined ? null : dueIn(fixture.due),
    },
    at(fixture.created),
  );
  if (fixture.done) {
    await updateTodo(userId, todo.id, { done: true }, at(fixture.done));
  }
}

db.$client.close();
console.log(
  `Seeded ${demo.email} (password ${demo.password}) with ${fixtures.length} todos`,
);
