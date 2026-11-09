// Domain primitives shared by all entities. No DOM, storage or network here.

export const uid = () => 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// Calendar date in the user's time zone (YYYY-MM-DD), not UTC.
export const localDate = now => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

// A business rule was violated; the message is shown to the user as is.
export class DomainError extends Error {}
export const fail = message => { throw new DomainError(message); };
