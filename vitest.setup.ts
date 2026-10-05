import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Testing Library only unmounts automatically when test globals are enabled, which they are not here.
afterEach(cleanup);
