import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Button, Card, Table, TableHead, TableRow, TableCell, TableBody,
  Chip, Stack, CircularProgress, Alert, TextField, Dialog, DialogTitle,
  DialogContent, DialogActions, IconButton, Tooltip, Switch, FormControlLabel,
  Divider,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import { useTranslation } from 'react-i18next';
import { timesheetsApi, type EventTimesheet, type EventTimesheetEntry } from '../../../api/timesheets';

const STATUS_COLORS: Record<EventTimesheet['status'], 'default' | 'warning' | 'success' | 'error'> = {
  pending: 'warning', approved: 'success', disputed: 'error',
};

function fmt(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function toInputTime(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function applyTime(baseDateIso: string, hhmm: string): string {
  const d = new Date(baseDateIso);
  const [h, m] = hhmm.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

function StarRating({ value, onChange }: { value?: number; onChange: (v: number) => void }) {
  return (
    <Stack direction="row" spacing={0}>
      {[1,2,3,4,5].map((n) => (
        <IconButton key={n} size="small" onClick={() => onChange(n)} sx={{ p: 0.25 }}>
          {(value ?? 0) >= n
            ? <StarIcon sx={{ fontSize: 18, color: '#f59e0b' }} />
            : <StarBorderIcon sx={{ fontSize: 18, color: '#d1d5db' }} />}
        </IconButton>
      ))}
    </Stack>
  );
}

interface EditState {
  tsId: string;
  staffName: string;
  baseDateIso: string;
  actualStartTime: string;
  actualEndTime: string;
  breakTaken: boolean;
  actualBreakMinutes: number;
  ratingByCoordinator?: number;
  ratingNote: string;
}

export default function EventTimesheetPage() {
  const { id: eventId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<EditState | null>(null);
  const [error, setError] = useState('');

  const STATUS_LABEL: Record<EventTimesheet['status'], string> = {
    pending: t('status.open'), approved: t('status.approved'), disputed: t('status.disputed'),
  };

  const { data, isLoading } = useQuery({
    queryKey: ['event-timesheet', eventId],
    queryFn: () => timesheetsApi.getForEvent(eventId!),
  });

  const { mutate: generate, isPending: generating } = useMutation({
    mutationFn: () => timesheetsApi.generate(eventId!),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['event-timesheet', eventId] }); setError(''); },
    onError: () => setError(t('timesheets.generateFailed')),
  });

  const { mutate: approveAll, isPending: approvingAll } = useMutation({
    mutationFn: () => timesheetsApi.approveAll(eventId!),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['event-timesheet', eventId] }); setError(''); },
    onError: () => setError(t('timesheets.approveFailed')),
  });

  const { mutate: saveEdit, isPending: saving } = useMutation({
    mutationFn: (e: EditState) => timesheetsApi.update(e.tsId, {
      actualStartTime: applyTime(e.baseDateIso, e.actualStartTime),
      actualEndTime:   applyTime(e.baseDateIso, e.actualEndTime),
      breakTaken: e.breakTaken,
      actualBreakMinutes: e.actualBreakMinutes,
      ratingByCoordinator: e.ratingByCoordinator,
      ratingNote: e.ratingNote || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event-timesheet', eventId] });
      setEditing(null);
      setError('');
    },
    onError: () => setError(t('timesheets.saveFailed')),
  });

  function openEdit(entry: EventTimesheetEntry) {
    const ts = entry.timesheet!;
    setEditing({
      tsId: ts._id,
      staffName: ts.staffName,
      baseDateIso: ts.plannedStartTime,
      actualStartTime: toInputTime(ts.actualStartTime ?? ts.plannedStartTime),
      actualEndTime:   toInputTime(ts.actualEndTime   ?? ts.plannedEndTime),
      breakTaken: ts.breakTaken,
      actualBreakMinutes: ts.actualBreakMinutes,
      ratingByCoordinator: ts.ratingByCoordinator,
      ratingNote: ts.ratingNote ?? '',
    });
  }

  const view = data?.data;
  const entries = view?.entries ?? [];
  const allGenerated = entries.length > 0 && entries.every((e) => !!e.timesheet);
  const pendingCount = entries.filter((e) => e.timesheet?.status === 'pending').length;

  const totals = entries.reduce(
    (acc, e) => {
      if (!e.timesheet) return acc;
      return { hours: acc.hours + e.timesheet.totalHours, pay: acc.pay + e.timesheet.grossPay };
    },
    { hours: 0, pay: 0 }
  );

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ mb: 2 }} size="small">{t('common.back')}</Button>

      {isLoading && <Box sx={{ py: 6, textAlign: 'center' }}><CircularProgress /></Box>}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {view && (
        <>
          {/* Header */}
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={3} flexWrap="wrap" gap={1}>
            <Box>
              <Typography variant="h5" fontWeight={700}>{view.event.name}</Typography>
              <Typography variant="body2" color="text.secondary">
                {fmtDate(view.event.startDate)} · {view.event.clientName} · {view.event.venueName}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              {!allGenerated && (
                <Button variant="outlined" onClick={() => generate()} disabled={generating}>
                  {generating ? `${t('timesheets.generate')}…` : t('timesheets.generate')}
                </Button>
              )}
              {allGenerated && pendingCount > 0 && (
                <Button
                  variant="contained" color="success"
                  startIcon={<CheckCircleIcon />}
                  onClick={() => approveAll()}
                  disabled={approvingAll}
                >
                  {t('timesheets.approveAll', { count: pendingCount })}
                </Button>
              )}
            </Stack>
          </Stack>

          {/* Table */}
          <Card>
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap' } }}>
                    <TableCell>{t('timesheets.employee')}</TableCell>
                    <TableCell>{t('timesheets.position')}</TableCell>
                    <TableCell>{t('timesheets.planned')}</TableCell>
                    <TableCell>{t('timesheets.checkIn')}</TableCell>
                    <TableCell>{t('timesheets.checkOut')}</TableCell>
                    <TableCell align="center">{t('timesheets.break')}</TableCell>
                    <TableCell align="right">{t('timesheets.hours')}</TableCell>
                    <TableCell align="right">{t('timesheets.gross')}</TableCell>
                    <TableCell align="center">{t('timesheets.rating')}</TableCell>
                    <TableCell>{t('common.status')}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {entries.map((entry) => {
                    const { assignment: a, timesheet: ts } = entry;
                    return (
                      <TableRow key={a._id} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>{a.staffName}</Typography>
                        </TableCell>
                        <TableCell sx={{ fontSize: 12 }}>{a.positionTitle}</TableCell>

                        {/* Planned */}
                        <TableCell sx={{ fontSize: 12, color: 'text.secondary', whiteSpace: 'nowrap' }}>
                          {fmt(a.slotStart)} – {fmt(a.slotEnd)}
                        </TableCell>

                        {/* Actual check-in */}
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {ts ? (
                            <Typography variant="body2" color={ts.actualStartTime ? 'success.main' : 'text.disabled'} fontWeight={600}>
                              {fmt(ts.actualStartTime)}
                            </Typography>
                          ) : (
                            <Typography variant="body2" color={a.checkInTime ? 'success.main' : 'text.disabled'}>
                              {fmt(a.checkInTime)}
                            </Typography>
                          )}
                        </TableCell>

                        {/* Actual check-out */}
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {ts ? (
                            <Typography variant="body2" color={ts.actualEndTime ? 'primary.main' : 'text.disabled'} fontWeight={600}>
                              {fmt(ts.actualEndTime)}
                            </Typography>
                          ) : (
                            <Typography variant="body2" color={a.checkOutTime ? 'primary.main' : 'text.disabled'}>
                              {fmt(a.checkOutTime)}
                            </Typography>
                          )}
                        </TableCell>

                        {/* Break */}
                        <TableCell align="center">
                          {ts ? (
                            <Stack alignItems="center">
                              <Chip
                                label={ts.breakTaken ? `${ts.actualBreakMinutes} min` : t('timesheets.noBreak')}
                                size="small"
                                variant={ts.breakTaken ? 'filled' : 'outlined'}
                                sx={{ fontSize: 10 }}
                              />
                            </Stack>
                          ) : '—'}
                        </TableCell>

                        {/* Hours */}
                        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: ts ? 700 : 400 }}>
                          {ts ? ts.totalHours.toFixed(2) : '—'}
                        </TableCell>

                        {/* Gross pay */}
                        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                          {ts ? `€ ${ts.grossPay.toFixed(2)}` : '—'}
                        </TableCell>

                        {/* Rating */}
                        <TableCell align="center">
                          {ts ? (
                            <Stack direction="row" justifyContent="center">
                              {[1,2,3,4,5].map((n) => (
                                (ts.ratingByCoordinator ?? 0) >= n
                                  ? <StarIcon key={n} sx={{ fontSize: 14, color: '#f59e0b' }} />
                                  : <StarBorderIcon key={n} sx={{ fontSize: 14, color: '#d1d5db' }} />
                              ))}
                            </Stack>
                          ) : '—'}
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          {ts ? (
                            <Chip label={STATUS_LABEL[ts.status]} color={STATUS_COLORS[ts.status]} size="small" sx={{ fontSize: 10 }} />
                          ) : (
                            <Chip label={t('timesheets.notCreated')} size="small" variant="outlined" sx={{ fontSize: 10 }} />
                          )}
                        </TableCell>

                        {/* Edit */}
                        <TableCell>
                          {ts && ts.status !== 'approved' && (
                            <Tooltip title={t('common.edit')}>
                              <IconButton size="small" onClick={() => openEdit(entry)}>
                                <EditIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {/* Totals row */}
                  {allGenerated && (
                    <TableRow sx={{ bgcolor: 'action.hover', '& td': { fontWeight: 700 } }}>
                      <TableCell colSpan={6} align="right">{t('timesheets.total')}</TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>{totals.hours.toFixed(2)} h</TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>€ {totals.pay.toFixed(2)}</TableCell>
                      <TableCell colSpan={3} />
                    </TableRow>
                  )}

                  {entries.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={11} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                        {t('timesheets.noAssignments')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Box>
          </Card>
        </>
      )}

      {/* Edit Dialog */}
      {editing && (
        <Dialog open onClose={() => setEditing(null)} maxWidth="sm" fullWidth>
          <DialogTitle>{t('timesheets.editTitle', { name: editing.staffName })}</DialogTitle>
          <DialogContent>
            <Stack spacing={2.5} sx={{ mt: 1 }}>
              <Stack direction="row" spacing={2}>
                <TextField
                  label={t('timesheets.checkinTime')} type="time" size="small" fullWidth
                  value={editing.actualStartTime}
                  onChange={(e) => setEditing((s) => s && { ...s, actualStartTime: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  label={t('timesheets.checkoutTime')} type="time" size="small" fullWidth
                  value={editing.actualEndTime}
                  onChange={(e) => setEditing((s) => s && { ...s, actualEndTime: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                />
              </Stack>

              <Divider />

              <Stack direction="row" spacing={2} alignItems="center">
                <FormControlLabel
                  control={
                    <Switch
                      checked={editing.breakTaken}
                      onChange={(e) => setEditing((s) => s && { ...s, breakTaken: e.target.checked })}
                    />
                  }
                  label={t('timesheets.breakTaken')}
                />
                {editing.breakTaken && (
                  <TextField
                    label={t('timesheets.breakMin')} type="number" size="small" sx={{ width: 130 }}
                    value={editing.actualBreakMinutes}
                    onChange={(e) => setEditing((s) => s && { ...s, actualBreakMinutes: Number(e.target.value) })}
                    inputProps={{ min: 0, max: 120 }}
                  />
                )}
              </Stack>

              <Divider />

              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase" letterSpacing="0.06em">
                  {t('timesheets.rating')}
                </Typography>
                <Box mt={0.75}>
                  <StarRating
                    value={editing.ratingByCoordinator}
                    onChange={(v) => setEditing((s) => s && { ...s, ratingByCoordinator: v })}
                  />
                </Box>
                <TextField
                  label={t('timesheets.ratingNote')} size="small" fullWidth multiline rows={2}
                  value={editing.ratingNote}
                  onChange={(e) => setEditing((s) => s && { ...s, ratingNote: e.target.value })}
                  sx={{ mt: 1 }}
                />
              </Box>

              {/* Live hours preview */}
              {editing.actualStartTime && editing.actualEndTime && (
                <Alert severity="info">
                  {(() => {
                    const start = new Date(`2000-01-01T${editing.actualStartTime}`);
                    const end   = new Date(`2000-01-01T${editing.actualEndTime}`);
                    let mins = (end.getTime() - start.getTime()) / 60_000;
                    if (editing.breakTaken) mins = Math.max(0, mins - editing.actualBreakMinutes);
                    const h = (mins / 60).toFixed(2);
                    return t('timesheets.netHours', { h });
                  })()}
                </Alert>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditing(null)} disabled={saving}>{t('common.cancel')}</Button>
            <Button variant="contained" onClick={() => saveEdit(editing)} disabled={saving}>
              {saving ? `${t('common.save')}…` : t('common.save')}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}
