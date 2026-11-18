import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Card, CardContent, TextField, Switch, FormControlLabel,
  Button, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, Alert, InputAdornment, IconButton, Divider,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import RefreshIcon from '@mui/icons-material/Refresh';
import SyncIcon from '@mui/icons-material/Sync';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { useTranslation } from 'react-i18next';
import { integrationsApi, ServiceConnectionInfo } from '../../../api/integrations';

interface PeerCardProps {
  label: string;
  moduleKey: 'm3';
  current: ServiceConnectionInfo | null;
  onSave: (mod: 'm3', url: string, token: string, enabled: boolean) => Promise<void>;
  onTest: (mod: 'm3') => Promise<{ ok: boolean; latencyMs?: number }>;
}

function PeerCard({ label, moduleKey, current, onSave, onTest }: PeerCardProps) {
  const [url, setUrl] = useState(current?.url ?? '');
  const [token, setToken] = useState('');
  const [enabled, setEnabled] = useState(current?.enabled ?? true);
  const [testResult, setTestResult] = useState<{ ok: boolean; latencyMs?: number } | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!url) return;
    setSaving(true);
    try { await onSave(moduleKey, url, token, enabled); } finally { setSaving(false); }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try { setTestResult(await onTest(moduleKey)); } finally { setTesting(false); }
  };

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="subtitle1" fontWeight={600}>{label}</Typography>
          <FormControlLabel
            control={<Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />}
            label="Enabled"
            labelPlacement="start"
          />
        </Box>

        <TextField
          label="URL"
          fullWidth
          size="small"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://m3.yourdomain.com"
          sx={{ mb: 2 }}
        />
        <TextField
          label="Service Token"
          fullWidth
          size="small"
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder={current ? 'Enter new token to update' : 'Paste token from peer module'}
          sx={{ mb: 2 }}
        />

        {current?.lastPingAt && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Last ping: {new Date(current.lastPingAt).toLocaleString()} —{' '}
            {current.lastPingOk ? <span style={{ color: '#2e7d32' }}>OK</span> : <span style={{ color: '#c62828' }}>Failed</span>}
          </Typography>
        )}

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Button variant="contained" size="small" onClick={handleSave} disabled={saving || !url || (!token && !current?.url)}>
            {saving ? <CircularProgress size={16} /> : 'Save'}
          </Button>
          <Button variant="outlined" size="small" onClick={handleTest} disabled={testing || !current?.url}>
            {testing ? <CircularProgress size={16} /> : 'Test Connection'}
          </Button>
          {testResult && (
            <Chip
              icon={testResult.ok ? <CheckCircleIcon /> : <ErrorIcon />}
              label={testResult.ok ? `OK ${testResult.latencyMs}ms` : 'Failed'}
              color={testResult.ok ? 'success' : 'error'}
              size="small"
            />
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

export default function IntegrationsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [syncResult, setSyncResult] = useState<{ timesheets: { ok: number; failed: number }; invoices: { ok: number; failed: number } } | null>(null);

  const syncMutation = useMutation({
    mutationFn: () => integrationsApi.syncNow().then((r) => r.data),
    onSuccess: (result) => { setSyncResult(result); qc.invalidateQueries({ queryKey: ['timesheets'] }); qc.invalidateQueries({ queryKey: ['invoices'] }); },
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['integrations'],
    queryFn: () => integrationsApi.get().then((r) => r.data),
  });

  const regenMutation = useMutation({
    mutationFn: () => integrationsApi.regenerateToken().then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['integrations'] }); setRegenOpen(false); },
  });

  const saveMutation = useMutation({
    mutationFn: (p: { module: 'm3'; url: string; token: string; enabled: boolean }) =>
      integrationsApi.saveConnection(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integrations'] }),
  });

  const handleCopy = () => {
    if (data?.ownServiceToken) {
      navigator.clipboard.writeText(data.ownServiceToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error">Failed to load integration settings.</Alert>;

  return (
    <Box sx={{ maxWidth: 680 }}>
      <Typography variant="h5" fontWeight={700} mb={1}>{t('integrations.title')}</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Connect M2 Events to other OrgX modules. Each module uses a service token to identify your tenant.
      </Typography>

      {/* Own token */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} mb={2}>Your Service Token</Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Share this token with other modules so they can connect to M2 Events.
          </Typography>
          <TextField
            fullWidth
            size="small"
            value={data?.ownServiceToken ?? ''}
            InputProps={{
              readOnly: true,
              sx: { fontFamily: 'monospace', fontSize: 13 },
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={handleCopy} size="small">
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{ mb: 2 }}
          />
          {copied && <Alert severity="success" sx={{ mb: 1 }}>Token copied!</Alert>}
          <Button
            variant="outlined"
            color="warning"
            size="small"
            startIcon={<RefreshIcon />}
            onClick={() => setRegenOpen(true)}
          >
            Regenerate Token
          </Button>
        </CardContent>
      </Card>

      <Divider sx={{ mb: 3 }} />
      <Typography variant="subtitle2" color="text.secondary" mb={2} textTransform="uppercase" letterSpacing={1}>
        Connected Services
      </Typography>

      <PeerCard
        label="ERP (M3)"
        moduleKey="m3"
        current={data?.connectedServices.m3 ?? null}
        onSave={async (mod, url, token, enabled) => { await saveMutation.mutateAsync({ module: mod, url, token, enabled }); }}
        onTest={(mod) => integrationsApi.testConnection(mod).then((r) => r.data)}
      />

      {data?.connectedServices.m3?.enabled && (
        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle2" fontWeight={600} mb={0.5}>Sync-Status</Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>
              {t('integrations.syncDesc')}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={syncMutation.isPending ? <CircularProgress size={14} /> : <SyncIcon />}
                disabled={syncMutation.isPending}
                onClick={() => { setSyncResult(null); syncMutation.mutate(); }}
              >
                Sync Now
              </Button>
              {syncResult && (
                <Alert severity={syncResult.timesheets.failed + syncResult.invoices.failed === 0 ? 'success' : 'warning'} sx={{ py: 0.25, flex: 1 }}>
                  Stundenzettel: {syncResult.timesheets.ok} OK, {syncResult.timesheets.failed} Fehler &nbsp;|&nbsp;
                  Rechnungen: {syncResult.invoices.ok} OK, {syncResult.invoices.failed} Fehler
                </Alert>
              )}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Regenerate confirmation dialog */}
      <Dialog open={regenOpen} onClose={() => setRegenOpen(false)}>
        <DialogTitle>Regenerate Service Token?</DialogTitle>
        <DialogContent>
          <Typography>
            This will invalidate the current token. Any modules connected to M2 using the old token will stop working
            until you update their stored token with the new one.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRegenOpen(false)}>Cancel</Button>
          <Button
            color="warning"
            variant="contained"
            onClick={() => regenMutation.mutate()}
            disabled={regenMutation.isPending}
          >
            {regenMutation.isPending ? <CircularProgress size={16} /> : 'Regenerate'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
