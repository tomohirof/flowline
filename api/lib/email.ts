export function buildVerificationUrl(token: string, baseUrl: string): string {
  const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
  return `${cleanBase}/verify?token=${token}`
}

export async function sendVerificationEmail(
  email: string,
  token: string,
  resendApiKey: string,
  baseUrl: string,
): Promise<void> {
  const verifyUrl = buildVerificationUrl(token, baseUrl)

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Flowline <noreply@flowline.pages.dev>',
      to: [email],
      subject: 'Flowline へようこそ！ メールアドレスを確認してください',
      html: buildEmailHtml(email, verifyUrl),
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`メール送信に失敗しました (${res.status}): ${text}`)
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildEmailHtml(email: string, verifyUrl: string): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F0EDF6;font-family:'Helvetica Neue',Arial,sans-serif;">
<div style="display:none;">フロー図を描く準備はできましたか？</div>
<table role="presentation" width="100%" style="background:#F0EDF6;">
<tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="560" style="max-width:560px;width:100%;">
    <tr><td style="background:linear-gradient(135deg,#7C5CFC 0%,#5B8DEF 100%);border-radius:16px 16px 0 0;padding:40px 32px;text-align:center;">
      <h1 style="color:#fff;font-size:28px;margin:0 0 8px;">ようこそ、Flowline へ！</h1>
      <p style="color:rgba(255,255,255,0.85);font-size:15px;margin:0;">${escapeHtml(email)}</p>
    </td></tr>
    <tr><td style="background:#fff;border-radius:0 0 16px 16px;padding:32px;">
      <p style="color:#1a1a2e;font-size:15px;line-height:1.6;margin:0 0 24px;">
        アカウントを有効化するには、下のボタンをクリックしてください。
      </p>
      <table role="presentation" width="100%"><tr><td align="center">
        <a href="${verifyUrl}" style="display:inline-block;background:linear-gradient(135deg,#7C5CFC,#5B8DEF);color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:600;font-size:15px;">
          メールアドレスを確認する
        </a>
      </td></tr></table>
      <p style="color:#9090a8;font-size:13px;margin:24px 0 0;text-align:center;">
        このリンクは24時間有効です。
      </p>
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>`
}
