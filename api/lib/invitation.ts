export const CODE_CHARSET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
export const CODE_LENGTH = 8

export function normalizeInvitationCode(input: string): string {
  return input.toUpperCase().replace(/\s/g, '')
}

export function generateInvitationCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_CHARSET[bytes[i] % CODE_CHARSET.length]
  }
  return out
}

export async function validateInvitationCode(
  db: D1Database,
  code: string,
): Promise<boolean> {
  const normalized = normalizeInvitationCode(code)
  if (!normalized) return false
  const row = await db
    .prepare(
      `SELECT id FROM invitation_codes
       WHERE code = ?
         AND revoked_at IS NULL
         AND datetime(expires_at) > datetime('now')`,
    )
    .bind(normalized)
    .first<{ id: number }>()
  return row != null
}
