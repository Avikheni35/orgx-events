import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Collapse, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, IconButton, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, TextField, Typography, FormControlLabel, Checkbox, MenuItem, Select,
  FormControl, InputLabel,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useTranslation } from 'react-i18next';
import { eventTemplatesApi, EventTemplate, TemplatePosition, CreateTemplatePayload } from '../../../api/eventTemplates';

const EVENT_TYPES = ['conference', 'concert', 'corporate', 'wedding', 'trade_show', 'festival', 'sports', 'other'] as const;
const EVENT_TYPE_LABEL: Record<string, string> = {
  conference: 'Konferenz', concert: 'Konzert', corporate: 'Firmenevent', wedding: 'Hochzeit',
  trade_show: 'Messe', festival: 'Festival', sports: 'Sport', other: 'Sonstiges',
};

const EMPTY_POSITION: TemplatePosition = {
  title: '', roleType: '', headcount: 1, skills: [], payRatePerHour: 0,
  billingRatePerHour: undefined, dresscode: '', notes: '', durationHours: 8, breakMinutes: 30,
};

function emptyForm(): CreateTemplatePayload {
  return { name: '', type: 'corporate', description: '', requiresClientApproval: false, positions: [] };
}

export default function EventTemplatesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: templates, isLoading } = useQuery({
    queryKey: ['event-templates'],
    queryFn: () => eventTemplatesApi.list().then((r) => r.data),
  });

  const [expanded, setExpanded] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateTemplatePayload>(emptyForm());
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const saveMutation = useMutation({
    mutationFn: () => editId
      ? eventTemplatesApi.update(editId, form).then((r) => r.data)
      : eventTemplatesApi.create(form).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event-templates'] });
      setDialogOpen(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => eventTemplatesApi.delete(id).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event-templates'] });
      setDeleteId(null);
    },
  });

  const openCreate = () => { setEditId(null); setForm(emptyForm()); setDialogOpen(true); };
  const openEdit = (tpl: EventTemplate) => {
    setEditId(tpl._id);
    setForm({
      name: tpl.name, type: tpl.type as CreateTemplatePayload['type'],
      description: tpl.description ?? '',
      requiresClientApproval: tpl.requiresClientApproval,
      positions: tpl.positions.map((p) => ({ ...p })),
    });
    setDialogOpen(true);
  };

  const addPosition = () => setForm((f) => ({ ...f, positions: [...f.positions, { ...EMPTY_POSITION }] }));
  const removePosition = (i: number) => setForm((f) => ({ ...f, positions: f.positions.filter((_, idx) => idx !== i) }));
  const updatePosition = (i: number, field: keyof TemplatePosition, value: unknown) =>
    setForm((f) => {
      const positions = [...f.positions];
      positions[i] = { ...positions[i], [field]: value };
      return { ...f, positions };
    });

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>{t('templates.title')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('templates.subtitle')}
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>{t('templates.new')}</Button>
      </Stack>

      {saved && <Alert severity="success" sx={{ mb: 2 }}>{t('templates.saved')}</Alert>}

      {isLoading && <CircularProgress />}

      {!isLoading && (!templates || templates.length === 0) && (
        <Card sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">{t('templates.noTemplates')}</Typography>
        </Card>
      )}

      <Stack spacing={2}>
        {(templates ?? []).map((tpl) => (
          <Card key={tpl._id} variant="outlined">
            <Stack
              direction="row" alignItems="center" justifyContent="space-between"
              sx={{ px: 2, py: 1.5, cursor: 'pointer' }}
              onClick={() => setExpanded(expanded === tpl._id ? null : tpl._id)}
            >
              <Stack direction="row" spacing={2} alignItems="center">
                <Typography fontWeight={600}>{tpl.name}</Typography>
                <Chip label={EVENT_TYPE_LABEL[tpl.type] ?? tpl.type} size="small" variant="outlined" />
                <Chip label={`${tpl.positions.length} Position(en)`} size="small" color="primary" variant="outlined" />
              </Stack>
              <Stack direction="row" spacing={0.5} onClick={(e) => e.stopPropagation()}>
                <IconButton size="small" onClick={() => openEdit(tpl)}><EditIcon fontSize="small" /></IconButton>
                <IconButton size="small" color="error" onClick={() => setDeleteId(tpl._id)}><DeleteIcon fontSize="small" /></IconButton>
                <IconButton size="small">{expanded === tpl._id ? <ExpandLessIcon /> : <ExpandMoreIcon />}</IconButton>
              </Stack>
            </Stack>
            <Collapse in={expanded === tpl._id}>
              <Divider />
              <Box sx={{ p: 2 }}>
                {tpl.description && <Typography variant="body2" color="text.secondary" mb={1}>{tpl.description}</Typography>}
                {tpl.positions.length === 0 && <Typography variant="body2" color="text.secondary">{t('templates.noPositions')}</Typography>}
                {tpl.positions.length > 0 && (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>{t('events.positionTitle')}</TableCell>
                        <TableCell align="right">{t('events.headcount')}</TableCell>
                        <TableCell align="right">{t('templates.duration')}</TableCell>
                        <TableCell align="right">{t('events.payRateHour')}</TableCell>
                        <TableCell>{t('staff.skills')}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {tpl.positions.map((p, i) => (
                        <TableRow key={i}>
                          <TableCell><strong>{p.title}</strong>{p.roleType ? ` (${p.roleType})` : ''}</TableCell>
                          <TableCell align="right">{p.headcount}</TableCell>
                          <TableCell align="right">{p.durationHours}h</TableCell>
                          <TableCell align="right">{p.payRatePerHour.toFixed(2)} €</TableCell>
                          <TableCell>{p.skills.join(', ') || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Box>
            </Collapse>
          </Card>
        ))}
      </Stack>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editId ? t('templates.editTemplate') : t('templates.new')}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label={t('common.name')}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                fullWidth
              />
              <FormControl sx={{ minWidth: 180 }}>
                <InputLabel>{t('events.type')}</InputLabel>
                <Select
                  label={t('events.type')}
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as CreateTemplatePayload['type'] }))}
                >
                  {EVENT_TYPES.map((et) => <MenuItem key={et} value={et}>{t(`templates.types.${et}`, { defaultValue: EVENT_TYPE_LABEL[et] })}</MenuItem>)}
                </Select>
              </FormControl>
            </Stack>
            <TextField
              label={t('common.description')}
              value={form.description ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              multiline
              rows={2}
              fullWidth
            />
            <FormControlLabel
              control={<Checkbox checked={form.requiresClientApproval} onChange={(e) => setForm((f) => ({ ...f, requiresClientApproval: e.target.checked }))} />}
              label={t('events.clientApproval')}
            />
            <Divider />
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle1" fontWeight={600}>{t('events.positions')}</Typography>
              <Button size="small" startIcon={<AddIcon />} onClick={addPosition}>{t('events.addPosition')}</Button>
            </Stack>
            {form.positions.map((pos, i) => (
              <Card key={i} variant="outlined" sx={{ p: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="subtitle2">{t('events.positionTitle')} {i + 1}</Typography>
                  <IconButton size="small" color="error" onClick={() => removePosition(i)}><DeleteIcon fontSize="small" /></IconButton>
                </Stack>
                <Stack spacing={2}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <TextField label={t('events.posTitle')} value={pos.title} onChange={(e) => updatePosition(i, 'title', e.target.value)} required fullWidth />
                    <TextField label={t('events.roleType')} value={pos.roleType ?? ''} onChange={(e) => updatePosition(i, 'roleType', e.target.value)} fullWidth />
                  </Stack>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <TextField label={t('events.headcount')} type="number" value={pos.headcount} onChange={(e) => updatePosition(i, 'headcount', Number(e.target.value))} inputProps={{ min: 1 }} sx={{ width: 120 }} />
                    <TextField label={t('templates.durationH')} type="number" value={pos.durationHours} onChange={(e) => updatePosition(i, 'durationHours', Number(e.target.value))} inputProps={{ min: 0.5, step: 0.5 }} sx={{ width: 120 }} />
                    <TextField label={t('templates.breakMin')} type="number" value={pos.breakMinutes} onChange={(e) => updatePosition(i, 'breakMinutes', Number(e.target.value))} inputProps={{ min: 0 }} sx={{ width: 120 }} />
                    <TextField label={t('events.payRateHour')} type="number" value={pos.payRatePerHour} onChange={(e) => updatePosition(i, 'payRatePerHour', Number(e.target.value))} inputProps={{ min: 0, step: 0.01 }} sx={{ width: 160 }} />
                  </Stack>
                  <TextField
                    label={t('templates.skillsCommaSep')}
                    value={pos.skills.join(', ')}
                    onChange={(e) => updatePosition(i, 'skills', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
                    fullWidth
                  />
                </Stack>
              </Card>
            ))}
            {saveMutation.isError && <Alert severity="error">{t('common.errorGeneric')}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={() => saveMutation.mutate()} disabled={!form.name || saveMutation.isPending}>
            {saveMutation.isPending ? `${t('common.save')}…` : t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)} maxWidth="xs">
        <DialogTitle>{t('templates.deleteTitle')}</DialogTitle>
        <DialogContent><Typography>{t('templates.deleteConfirm')}</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteId(null)}>{t('common.cancel')}</Button>
          <Button color="error" variant="contained" onClick={() => deleteMutation.mutate(deleteId!)} disabled={deleteMutation.isPending}>{t('common.delete')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
