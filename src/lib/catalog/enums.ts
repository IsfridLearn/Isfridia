// Allowed values for comic status and type. Mirrors the database enums.
// No imports, so both the app and the unit tests can use it directly.
export const STATUSES = ["ongoing", "completed", "hiatus", "cancelled"] as const;
export const TYPES = ["manhwa", "manga", "manhua", "webcomic"] as const;
