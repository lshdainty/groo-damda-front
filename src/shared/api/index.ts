export {
  apiClient,
  isHttpStatus,
  setToken,
  getToken,
  removeToken,
  hasToken,
  setAuthenticated,
  clearAuthenticated,
  isAuthenticated,
} from "./base";
export type { QuietRequestConfig } from "./base";
export { silentConfig, type SilentOpts } from "./silent-config";

export { hideCardsApi } from "./hideCardsApi";
export {
  REFERENCE_META,
  isReferenceNoticeHeld,
  onReferenceNoticeRelease,
  isReferenceQuery,
  refetchMissingRefs,
  type RefQueryLike,
  useHoldReferenceNotice,
  referenceMeta,
  referenceSilent,
  type ReferenceOpts,
} from "./reference";
