import LegalPage from './LegalPage';

export default function AgbPage() {
  return (
    <LegalPage title="Allgemeine Geschäftsbedingungen (AGB)">
      <p>
        Diese AGB gelten für die Nutzung der OrgX Event-Staffing-Plattform (Modul M2) zwischen
        <strong> [UNTERNEHMENSNAME] [RECHTSFORM]</strong> (Anbieter) und dem nutzenden
        Unternehmen (Kunde). Ausschließlich B2B-Angebot.
      </p>

      <h2>§ 1 Vertragsgegenstand</h2>
      <p>
        Der Anbieter stellt eine cloudbasierte Plattform für die Verwaltung von
        Veranstaltungspersonal zur Verfügung (Eventplanung, Personalvermittlung, Zeiterfassung,
        Rechnungsstellung).
      </p>

      <h2>§ 2 Nutzungsrechte</h2>
      <p>
        Der Kunde erhält ein nicht übertragbares, nicht exklusives Nutzungsrecht für eigene
        betriebliche Zwecke. Zugangsdaten dürfen nicht an Dritte außerhalb der Organisation
        weitergegeben werden.
      </p>

      <h2>§ 3 Pflichten des Kunden</h2>
      <ul>
        <li>Zugangsdaten sicher aufbewahren</li>
        <li>Keine missbräuchliche Nutzung der Plattform</li>
        <li>Richtige Angaben zu Unternehmen und Mitarbeitern machen</li>
        <li>Geltende datenschutzrechtliche Verpflichtungen einhalten</li>
      </ul>

      <h2>§ 4 Vergütung</h2>
      <p>
        Die Vergütung richtet sich nach dem gültigen Preisblatt. Rechnungen sind innerhalb von
        14 Tagen ohne Abzug zu begleichen. Bei Zahlungsverzug kann der Zugang gesperrt werden.
      </p>

      <h2>§ 5 Datenschutz</h2>
      <p>
        Soweit personenbezogene Daten im Auftrag verarbeitet werden, schließen die Parteien
        einen Auftragsverarbeitungsvertrag (AVV) gemäß Art. 28 DSGVO ab.
      </p>

      <h2>§ 6 Haftung</h2>
      <p>
        Unbeschränkte Haftung bei Vorsatz, grober Fahrlässigkeit und Personenschäden.
        Bei leichter Fahrlässigkeit nur bei Verletzung wesentlicher Vertragspflichten, begrenzt
        auf den vorhersehbaren Schaden. Weitergehende Haftung ausgeschlossen.
      </p>

      <h2>§ 7 Laufzeit und Kündigung</h2>
      <p>
        Kündigung mit [X Wochen/Monaten] Frist zum Monatsende. Nach Vertragsende werden
        Kundendaten innerhalb von [30 Tagen] gelöscht, sofern keine Aufbewahrungspflichten
        entgegenstehen.
      </p>

      <h2>§ 8 Schlussbestimmungen</h2>
      <p>
        Deutsches Recht. Gerichtsstand: <strong>[GERICHTSSTAND]</strong>.
        Salvatorische Klausel gilt.
      </p>

      <p><strong>Stand: [DATUM]</strong></p>
    </LegalPage>
  );
}
