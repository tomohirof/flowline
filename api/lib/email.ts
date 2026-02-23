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
      from: 'Flowline <flowline@six1.jp>',
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

function formatDateJa(): string {
  const now = new Date()
  return `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`
}

function buildEmailHtml(_email: string, verifyUrl: string): string {
  void escapeHtml
  return `<!DOCTYPE html>
<html lang="ja" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Flowline へようこそ！</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; background-color: #F0EDF6; }
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; padding: 12px !important; }
      .inner { padding: 28px 20px !important; }
      .hero-title { font-size: 26px !important; }
      .step-table { width: 100% !important; }
      .step-cell { display: block !important; width: 100% !important; padding-bottom: 12px !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#F0EDF6; font-family:'Helvetica Neue',Arial,'Hiragino Kaku Gothic ProN','Hiragino Sans',Meiryo,sans-serif;">

<!-- Preheader (hidden text for email preview) -->
<div style="display:none;font-size:1px;color:#F0EDF6;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
  フロー図を描く準備はできましたか？ あなたの業務プロセス、きっと思ってるより複雑です。（でも大丈夫）
</div>

<!-- Outer wrapper -->
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#F0EDF6;">
<tr><td align="center" style="padding:32px 16px;">

  <!-- Main container -->
  <table role="presentation" cellpadding="0" cellspacing="0" width="560" class="container" style="max-width:560px;width:100%;">

    <!-- Logo bar -->
    <tr><td style="padding:0 0 20px;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="font-size:0;">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="width:28px;height:28px;background:linear-gradient(135deg,#7C5CFC,#5B8DEF);border-radius:7px;text-align:center;vertical-align:middle;">
                  <span style="color:#fff;font-size:13px;font-weight:800;line-height:28px;">F</span>
                </td>
                <td style="padding-left:8px;font-size:16px;font-weight:800;color:#1a1a2e;letter-spacing:-0.03em;">Flowline</td>
              </tr>
            </table>
          </td>
          <td align="right" style="font-size:11px;color:#B0ADBA;">
            ${formatDateJa()}
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- Hero card -->
    <tr><td>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(80,60,120,0.06);">

        <!-- Purple header band -->
        <tr><td style="background:linear-gradient(135deg,#7C5CFC 0%,#5B8DEF 100%);padding:40px 40px 36px;" class="inner">
          <!-- Dots decoration -->
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
            <tr>
              <td>
                <span style="display:inline-block;width:6px;height:6px;border-radius:3px;background:#E8985A;margin-right:4px;"></span>
                <span style="display:inline-block;width:6px;height:6px;border-radius:3px;background:#5AC98A;margin-right:4px;"></span>
                <span style="display:inline-block;width:6px;height:6px;border-radius:3px;background:#9B6BC9;margin-right:4px;"></span>
                <span style="display:inline-block;width:6px;height:6px;border-radius:3px;background:rgba(255,255,255,0.3);"></span>
              </td>
            </tr>
          </table>
          <p style="margin:0 0 8px;font-size:13px;color:rgba(255,255,255,0.7);font-weight:600;letter-spacing:0.05em;">WELCOME TO FLOWLINE</p>
          <h1 class="hero-title" style="margin:0 0 12px;font-size:30px;font-weight:800;color:#ffffff;line-height:1.25;letter-spacing:-0.03em;">
            ようこそ。<br>あなたのフロー、<br>お待ちしてました
          </h1>
          <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.8);line-height:1.6;font-weight:400;">
            アカウントの作成が完了しました。<br>
            さっそく業務フローを描きはじめましょう。
          </p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:36px 40px 20px;" class="inner">

          <!-- Witty opener -->
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#FAFAFD;border-radius:12px;border:1px solid #ECECF0;margin-bottom:28px;">
            <tr><td style="padding:20px 24px;">
              <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#7C5CFC;text-transform:uppercase;letter-spacing:0.08em;">💡 豆知識</p>
              <p style="margin:0;font-size:13px;color:#666;line-height:1.65;">
                「完璧な業務フロー」とは、作成した本人が翌朝見直して絶望するまでの、平均12時間の命だと言われています。Flowlineなら、その絶望を「まあ、線は綺麗だからいいか」という小さな満足感に変えられます。
              </p>
            </td></tr>
          </table>

          <!-- CTA Button -->
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:32px;">
            <tr><td align="center">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr><td style="background:linear-gradient(135deg,#7C5CFC,#6246EA);border-radius:12px;padding:15px 40px;text-align:center;">
                  <a href="${verifyUrl}" target="_blank" style="color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;display:inline-block;letter-spacing:-0.01em;">
                    メールを認証して最初のフローを作成する →
                  </a>
                </td></tr>
              </table>
            </td></tr>
          </table>

          <!-- Divider -->
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr><td style="border-bottom:1px solid #F0F0F4;padding-bottom:0;height:1px;font-size:1px;">&nbsp;</td></tr>
          </table>

        </td></tr>

        <!-- 3 Steps -->
        <tr><td style="padding:20px 40px 8px;" class="inner">
          <p style="margin:0 0 20px;font-size:11px;font-weight:700;color:#B0ADBA;text-transform:uppercase;letter-spacing:0.1em;">はじめの3ステップ</p>

          <!-- Step 1 -->
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:20px;">
            <tr>
              <td style="width:44px;vertical-align:top;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr><td style="width:36px;height:36px;background:#FFF4EB;border:1px solid #F0D8C0;border-radius:10px;text-align:center;vertical-align:middle;">
                    <span style="font-size:15px;font-weight:900;color:#E8985A;line-height:36px;">1</span>
                  </td></tr>
                </table>
              </td>
              <td style="padding-left:12px;vertical-align:top;">
                <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#1a1a2e;">レーンを並べる</p>
                <p style="margin:0;font-size:12px;color:#999;line-height:1.5;">「営業部」「システム」「お客様」——関わる人をレーンに。<br>まるで泳ぐ前のコース分け。（泳がなくていいです）</p>
              </td>
            </tr>
          </table>

          <!-- Step 2 -->
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:20px;">
            <tr>
              <td style="width:44px;vertical-align:top;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr><td style="width:36px;height:36px;background:#EEF5FF;border:1px solid #B8D0F0;border-radius:10px;text-align:center;vertical-align:middle;">
                    <span style="font-size:15px;font-weight:900;color:#5B8EC9;line-height:36px;">2</span>
                  </td></tr>
                </table>
              </td>
              <td style="padding-left:12px;vertical-align:top;">
                <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#1a1a2e;">ノードを置く</p>
                <p style="margin:0;font-size:12px;color:#999;line-height:1.5;">セルをクリックするだけ。前のノードに自動接続されます。<br>「あれ、これ誰に渡すんだっけ」が可視化される瞬間。</p>
              </td>
            </tr>
          </table>

          <!-- Step 3 -->
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:8px;">
            <tr>
              <td style="width:44px;vertical-align:top;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr><td style="width:36px;height:36px;background:#F5F0FF;border:1px solid #D0C0F0;border-radius:10px;text-align:center;vertical-align:middle;">
                    <span style="font-size:15px;font-weight:900;color:#9B6BC9;line-height:36px;">3</span>
                  </td></tr>
                </table>
              </td>
              <td style="padding-left:12px;vertical-align:top;">
                <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#1a1a2e;">共有する</p>
                <p style="margin:0;font-size:12px;color:#999;line-height:1.5;">Mermaid記法でエクスポート、ドキュメントに貼り付け。<br>「このフロー図、めっちゃわかりやすい」と言われる快感を。</p>
              </td>
            </tr>
          </table>

        </td></tr>

        <!-- Divider -->
        <tr><td style="padding:12px 40px 0;" class="inner">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr><td style="border-bottom:1px solid #F0F0F4;padding-bottom:0;height:1px;font-size:1px;">&nbsp;</td></tr>
          </table>
        </td></tr>

        <!-- Keyboard shortcuts teaser -->
        <tr><td style="padding:24px 40px 32px;" class="inner">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#1a1a2e;border-radius:12px;overflow:hidden;">
            <tr><td style="padding:24px 28px;">
              <p style="margin:0 0 10px;font-size:11px;font-weight:700;color:#7C5CFC;text-transform:uppercase;letter-spacing:0.08em;">⌨ ショートカット</p>
              <p style="margin:0 0 16px;font-size:13px;color:rgba(255,255,255,0.7);line-height:1.6;">
                マウスだけでも使えますが、キーボード派のあなたへ。
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="padding:6px 0;">
                    <span style="display:inline-block;background:#2A2A3C;border:1px solid #3A3A50;border-radius:5px;padding:3px 10px;font-size:11px;font-weight:700;color:#A78BFA;font-family:'SF Mono','Fira Code',monospace;">⌘Z</span>
                    <span style="font-size:12px;color:rgba(255,255,255,0.5);padding-left:12px;">戻す（何回でも）</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;">
                    <span style="display:inline-block;background:#2A2A3C;border:1px solid #3A3A50;border-radius:5px;padding:3px 10px;font-size:11px;font-weight:700;color:#A78BFA;font-family:'SF Mono','Fira Code',monospace;">⌘⇧Z</span>
                    <span style="font-size:12px;color:rgba(255,255,255,0.5);padding-left:12px;">やり直す（やっぱり戻さない）</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;">
                    <span style="display:inline-block;background:#2A2A3C;border:1px solid #3A3A50;border-radius:5px;padding:3px 10px;font-size:11px;font-weight:700;color:#A78BFA;font-family:'SF Mono','Fira Code',monospace;">Delete</span>
                    <span style="font-size:12px;color:rgba(255,255,255,0.5);padding-left:12px;">選択を削除（さよなら）</span>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </td></tr>

      </table>
    </td></tr>

    <!-- Footer -->
    <tr><td style="padding:24px 8px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
        <tr><td align="center" style="padding-bottom:8px;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width:22px;height:22px;background:linear-gradient(135deg,#7C5CFC,#5B8DEF);border-radius:5px;text-align:center;vertical-align:middle;">
                <span style="color:#fff;font-size:10px;font-weight:800;line-height:22px;">F</span>
              </td>
              <td style="padding-left:6px;font-size:12px;font-weight:700;color:#1a1a2e;letter-spacing:-0.02em;">Flowline</td>
            </tr>
          </table>
        </td></tr>
        <tr><td align="center" style="font-size:11px;color:#B0ADBA;line-height:1.6;padding-bottom:8px;">
          業務フローをもっとシンプルに。
        </td></tr>
        <tr><td align="center" style="font-size:11px;color:#CCCAD4;line-height:1.8;">
          <a href="#" style="color:#999;text-decoration:underline;">ヘルプセンター</a>
          &nbsp;&nbsp;·&nbsp;&nbsp;
          <a href="#" style="color:#999;text-decoration:underline;">プライバシー</a>
          &nbsp;&nbsp;·&nbsp;&nbsp;
          <a href="#" style="color:#999;text-decoration:underline;">配信停止</a>
        </td></tr>
        <tr><td align="center" style="font-size:10px;color:#D8D6E0;padding:12px 0 0;">
          © 2026 Flowline — フローを描く。チームが動く。
        </td></tr>
      </table>
    </td></tr>

  </table>

</td></tr>
</table>

</body>
</html>`
}
