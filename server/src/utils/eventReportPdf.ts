import type { IEvent } from '../models/Event';
import type { IEventTimesheet } from '../models/EventTimesheet';

function fmtDate(d: Date) {
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function fmtDateTime(d: Date) {
  return d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function fmtTime(d: Date) {
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}
function eur(n: number) {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  conference: 'Konferenz', concert: 'Konzert', corporate: 'Firmenevent',
  wedding: 'Hochzeit', trade_show: 'Messe', festival: 'Festival',
  sports: 'Sport', other: 'Sonstige',
};

export function buildEventReportHtml(
  event: IEvent,
  timesheets: IEventTimesheet[],
  tenantName: string,
): string {
  const totalHours = timesheets.reduce((s, t) => s + t.totalHours, 0);
  const totalCost = timesheets.reduce((s, t) => s + t.grossPay, 0);
  const totalBilling = timesheets.reduce((s, t) => s + (t.billingRatePerHour ?? t.payRatePerHour) * t.totalHours, 0);

  const rows = timesheets.map(t => `
    <tr>
      <td>${t.staffName}</td>
      <td>${t.positionTitle}</td>
      <td style="white-space:nowrap">${fmtTime(t.plannedStartTime)}&ndash;${fmtTime(t.plannedEndTime)}</td>
      <td style="white-space:nowrap">${t.actualStartTime && t.actualEndTime ? `${fmtTime(t.actualStartTime)}&ndash;${fmtTime(t.actualEndTime)}` : '&mdash;'}</td>
      <td class="num">${t.totalHours.toFixed(2)}</td>
      <td class="num">€&nbsp;${eur(t.payRatePerHour)}</td>
      <td class="num">€&nbsp;${eur(t.grossPay)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; color: #1a1a2e; margin: 0; }
  h1 { font-size: 22px; font-weight: 800; margin: 0 0 4px; color: #0d1b2a; }
  h2 { font-size: 13px; font-weight: 700; margin: 24px 0 8px; color: #0d1b2a; text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
  .header-left h1 { margin-bottom: 2px; }
  .header-right { text-align: right; color: #64748b; font-size: 10px; line-height: 1.6; }
  .badge { display: inline-block; background: #e0f2fe; color: #0369a1; border-radius: 4px; padding: 2px 8px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 4px; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 24px; }
  .meta-card { background: #f8fafc; border-radius: 8px; padding: 12px; }
  .meta-card .label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #94a3b8; margin-bottom: 3px; }
  .meta-card .value { font-size: 13px; font-weight: 700; color: #0d1b2a; }
  .kpi-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
  .kpi { background: #0d1b2a; color: #fff; border-radius: 8px; padding: 14px; }
  .kpi .kpi-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #94a3b8; margin-bottom: 4px; }
  .kpi .kpi-value { font-size: 20px; font-weight: 800; }
  table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
  th { background: #f1f5f9; font-weight: 700; text-align: left; padding: 7px 8px; color: #475569; font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; }
  td { padding: 7px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  tfoot td { font-weight: 700; border-top: 2px solid #e2e8f0; padding-top: 9px; background: #f8fafc; }
  .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 9px; display: flex; justify-content: space-between; }
</style>
</head>
<body>

<div class="header">
  <div class="header-left">
    <div style="font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:.07em;margin-bottom:4px;">${tenantName}</div>
    <h1>${event.name}</h1>
    <span class="badge">${event.eventNumber}</span>
  </div>
  <div class="header-right">
    <strong>Abschlussbericht</strong><br>
    ${event.clientName}<br>
    ${event.venueName ? `${event.venueName}<br>` : ''}
    Erstellt: ${fmtDateTime(new Date())}
  </div>
</div>

<div class="meta-grid">
  <div class="meta-card">
    <div class="label">Beginn</div>
    <div class="value">${fmtDateTime(event.startDate)}</div>
  </div>
  <div class="meta-card">
    <div class="label">Ende</div>
    <div class="value">${fmtDateTime(event.endDate)}</div>
  </div>
  <div class="meta-card">
    <div class="label">Eventtyp</div>
    <div class="value">${EVENT_TYPE_LABELS[event.type] ?? event.type}</div>
  </div>
</div>

<div class="kpi-row">
  <div class="kpi">
    <div class="kpi-label">Eingesetztes Personal</div>
    <div class="kpi-value">${timesheets.length}</div>
  </div>
  <div class="kpi">
    <div class="kpi-label">Gesamtstunden</div>
    <div class="kpi-value">${totalHours.toFixed(2)} h</div>
  </div>
  <div class="kpi">
    <div class="kpi-label">Personalkosten</div>
    <div class="kpi-value">€ ${eur(totalCost)}</div>
  </div>
</div>

<h2>Einsatzübersicht Personal</h2>
<table>
  <thead>
    <tr>
      <th>Mitarbeiter</th>
      <th>Position</th>
      <th>Geplant</th>
      <th>Tatsächlich</th>
      <th class="num">Stunden</th>
      <th class="num">Lohn/h</th>
      <th class="num">Brutto</th>
    </tr>
  </thead>
  <tbody>${rows || '<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:16px">Keine Stundenzettel vorhanden.</td></tr>'}</tbody>
  <tfoot>
    <tr>
      <td colspan="4"><strong>Gesamt</strong></td>
      <td class="num"><strong>${totalHours.toFixed(2)} h</strong></td>
      <td></td>
      <td class="num"><strong>€ ${eur(totalCost)}</strong></td>
    </tr>
  </tfoot>
</table>

${totalBilling > 0 ? `
<div style="margin-top:12px;text-align:right;font-size:11px;color:#475569;">
  Abrechnungsbetrag (Kunde): <strong style="color:#0d1b2a">€ ${eur(totalBilling)}</strong>
</div>` : ''}

<div class="footer">
  <span>${tenantName} &bull; ${event.eventNumber} &bull; ${fmtDate(event.startDate)}</span>
  <span>Vertraulich &bull; Nur zur internen Verwendung</span>
</div>

</body>
</html>`;
}
