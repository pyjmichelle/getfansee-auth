/**
 * Route Handler 统一封装：鉴权与错误 JSON
 * 实现位于 lib/server/，此处 re-export 供 app/api 使用。
 */
export {
  withAuth,
  jsonError,
  unauthorized,
  forbidden,
  badRequest,
  serverError,
  sanitizeErrorForClient,
  type ApiErrorBody,
  type WithAuthContext,
  type AuthenticatedRouteHandler,
} from "@/lib/server/route-handler";
