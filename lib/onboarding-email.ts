const BRAND_URL = 'https://bookeasy.ro'

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]!)
}

export function buildOnboardingEmail(businessName: string, link: string, mode: 'setup' | 'verify' = 'setup') {
  const name = escapeHtml(businessName)
  const url = escapeHtml(link)
  const verify = mode === 'verify'
  const heading = verify ? 'Confirmă adresa de email' : 'Bun venit pe Bookeasy!'
  const description = verify ? 'Mai ai un singur pas înainte de configurarea afacerii: confirmă că această adresă de email îți aparține.' : 'Setează-ți parola pentru a continua configurarea afacerii și a începe să primești programări online.'
  const action = verify ? 'Confirmă emailul' : 'Setează-ți parola'

  return {
    text: `Salut,\n\n${heading}\n${verify ? description : `Contul pentru ${businessName} este pregătit.`}\n\n${action}:\n${link}\n\nLinkul expiră în 24 de ore.${verify ? ' Dacă nu ai creat tu contul, ignoră acest email.' : ''}\n\nAi nevoie de ajutor? Scrie-ne la contact@bookeasy.ro.\nEchipa Bookeasy\n${BRAND_URL}`,
    html: `<!doctype html>
<html lang="ro">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${heading}</title></head>
<body style="margin:0;padding:0;background-color:#f3f7f7;color:#183b3e;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${heading}. ${description}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f7f7;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background-color:#ffffff;border:1px solid #dce8e8;border-radius:16px;">
        <tr><td align="center" style="padding:32px 24px 24px;border-bottom:1px solid #e8eeee;">
          <a href="${BRAND_URL}" style="text-decoration:none;"><img src="${BRAND_URL}/logo.png" width="156" alt="Bookeasy — programări online" style="display:block;width:156px;max-width:100%;height:auto;border:0;"></a>
        </td></tr>
        <tr><td style="padding:32px 24px;font-size:16px;line-height:1.6;">
          <h1 style="margin:0 0 20px;font-size:26px;line-height:1.3;color:#087f83;">${heading}</h1>
          <p style="margin:0 0 16px;">Salut,</p>
          ${verify ? '' : `<p style="margin:0 0 16px;">Contul pentru <strong>${name}</strong> este pregătit.</p>`}
          <p style="margin:0 0 24px;">${description}</p>
          <table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="#087f83" style="border-radius:8px;mso-padding-alt:14px 24px;">
            <a href="${url}" style="display:inline-block;padding:14px 24px;border:1px solid #087f83;border-radius:8px;color:#ffffff;text-decoration:none;font-size:16px;font-weight:bold;">${action}</a>
          </td></tr></table>
          <p style="margin:20px 0 0;font-size:14px;color:#586e70;">Linkul expiră în 24 de ore.${verify ? ' Dacă nu ai creat tu contul, ignoră acest email.' : ''}</p>
          <p style="margin:24px 0 8px;font-size:13px;color:#586e70;">Dacă butonul nu funcționează, copiază acest link în browser:</p>
          <p style="margin:0;font-size:13px;word-break:break-all;overflow-wrap:anywhere;"><a href="${url}" style="color:#087f83;">${url}</a></p>
        </td></tr>
        <tr><td style="padding:24px;border-top:1px solid #e8eeee;font-size:13px;line-height:1.6;color:#586e70;">
          Ai nevoie de ajutor? <a href="mailto:contact@bookeasy.ro" style="color:#087f83;">contact@bookeasy.ro</a><br>
          Echipa <a href="${BRAND_URL}" style="color:#087f83;text-decoration:none;">Bookeasy</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  }
}
