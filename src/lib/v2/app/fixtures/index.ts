/**
 * Four generated applications, written by hand to the contract.
 *
 * They stand in for model output so the runtime can be judged before a paid
 * request is spent, and they are chosen to be as unlike each other as the
 * contract allows: a dense filtering workspace, a navigational dashboard with
 * charts and a validating form, a scrolling public site with a modal gallery
 * and a pricing toggle, and an application with real client-side routes.
 *
 * The claim they support is narrow and worth stating exactly: the contract can
 * express four genuinely different applications, and the runtime compiles,
 * isolates and runs them. They say nothing about whether a model will produce
 * work of this quality — only a paid canary answers that.
 *
 * `router` is the newest and was added for a reason worth keeping in view: the
 * first three navigate with anchors and state, so none of them imported
 * `react-router-dom`, and the runtime's inability to run a routed application
 * inside an opaque-origin `srcdoc` document reached beta three times without a
 * single test noticing. A fixture set that avoids the hard library is not a
 * fixture set.
 */
import { TIMELINE_APP } from "./timeline";
import { DASHBOARD_APP } from "./dashboard";
import { LOCAL_APP } from "./local";
import { ROUTER_APP } from "./router";

export const APP_FIXTURES = {
  timeline: TIMELINE_APP,
  dashboard: DASHBOARD_APP,
  local: LOCAL_APP,
  router: ROUTER_APP,
} as const;

export type AppFixtureId = keyof typeof APP_FIXTURES;
export const APP_FIXTURE_IDS = Object.keys(APP_FIXTURES) as AppFixtureId[];
