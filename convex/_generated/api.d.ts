/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as aiChat from "../aiChat.js";
import type * as attendance from "../attendance.js";
import type * as auth from "../auth.js";
import type * as calendar from "../calendar.js";
import type * as clerkAuth from "../clerkAuth.js";
import type * as help from "../help.js";
import type * as http from "../http.js";
import type * as qrAttendanceUrl from "../qrAttendanceUrl.js";
import type * as reports from "../reports.js";
import type * as router from "../router.js";
import type * as staff from "../staff.js";
import type * as staffAttendance from "../staffAttendance.js";
import type * as workSettings from "../workSettings.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  aiChat: typeof aiChat;
  attendance: typeof attendance;
  auth: typeof auth;
  calendar: typeof calendar;
  clerkAuth: typeof clerkAuth;
  help: typeof help;
  http: typeof http;
  qrAttendanceUrl: typeof qrAttendanceUrl;
  reports: typeof reports;
  router: typeof router;
  staff: typeof staff;
  staffAttendance: typeof staffAttendance;
  workSettings: typeof workSettings;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
