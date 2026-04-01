type ListingRecord = Record<string, any>;

type ListingVisibilityOptions = {
  nowMs?: number;
  excludedListingIds?: Set<string>;
};

const HIDDEN_STATUSES = new Set(['archived', 'deleted', 'rejected']);
const HIDDEN_REPORT_STATUSES = new Set(['approved', 'action_taken', 'pending', 'reviewed']);

export function getTimestampMs(value: any): number | null {
  if (!value) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  if (typeof value === 'object') {
    if (typeof value.toMillis === 'function') {
      const ms = value.toMillis();
      return Number.isFinite(ms) ? ms : null;
    }
    if (typeof value.toDate === 'function') {
      const date = value.toDate();
      const ms = date?.getTime?.();
      return Number.isFinite(ms) ? ms : null;
    }
    if ('seconds' in value && typeof value.seconds === 'number') {
      return value.seconds * 1000;
    }
  }
  return null;
}

export function isListingVisible(
  listing: ListingRecord,
  listingId?: string,
  options: ListingVisibilityOptions = {}
): boolean {
  const nowMs = options.nowMs ?? Date.now();
  const normalizedStatus = String(listing.status || '').toLowerCase();
  const normalizedApprovalStatus = String(listing.approvalStatus || '').toLowerCase();
  const normalizedReportStatus = String(listing.reportStatus || '').toLowerCase();

  if (options.excludedListingIds && listingId && options.excludedListingIds.has(listingId)) {
    return false;
  }

  if (!normalizedStatus || normalizedStatus !== 'approved') {
    return false;
  }

  if (HIDDEN_STATUSES.has(normalizedStatus) || HIDDEN_STATUSES.has(normalizedApprovalStatus)) {
    return false;
  }

  if (HIDDEN_REPORT_STATUSES.has(normalizedReportStatus)) {
    return false;
  }

  if (listing.isActive === false) return false;
  if (listing.isArchived === true || listing.archived === true) return false;
  if (listing.isDeleted === true || listing.deleted === true) return false;
  if (listing.isReported === true) return false;

  const expiresAtMs = getTimestampMs(listing.expiresAt);
  if (expiresAtMs && expiresAtMs <= nowMs) {
    return false;
  }

  const firstImage = Array.isArray(listing.images) ? listing.images[0] : null;
  if (typeof firstImage !== 'string' || !firstImage.trim()) {
    return false;
  }

  return true;
}
