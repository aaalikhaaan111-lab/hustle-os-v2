/**
 * Three generated applications, written by hand to the contract.
 *
 * They stand in for model output so the runtime can be judged before a paid
 * request is spent, and they are chosen to be as unlike each other as the
 * contract allows: a dense filtering workspace, a navigational dashboard with
 * charts and a validating form, and a scrolling public site with a modal
 * gallery and a pricing toggle.
 *
 * The claim they support is narrow and worth stating exactly: the contract can
 * express three genuinely different applications, and the runtime compiles,
 * isolates and runs them. They say nothing about whether a model will produce
 * work of this quality — only a paid canary answers that.
 */
import { TIMELINE_APP } from "./timeline";
import { DASHBOARD_APP } from "./dashboard";
import { LOCAL_APP } from "./local";

export const APP_FIXTURES = {
  timeline: TIMELINE_APP,
  dashboard: DASHBOARD_APP,
  local: LOCAL_APP,
} as const;

export type AppFixtureId = keyof typeof APP_FIXTURES;
export const APP_FIXTURE_IDS = Object.keys(APP_FIXTURES) as AppFixtureId[];
