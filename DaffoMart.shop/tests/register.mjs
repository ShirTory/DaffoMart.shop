// Registers the module-resolution hooks used by the test suite (see tests/hooks.mjs). No third-party dependencies.
import { register } from "node:module";
register("./hooks.mjs", import.meta.url);
