const FORBIDDEN_SEGMENT_CHARS = /[%.#$/\[\]]/g;

// Realtime Database path segments cannot contain . # $ [ ] /.
export const encodeFirebaseKeySegment = (value) =>
  String(value || "")
    .trim()
    .replace(FORBIDDEN_SEGMENT_CHARS, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
