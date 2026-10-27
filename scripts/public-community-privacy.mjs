const EMAIL = /[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/gi;
const PHONES = [
  /(?<![\p{L}\p{N}])\+(?:[\s().-]*\d){8,15}(?!\d)/gu,
  /(?<![\p{L}\p{N}])(?:7|8)(?:[\s().-]*\d){10}(?!\d)/gu,
  /(?<![\p{L}\p{N}])9(?:[\s().-]*\d){9}(?!\d)/gu,
  /(?<![\p{L}\p{N}])\d{3}[ -]\d{2}[ -]\d{2}(?!\d)/gu,
];

// Used only by the community projection, never business contacts/catalog DTO.
export function redactCommunityContacts(value, audit = {}) {
  let result = String(value || '').replace(EMAIL, () => { audit.redactedEmails = (audit.redactedEmails || 0) + 1; return ''; });
  for (const pattern of PHONES) result = result.replace(pattern, () => { audit.redactedPhones = (audit.redactedPhones || 0) + 1; return ''; });
  return result;
}
