import { copilotKitHandler } from "../runtime";

// The runtime routes by path below /api/copilotkit itself. PATCH and DELETE only serve
// thread routes this app rejects anyway, so they are not mounted.
export { copilotKitHandler as GET, copilotKitHandler as POST };
