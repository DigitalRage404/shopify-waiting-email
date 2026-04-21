import nodemailer from 'nodemailer';

const SHOPIFY_STORE  = process.env.SHOPIFY_STORE;
const SHOPIFY_TOKEN  = process.env.SHOPIFY_TOKEN;
const EMAIL_HOST     = process.env.EMAIL_HOST;
const EMAIL_PORT     = parseInt(process.env.EMAIL_PORT || '587');
const EMAIL_USER     = process.env.EMAIL_USER;
const EMAIL_PASS     = process.env.EMAIL_PASS;
const EMAIL_FROM     = process.env.EMAIL_FROM;

// ⚠️ Ersetze diese URL mit der echten Logo-URL aus Shopify Admin → Inhalte → Dateien
const LOGO_URL = 'https://cdn.shopify.com/s/files/1/0885/5738/8105/files/aredo_original_-_transparent_8f7e9545-d571-4cc4-a14b-7236e67a72ec.png?v=1776793189';

const TAG = 'wartezeit-email-gesendet';

function countBusinessDays(from, to) {
  let count = 0;
  const cur = new Date(from);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  while (cur < end) {
    cur.setDate(cur.getDate() + 1);
    const d = cur.getDay();
    if (d !== 0 && d !== 6) count++;
  }
  return count;
}

async function getUnfulfilledOrders() {
  const orders = [];
  let url = `https://${SHOPIFY_STORE}/admin/api/2024-01/orders.json`
          + `?fulfillment_status=unfulfilled&status=open&limit=250`
          + `&fields=id,name,email,created_at,customer,line_items,tags`;

  while (url) {
    const res = await fetch(url, {
      headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN }
    });
    if (!res.ok) throw new Error(`Shopify API Fehler: ${res.status}`);
    const data = await res.json();
    orders.push(...data.orders);
    const link = res.headers.get('Link') || '';
    const next = link.match(/<([^>]+)>;\s*rel="next"/);
    url = next ? next[1] : null;
  }
  return orders;
}

async function addTagToOrder(orderId, existingTags) {
  const newTags = existingTags ? `${existingTags}, ${TAG}` : TAG;
  await fetch(`https://${SHOPIFY_STORE}/admin/api/2024-01/orders/${orderId}.json`, {
    method: 'PUT',
    headers: {
      'X-Shopify-Access-Token': SHOPIFY_TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ order: { id: orderId, tags: newTags } })
  });
}

async function sendEmail(order) {
  const transporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: EMAIL_PORT,
    secure: EMAIL_PORT === 465,
    auth: { user: EMAIL_USER, pass: EMAIL_PASS }
  });

  const salutation = order.customer?.first_name && order.customer?.last_name
    ? `Sehr geehrte/r ${order.customer.first_name} ${order.customer.last_name}`
    : 'Sehr geehrte Damen und Herren';

  const items = order.line_items
    .map(i => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;">${i.name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;">${i.quantity}</td>
      </tr>`)
    .join('');

  const html = `
<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:30px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:4px;overflow:hidden;
                      box-shadow:0 2px 8px rgba(0,0,0,0.07);max-width:600px;width:100%;">

          <!-- Logo Header -->
          <tr>
            <td align="center" style="padding:36px 40px 28px;">
              <img src="${LOGO_URL}" alt="Aredo Exklusive Möbel"
                   style="max-width:160px;height:auto;display:block;" />
            </td>
          </tr>

          <!-- Trennlinie -->
          <tr>
            <td style="padding:0 40px;">
              <div style="border-top:1px solid #e8e8e8;"></div>
            </td>
          </tr>

          <!-- Betreff-Bereich -->
          <tr>
            <td style="padding:32px 40px 0;">
              <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;
                         color:#888;letter-spacing:1px;text-transform:uppercase;">
                Ihre Bestellung ${order.name}
              </p>
              <h1 style="margin:8px 0 0;font-family:Arial,sans-serif;font-size:22px;
                          font-weight:600;color:#555555;">
                Update zu Ihrer Bestellung
              </h1>
            </td>
          </tr>

          <!-- Haupttext -->
          <tr>
            <td style="padding:24px 40px 0;font-family:Arial,sans-serif;
                        font-size:15px;line-height:1.7;color:#444;">
              <p style="margin:0 0 16px;">${salutation},</p>
              <p style="margin:0 0 16px;">
                herzlichen Dank für Ihre Geduld und Ihr Vertrauen in Aredo –
                wir wissen das sehr zu schätzen.
              </p>
              <p style="margin:0 0 16px;">
                Wir freuen uns, Ihnen mitteilen zu dürfen, dass Ihr Artikel bereits
                sorgfältig für den <strong style="color:#555555;">Versand bzw. die Abholung</strong>
                vorbereitet wird. Wir werden Sie in Kürze mit allen weiteren Informationen
                zu Ihrer Lieferung kontaktieren.
              </p>
              <p style="margin:0;">
                Bei Fragen stehen wir Ihnen jederzeit gerne zur Verfügung.
              </p>
            </td>
          </tr>

          <!-- Artikel-Tabelle -->
          <tr>
            <td style="padding:28px 40px 0;">
              <p style="margin:0 0 10px;font-family:Arial,sans-serif;font-size:13px;
                          color:#888;letter-spacing:1px;text-transform:uppercase;">
                Bestellte Artikel
              </p>
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="border:1px solid #e8e8e8;border-radius:4px;
                            font-family:Arial,sans-serif;font-size:14px;color:#444;">
                <thead>
                  <tr style="background:#f8f7f4;">
                    <th style="padding:10px 12px;text-align:left;font-weight:600;
                                color:#555;border-bottom:1px solid #e8e8e8;">Artikel</th>
                    <th style="padding:10px 12px;text-align:center;font-weight:600;
                                color:#555;border-bottom:1px solid #e8e8e8;">Menge</th>
                  </tr>
                </thead>
                <tbody>${items}</tbody>
              </table>
            </td>
          </tr>

          <!-- Trennlinie -->
          <tr>
            <td style="padding:32px 40px 0;">
              <div style="border-top:1px solid #e8e8e8;"></div>
            </td>
          </tr>

          <!-- Signatur -->
          <tr>
            <td style="padding:24px 40px 0;font-family:Arial,sans-serif;
                        font-size:14px;line-height:1.8;color:#444;">
              <p style="margin:0 0 4px;">Freundliche Grüsse</p>
              <p style="margin:0;">
                <strong style="color:#555555;">Edin Elezi</strong><br>
                <span style="color:#888;font-size:13px;">CEO</span>
              </p>
              <p style="margin:12px 0 0;font-size:13px;color:#888;line-height:1.7;">
                Aredo GmbH<br>
                St. Galler-Strasse 188<br>
                8404 Winterthur<br>
                <a href="https://www.aredo.ch"
                   style="color:#555555;text-decoration:none;">www.aredo.ch</a>
              </p>
            </td>
          </tr>

          <!-- Footer Logo -->
          <tr>
            <td align="center" style="padding:28px 40px 36px;">
              <div style="border-top:1px solid #e8e8e8;padding-top:28px;">
                <img src="${LOGO_URL}" alt="Aredo Exklusive Möbel"
                     style="max-width:90px;height:auto;display:block;
                            margin:0 auto;opacity:0.55;" />
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await transporter.sendMail({
    from:    EMAIL_FROM,
    to:      order.email,
    subject: `Ihre Bestellung ${order.name} bei Aredo – kurzes Update`,
    html
  });

  console.log(`✓ Email gesendet an ${order.email} (Bestellung ${order.name})`);
}

async function main() {
  console.log(`Start: ${new Date().toISOString()}`);
  const orders = await getUnfulfilledOrders();
  const today  = new Date();
  let sent = 0;

  for (const order of orders) {
    if (order.tags?.includes(TAG)) continue;
    const days = countBusinessDays(new Date(order.created_at), today);
    if (days >= 7) {
      await sendEmail(order);
      await addTagToOrder(order.id, order.tags);
      sent++;
    }
  }

  console.log(`Fertig: ${orders.length} Bestellungen geprüft, ${sent} Emails gesendet.`);
}

main().catch(err => { console.error(err); process.exit(1); });
