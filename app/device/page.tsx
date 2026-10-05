import { formatUserCode } from "@todo-cat/contract";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/ui/page-shell";
import { withNext } from "@/lib/next-path";
import { getUserId } from "@/lib/session";
import { DeviceForm } from "./device-form";

export const metadata: Metadata = { title: "Approve a login · todo-cat" };

// Where `todo-cat login` sends its human (see tech-docs/cli.md): a signed-in user approves
// or denies the code the CLI shows. `?user_code=` comes from the CLI's link.
export default async function DevicePage({
  searchParams,
}: PageProps<"/device">) {
  const { user_code } = await searchParams;
  const userCode = typeof user_code === "string" ? user_code : "";
  if (!(await getUserId(await headers()))) {
    const here = userCode
      ? `/device?user_code=${encodeURIComponent(userCode)}`
      : "/device";
    redirect(withNext("/login", here));
  }

  return (
    <PageShell
      title="Logging in from a terminal?"
      lede="The todo-cat CLI showed you a code. Approve it only if you just ran todo-cat login and the code matches."
    >
      <DeviceForm userCode={formatUserCode(userCode)} />
    </PageShell>
  );
}
