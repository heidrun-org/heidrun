import { ref } from "vue";

/** A request to open the information card of the status bar section of one quota. */
export type QuotaCardRequest = {
  /** Label of the quota, the same as the label of its status bar section. */
  label: string;
  /** Number of the request: two requests for the same quota are two different requests. */
  count: number;
};

/** The last request to open an information card of a quota, or `null` before the first request. */
export const quotaCardRequest = ref<QuotaCardRequest | null>(null);

let requestCount = 0;

/**
 * Asks the status bar section of a quota to open its information card. The menu of the status item in the macOS menu
 * bar calls this when the user chooses the line of a quota.
 *
 * @param label - The label of the quota.
 */
export function requestQuotaCard(label: string) {
  requestCount += 1;
  quotaCardRequest.value = { label, count: requestCount };
}
