import LegalPage from './LegalPage';

export default function DatenschutzPage() {
  return (
    <LegalPage title="Datenschutzerklärung">
      <p>
        Wir nehmen den Schutz Ihrer personenbezogenen Daten sehr ernst und behandeln diese
        vertraulich gemäß den gesetzlichen Datenschutzvorschriften (DSGVO, BDSG).
      </p>

      <h2>1. Verantwortlicher (Art. 13 DSGVO)</h2>
      <p>
        <strong>[UNTERNEHMENSNAME] [RECHTSFORM]</strong><br />
        [STRASSE HAUSNUMMER], [PLZ] [ORT]<br />
        E-Mail: <strong>[DATENSCHUTZ-EMAIL]</strong>
      </p>

      <h2>2. Erhobene Daten und Verarbeitungszwecke</h2>
      <ul>
        <li><strong>Stammdaten</strong> (Name, Kontakt) — Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO)</li>
        <li><strong>Zugangsdaten</strong> (E-Mail, gehashtes Passwort) — Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO)</li>
        <li><strong>Veranstaltungs- und Einsatzdaten</strong> (Zeiterfassung, Bewerbungen) — Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO)</li>
        <li><strong>Protokolldaten</strong> (IP-Adresse, Zugriffszeiten) — berechtigtes Interesse / IT-Sicherheit (Art. 6 Abs. 1 lit. f DSGVO)</li>
      </ul>

      <h2>3. Speicherdauer</h2>
      <p>
        Daten werden gelöscht, sobald der Zweck der Verarbeitung entfällt und keine gesetzlichen
        Aufbewahrungspflichten entgegenstehen. Benachrichtigungen werden nach 90 Tagen
        automatisch gelöscht.
      </p>

      <h2>4. Weitergabe an Dritte</h2>
      <p>
        Eine Weitergabe Ihrer Daten an Dritte erfolgt nur im Rahmen der Vertragserfüllung
        (z. B. Weitergabe von Personaldaten an Veranstaltungskunden), bei gesetzlicher
        Verpflichtung oder mit ausdrücklicher Einwilligung.
      </p>

      <h2>5. Ihre Rechte (Art. 15–22 DSGVO)</h2>
      <ul>
        <li>Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17)</li>
        <li>Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20)</li>
        <li>Widerspruch (Art. 21), Widerruf von Einwilligungen (Art. 7 Abs. 3)</li>
      </ul>
      <p>Kontakt: <strong>[DATENSCHUTZ-EMAIL]</strong></p>

      <h2>6. Beschwerderecht bei der Aufsichtsbehörde</h2>
      <p>Zuständige Behörde: <strong>[ZUSTÄNDIGE LANDESBEHÖRDE]</strong></p>

      <h2>7. Datensicherheit</h2>
      <p>
        Passwörter werden ausschließlich als bcrypt-Hash gespeichert.
        Die Datenübertragung erfolgt verschlüsselt via TLS.
        Technisch notwendige Cookies (HttpOnly Refresh-Token) werden eingesetzt;
        kein Tracking oder Marketing-Cookies.
      </p>

      <p><strong>Stand: [DATUM]</strong></p>
    </LegalPage>
  );
}
