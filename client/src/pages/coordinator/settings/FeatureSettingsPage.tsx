import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Card, CardContent, CircularProgress, Divider,
  FormControl, FormHelperText, InputAdornment, MenuItem,
  Select, Stack, Switch, TextField, Typography,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import CheckIcon from '@mui/icons-material/Check';
import { useTranslation } from 'react-i18next';
import { m2SettingsApi, type M2FeatureFlags, DEFAULT_FLAGS } from '../../../api/settings';

function SectionTitle({ children }: { children: string }) {
  return (
    <Typography variant="overline" color="text.secondary" fontWeight={600} display="block" mb={0.5}>
      {children}
    </Typography>
  );
}

function SettingRow({
  label, description, checked, onChange,
}: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', py: 1.5 }}>
      <Box sx={{ maxWidth: '75%' }}>
        <Typography variant="body2" fontWeight={500}>{label}</Typography>
        {description && <Typography variant="caption" color="text.secondary">{description}</Typography>}
      </Box>
      <Switch checked={checked} onChange={(e) => onChange(e.target.checked)} size="small" />
    </Box>
  );
}

export default function M2FeatureSettingsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [form, setForm] = useState<M2FeatureFlags>(DEFAULT_FLAGS);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['m2-settings', 'features'],
    queryFn: m2SettingsApi.getFeatures,
  });

  useEffect(() => {
    if (data) setForm({ ...DEFAULT_FLAGS, ...data });
  }, [data]);

  const mutation = useMutation({
    mutationFn: (patch: Partial<M2FeatureFlags>) => m2SettingsApi.updateFeatures(patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['m2-settings', 'features'] });
      setSaved(true); setError('');
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (err: unknown) => {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        t('features.saveError')
      );
    },
  });

  const set = <K extends keyof M2FeatureFlags>(key: K, val: M2FeatureFlags[K]) =>
    setForm((p) => ({ ...p, [key]: val }));

  if (isLoading) return <CircularProgress />;

  return (
    <Box sx={{ maxWidth: 760 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>{t('features.title')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('features.subtitle')}
          </Typography>
        </Box>
        <Button
          variant="contained"
          disabled={mutation.isPending}
          startIcon={saved ? <CheckIcon /> : <SaveIcon />}
          color={saved ? 'success' : 'primary'}
          onClick={() => mutation.mutate(form)}
          sx={{ background: saved ? undefined : 'linear-gradient(135deg, #4c2a85, #7c3aed)' }}
        >
          {mutation.isPending ? '…' : saved ? t('features.saved') : t('features.save')}
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card>
        <CardContent sx={{ p: 3 }}>

          {/* Bewerbung & Rekrutierung */}
          <SectionTitle>BEWERBUNG & REKRUTIERUNG</SectionTitle>
          <Divider sx={{ mb: 1 }} />
          <SettingRow
            label="Öffentliche Bewerbungen erlauben"
            description="Zeigt ein öffentliches 'Jetzt bewerben'-Formular für den Personalpool. Bewerbungen landen in der Koordinator-Warteschlange."
            checked={form.publicApplicationFlow}
            onChange={(v) => set('publicApplicationFlow', v)}
          />
          <SettingRow
            label="Automatische Zuweisung bei Verfügbarkeit"
            description="Wenn sich ein Mitarbeiter für einen Event-Slot als verfügbar markiert, wird er automatisch zugewiesen (keine Koordinatorgenehmigung)."
            checked={form.autoAssignOnAvailability}
            onChange={(v) => set('autoAssignOnAvailability', v)}
          />

          {/* Anwesenheit */}
          <Box mt={3}>
            <SectionTitle>ANWESENHEIT & STUNDENZETTEL</SectionTitle>
            <Divider sx={{ mb: 1 }} />
          </Box>
          <SettingRow
            label="Stundenzettel automatisch freigeben"
            description="Eingereichte Stundenzettel werden sofort finalisiert, ohne Koordinatorgenehmigung. Nur für vertrauenswürdige Mitarbeiter empfohlen."
            checked={form.autoApproveTimesheets}
            onChange={(v) => set('autoApproveTimesheets', v)}
          />
          <SettingRow
            label="Check-in-Foto erforderlich"
            description="Mitarbeiter müssen beim Check-in ein Selfie hochladen, um die physische Anwesenheit zu bestätigen."
            checked={form.requireCheckinPhoto}
            onChange={(v) => set('requireCheckinPhoto', v)}
          />
          <Box py={1.5}>
            <Typography variant="body2" fontWeight={500} mb={0.5}>Dispute-Fenster (Tage)</Typography>
            <TextField
              size="small"
              type="number"
              value={form.disputeWindowDays}
              onChange={(e) => set('disputeWindowDays', Number(e.target.value))}
              inputProps={{ min: 1, max: 90, step: 1 }}
              InputProps={{ endAdornment: <InputAdornment position="end">Tage</InputAdornment> }}
              sx={{ width: 140 }}
              helperText="Tage nach Finalisierung, in denen Mitarbeiter einen Stundenzettel anfechten können."
            />
          </Box>

          {/* Rechnungen & Zahlung */}
          <Box mt={3}>
            <SectionTitle>RECHNUNGEN & ZAHLUNG</SectionTitle>
            <Divider sx={{ mb: 1 }} />
          </Box>
          <SettingRow
            label="Event-Rechnungsstellung aktivieren"
            description="Aktiviert das Rechnungsmodul für EventClient-Abrechnungen. Deaktivieren, wenn Rechnungen über M3 ERP oder extern erstellt werden."
            checked={form.invoicingEnabled}
            onChange={(v) => set('invoicingEnabled', v)}
          />
          {form.invoicingEnabled && (
            <Box py={1.5}>
              <Typography variant="body2" fontWeight={500} mb={0.5}>Zahlungsanbieter</Typography>
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <Select
                  value={form.paymentGateway}
                  onChange={(e) => set('paymentGateway', e.target.value as M2FeatureFlags['paymentGateway'])}
                >
                  <MenuItem value="none">Keiner (manuelle Überweisung)</MenuItem>
                  <MenuItem value="stripe">Stripe (Kartenzahlung)</MenuItem>
                  <MenuItem value="sepa">SEPA-Lastschrift</MenuItem>
                </Select>
                <FormHelperText>Online-Zahlungsverfahren für EventClient-Rechnungen.</FormHelperText>
              </FormControl>
            </Box>
          )}

          {/* Sichtbarkeit & Portale */}
          <Box mt={3}>
            <SectionTitle>SICHTBARKEIT & PORTALE</SectionTitle>
            <Divider sx={{ mb: 1 }} />
          </Box>
          <Box py={1.5}>
            <Typography variant="body2" fontWeight={500} mb={0.5}>Event-Sichtbarkeit (Standard)</Typography>
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <Select
                value={form.defaultEventVisibility}
                onChange={(e) => set('defaultEventVisibility', e.target.value as M2FeatureFlags['defaultEventVisibility'])}
              >
                <MenuItem value="private">Privat (Koordinator weist Personal manuell zu)</MenuItem>
                <MenuItem value="public">Öffentlich (Personal kann sich für offene Slots bewerben)</MenuItem>
              </Select>
              <FormHelperText>Standardsichtbarkeit für neu erstellte Events.</FormHelperText>
            </FormControl>
          </Box>
          <SettingRow
            label="EventClient-Portal aktivieren"
            description="Zeigt ein Kundenportal an, über das Event-Kunden Personalstatus, Stundenzettel und Rechnungen ihrer Events einsehen können."
            checked={form.eventClientPortal}
            onChange={(v) => set('eventClientPortal', v)}
          />
          <SettingRow
            label="Mitarbeiter-Bewertungen nach Events"
            description="Koordinatoren können Event-Mitarbeiter nach jedem Einsatz bewerten. Bewertungen fließen in das Mitarbeiterprofil ein."
            checked={form.staffRatingEnabled}
            onChange={(v) => set('staffRatingEnabled', v)}
          />

        </CardContent>
      </Card>
    </Box>
  );
}
