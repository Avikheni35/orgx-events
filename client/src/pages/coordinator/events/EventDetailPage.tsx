import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Box, Typography, Card, CardContent, Chip, Stack, Button, Tabs, Tab, Divider, Grid, TextField, Dialog, DialogTitle, DialogContent, DialogActions, Alert, IconButton, Avatar, Rating, Tooltip, FormControlLabel, Switch } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import GridViewIcon from '@mui/icons-material/GridView';
import ScheduleIcon from '@mui/icons-material/Schedule';
import StarIcon from '@mui/icons-material/Star';
import DownloadIcon from '@mui/icons-material/Download';
import EmailIcon from '@mui/icons-material/Email';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { useTranslation } from 'react-i18next';
import { eventsApi, type EventStatus, type EventPosition, type EventTimeSlot } from '../../../api/events';
import { assignmentsApi, type Assignment } from '../../../api/assignments';
import { staffRatingsApi, type StaffRating } from '../../../api/staffRatings';

const STATUS_COLORS: Record<EventStatus, 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'> = {
  draft: 'default', planning: 'info', staffing: 'secondary', confirmed: 'primary',
  in_progress: 'warning', completed: 'success', cancelled: 'error',
};

const NEXT_STATUSES: Partial<Record<EventStatus, EventStatus>> = {
  draft: 'planning', planning: 'staffing', staffing: 'confirmed', confirmed: 'in_progress', in_progress: 'completed',
};


export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { t } = useTranslation();
  const [tab, setTab] = useState(0);
  const [posDialog, setPosDialog] = useState(false);
  const [posForm, setPosForm] = useState({ title: '', headcount: '1', payRatePerHour: '', billingRatePerHour: '', roleType: '', notes: '' });
  const [error, setError] = useState('');
  const [ratingDrafts, setRatingDrafts] = useState<Record<string, { score: number; comment: string }>>({});

  // Slot management state
  const [slotDialog, setSlotDialog] = useState<{ open: boolean; positionId: string }>({ open: false, positionId: '' });
  const [slotForm, setSlotForm] = useState({ startTime: '', endTime: '', breakMinutes: '0', notes: '' });

  const { data, isLoading } = useQuery({ queryKey: ['event', id], queryFn: () => eventsApi.get(id!) });
  const event = data?.data;

  const { mutate: advance } = useMutation({
    mutationFn: (status: EventStatus) => eventsApi.setStatus(id!, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['event', id] }),
    onError: () => setError(t('events.statusChangeFailed')),
  });

  const { mutate: toggleApproval } = useMutation({
    mutationFn: (val: boolean) => eventsApi.update(id!, { requiresClientApproval: val }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['event', id] }),
    onError: () => setError(t('events.settingSaveFailed')),
  });

  const { mutate: addPos, isPending: addingPos } = useMutation({
    mutationFn: () => eventsApi.addPosition(id!, {
      title: posForm.title, headcount: parseInt(posForm.headcount),
      payRatePerHour: parseFloat(posForm.payRatePerHour),
      billingRatePerHour: posForm.billingRatePerHour ? parseFloat(posForm.billingRatePerHour) : undefined,
      roleType: posForm.roleType || undefined, notes: posForm.notes || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['event', id] }); setPosDialog(false); setPosForm({ title: '', headcount: '1', payRatePerHour: '', billingRatePerHour: '', roleType: '', notes: '' }); },
  });

  const { mutate: deletePos } = useMutation({
    mutationFn: (positionId: string) => eventsApi.deletePosition(id!, positionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['event', id] }),
  });

  const { mutate: addSlot, isPending: addingSlot } = useMutation({
    mutationFn: (vars: { positionId: string; startTime: string; endTime: string; breakMinutes: number; notes?: string }) => {
      const pos = event!.positions.find(p => p._id === vars.positionId)!;
      const newSlots = [...(pos.slots ?? []), { startTime: vars.startTime, endTime: vars.endTime, breakMinutes: vars.breakMinutes, notes: vars.notes }];
      return eventsApi.updatePosition(id!, vars.positionId, { slots: newSlots } as Partial<EventPosition>);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event', id] });
      setSlotDialog({ open: false, positionId: '' });
      setSlotForm({ startTime: '', endTime: '', breakMinutes: '0', notes: '' });
    },
    onError: () => setError(t('events.slotAddFailed')),
  });

  const { mutate: deleteSlot } = useMutation({
    mutationFn: (vars: { positionId: string; slotId: string }) => {
      const pos = event!.positions.find(p => p._id === vars.positionId)!;
      const newSlots = pos.slots.filter((s: EventTimeSlot) => s._id !== vars.slotId);
      return eventsApi.updatePosition(id!, vars.positionId, { slots: newSlots } as Partial<EventPosition>);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['event', id] }),
    onError: () => setError(t('events.slotDeleteFailed')),
  });

  const [downloadingReport, setDownloadingReport] = useState(false);
  const handleDownloadReport = async () => {
    setDownloadingReport(true);
    try {
      const res = await eventsApi.downloadReport(id!);
      const url = window.URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Abschlussbericht_${event?.eventNumber ?? id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      setError(t('events.reportDownloadFailed'));
    } finally {
      setDownloadingReport(false);
    }
  };

  const { mutate: emailReport, isPending: sendingReport } = useMutation({
    mutationFn: () => eventsApi.emailReport(id!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['event', id] }),
    onError: () => setError(t('events.reportEmailFailed')),
  });

  const { data: assignmentsData } = useQuery({
    queryKey: ['event-assignments', id],
    queryFn: () => assignmentsApi.listByEvent(id!),
    enabled: tab === 3,
  });
  const allAssignments: Assignment[] = assignmentsData?.data ?? [];
  const rateableAssignments = useMemo(() =>
    allAssignments.filter(a => a.status === 'confirmed' || a.status === 'worked'),
    [allAssignments]
  );
  const uniqueStaff = useMemo(() => {
    const seen = new Set<string>();
    return rateableAssignments.filter(a => { if (seen.has(a.staffProfileId)) return false; seen.add(a.staffProfileId); return true; });
  }, [rateableAssignments]);

  const { data: eventRatingsData } = useQuery({
    queryKey: ['event-ratings', id],
    queryFn: () => staffRatingsApi.forEvent(id!),
    enabled: tab === 3,
  });
  const existingRatings: StaffRating[] = eventRatingsData?.data?.ratings ?? [];
  const ratingsByStaff = useMemo(() =>
    existingRatings.reduce<Record<string, StaffRating>>((m, r) => { m[r.staffProfileId] = r; return m; }, {}),
    [existingRatings]
  );

  const { mutate: submitRating, isPending: savingRating } = useMutation({
    mutationFn: (vars: { staffProfileId: string; score: number; comment: string }) =>
      staffRatingsApi.create({ staffProfileId: vars.staffProfileId, eventId: id!, score: vars.score, comment: vars.comment || undefined }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['event-ratings', id] });
      qc.invalidateQueries({ queryKey: ['staff-ratings', vars.staffProfileId] });
      qc.invalidateQueries({ queryKey: ['staff-profile', vars.staffProfileId] });
    },
    onError: () => setError(t('events.ratingFailed')),
  });

  const STATUS_LABELS: Record<EventStatus, string> = {
    draft: t('eventClient.statusLabels.draft'),
    planning: t('eventClient.statusLabels.planning'),
    staffing: t('eventClient.statusLabels.staffing'),
    confirmed: t('eventClient.statusLabels.confirmed'),
    in_progress: t('eventClient.statusLabels.in_progress'),
    completed: t('eventClient.statusLabels.completed'),
    cancelled: t('eventClient.statusLabels.cancelled'),
  };

  if (isLoading || !event) return <Box sx={{ p: 3 }}>{t('common.loading')}</Box>;

  const nextStatus = NEXT_STATUSES[event.status];
  const slotPos = event.positions.find(p => p._id === slotDialog.positionId);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>{event.eventNumber}</Typography>
            <Chip label={STATUS_LABELS[event.status]} color={STATUS_COLORS[event.status]} size="small" />
          </Stack>
          <Typography variant="h5" fontWeight={700}>{event.name}</Typography>
          <Typography variant="body2" color="text.secondary">{event.clientName} {event.venueName && `· ${event.venueName}`}</Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Button variant="outlined" startIcon={<GridViewIcon />} onClick={() => navigate(`/coordinator/events/${id}/workforce`)}>
            {t('events.workforce')}
          </Button>
          <Button variant="outlined" startIcon={<ScheduleIcon />} onClick={() => navigate(`/coordinator/events/${id}/timesheet`)}>
            {t('nav.timesheets')}
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleDownloadReport}
            disabled={downloadingReport}
          >
            {downloadingReport ? t('events.reportGenerating') : t('events.reportPdf')}
          </Button>
          <Tooltip title={event.reportEmailedAt ? t('events.reportSent', { date: new Date(event.reportEmailedAt).toLocaleString() }) : t('events.reportSendTooltip')}>
            <span>
              <Button
                variant={event.reportEmailedAt ? 'outlined' : 'contained'}
                color={event.reportEmailedAt ? 'success' : 'primary'}
                startIcon={event.reportEmailedAt ? <CheckCircleOutlineIcon /> : <EmailIcon />}
                onClick={() => emailReport()}
                disabled={sendingReport}
              >
                {sendingReport ? t('events.reportSending') : event.reportEmailedAt ? t('events.reportResend') : t('events.reportSend')}
              </Button>
            </span>
          </Tooltip>
          {nextStatus && (
            <Button variant="contained" onClick={() => advance(nextStatus)}>
              → {STATUS_LABELS[nextStatus]}
            </Button>
          )}
          {event.status !== 'cancelled' && event.status !== 'completed' && (
            <Button variant="outlined" color="error" onClick={() => advance('cancelled')}>{t('events.cancel')}</Button>
          )}
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={t('events.overview')} />
        <Tab label={`${t('events.positions')} (${event.positions.length})`} />
        <Tab label={t('common.notes')} />
        <Tab label={t('events.ratings')} icon={<StarIcon sx={{ fontSize: 14 }} />} iconPosition="start" />
      </Tabs>

      {tab === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card><CardContent>
              <Typography variant="subtitle2" color="text.secondary" mb={1}>{t('events.period')}</Typography>
              <Typography>{new Date(event.startDate).toLocaleString('de-DE')} – {new Date(event.endDate).toLocaleString('de-DE')}</Typography>
              {event.description && <><Divider sx={{ my: 1 }} /><Typography variant="body2">{event.description}</Typography></>}
            </CardContent></Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card><CardContent>
              <Typography variant="subtitle2" color="text.secondary" mb={1}>{t('events.finances')}</Typography>
              <Stack spacing={0.5}>
                {event.budget && <Typography>{t('events.budget')}: <strong>€ {event.budget.toLocaleString()}</strong></Typography>}
                {event.plannedRevenue && <Typography>{t('events.plannedRevenue')}: <strong>€ {event.plannedRevenue.toLocaleString()}</strong></Typography>}
              </Stack>
            </CardContent></Card>
          </Grid>
          <Grid item xs={12}>
            <Card variant="outlined">
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="subtitle2" fontWeight={700}>{t('events.clientApproval')}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t('events.clientApprovalDesc')}
                    </Typography>
                  </Box>
                  <Stack alignItems="flex-end" spacing={0.5}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={event.requiresClientApproval}
                          onChange={e => toggleApproval(e.target.checked)}
                          disabled={event.status === 'completed' || event.status === 'cancelled'}
                        />
                      }
                      label={event.requiresClientApproval ? t('status.active') : t('status.inactive')}
                      sx={{ m: 0 }}
                    />
                    {event.clientApprovedAt && (
                      <Chip
                        size="small"
                        color="success"
                        label={t('events.approvedDate', { date: new Date(event.clientApprovedAt).toLocaleDateString() })}
                      />
                    )}
                    {event.requiresClientApproval && !event.clientApprovedAt && event.status === 'planning' && (
                      <Chip size="small" color="warning" label={t('events.awaitingApproval')} />
                    )}
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {tab === 1 && (
        <Box>
          <Stack direction="row" justifyContent="flex-end" mb={2}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setPosDialog(true)}>{t('events.addPosition')}</Button>
          </Stack>
          <Stack spacing={2}>
            {event.positions.map((pos: EventPosition) => (
              <Card key={pos._id} variant="outlined">
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1}>
                    <Box>
                      <Typography fontWeight={700}>{pos.title}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {pos.roleType && `${pos.roleType} · `}
                        {pos.headcount} Person{pos.headcount !== 1 ? 'en' : ''} · € {pos.payRatePerHour}/h
                        {pos.billingRatePerHour ? ` · Abrechnung: € ${pos.billingRatePerHour}/h` : ''}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<AccessTimeIcon />}
                        onClick={() => {
                          const d = new Date(event.startDate);
                          const pad = (n: number) => String(n).padStart(2, '0');
                          const datePrefix = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                          setSlotForm(f => ({
                            ...f,
                            startTime: `${datePrefix}T08:00`,
                            endTime: `${datePrefix}T16:00`,
                          }));
                          setSlotDialog({ open: true, positionId: pos._id });
                        }}
                      >
                        {t('events.manageSlots', { count: pos.slots?.length ?? 0 })}
                      </Button>
                      <IconButton size="small" color="error" onClick={() => deletePos(pos._id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </Stack>

                  {/* Slot list */}
                  {pos.slots && pos.slots.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                      <Divider sx={{ mb: 1 }} />
                      <Stack spacing={0.5}>
                        {pos.slots.map((slot: EventTimeSlot) => (
                          <Stack key={slot._id} direction="row" alignItems="center" justifyContent="space-between"
                            sx={{ px: 1.5, py: 0.75, bgcolor: 'action.hover', borderRadius: 1 }}>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <AccessTimeIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                              <Typography variant="body2">
                                {new Date(slot.startTime).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}
                                {' – '}
                                {new Date(slot.endTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                                {slot.breakMinutes > 0 && ` · ${slot.breakMinutes} Min. Pause`}
                              </Typography>
                              {slot.notes && <Typography variant="caption" color="text.secondary">({slot.notes})</Typography>}
                            </Stack>
                            <IconButton size="small" onClick={() => deleteSlot({ positionId: pos._id, slotId: slot._id })}>
                              <DeleteIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                          </Stack>
                        ))}
                      </Stack>
                    </Box>
                  )}

                  {pos.slots?.length === 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      {t('events.noSlots')}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            ))}
            {event.positions.length === 0 && (
              <Typography color="text.secondary" align="center" py={4}>{t('events.noPositions')}</Typography>
            )}
          </Stack>
        </Box>
      )}

      {tab === 2 && (
        <Card><CardContent>
          {event.notes.length === 0 && <Typography variant="body2" color="text.secondary">{t('common.noData')}</Typography>}
          <Stack spacing={2}>
            {event.notes.map((n) => (
              <Box key={n._id} sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="body2">{n.text}</Typography>
                <Typography variant="caption" color="text.secondary">{n.createdByName} · {new Date(n.createdAt).toLocaleString('de-DE')}</Typography>
              </Box>
            ))}
          </Stack>
        </CardContent></Card>
      )}

      {tab === 3 && (
        <Box>
          {uniqueStaff.length === 0 ? (
            <Typography color="text.secondary" align="center" py={4}>
              {t('events.noRateableStaff')}
            </Typography>
          ) : (
            <Stack spacing={2}>
              {uniqueStaff.map((a) => {
                const existing = ratingsByStaff[a.staffProfileId];
                const draft = ratingDrafts[a.staffProfileId] ?? {
                  score: existing?.score ?? 0,
                  comment: existing?.comment ?? '',
                };
                const setDraft = (patch: Partial<typeof draft>) =>
                  setRatingDrafts(prev => ({
                    ...prev,
                    [a.staffProfileId]: { ...draft, ...patch },
                  }));

                return (
                  <Card key={a.staffProfileId} variant="outlined">
                    <CardContent>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'flex-start' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 200 }}>
                          <Avatar sx={{ width: 40, height: 40, bgcolor: 'primary.light', fontSize: 14 }}>
                            {a.staffName.split(' ').map(n => n[0]).join('').slice(0,2)}
                          </Avatar>
                          <Box>
                            <Typography fontWeight={700}>{a.staffName}</Typography>
                            <Typography variant="caption" color="text.secondary">{a.positionTitle}</Typography>
                            {existing && (
                              <Typography variant="caption" color="success.main" display="block">
                                {t('events.approvedDate', { date: new Date(existing.updatedAt).toLocaleDateString() })}
                              </Typography>
                            )}
                          </Box>
                        </Box>

                        <Box sx={{ flex: 1 }}>
                          <Stack spacing={1.5}>
                            <Box>
                              <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mb={0.5}>
                                {t('events.ratingLabel')}
                              </Typography>
                              <Rating
                                value={draft.score}
                                onChange={(_, v) => setDraft({ score: v ?? 0 })}
                                size="large"
                              />
                            </Box>
                            <TextField
                              label={t('events.ratingComment')}
                              size="small"
                              multiline
                              rows={2}
                              fullWidth
                              value={draft.comment}
                              onChange={e => setDraft({ comment: e.target.value })}
                              inputProps={{ maxLength: 1000 }}
                            />
                            <Box>
                              <Button
                                variant="contained"
                                size="small"
                                disabled={draft.score === 0 || savingRating}
                                onClick={() => submitRating({ staffProfileId: a.staffProfileId, score: draft.score, comment: draft.comment })}
                                sx={{ textTransform: 'none' }}
                              >
                                {existing ? t('events.updateRating') : t('events.addRating')}
                              </Button>
                            </Box>
                          </Stack>
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
          )}
        </Box>
      )}

      {/* Add Position Dialog */}
      <Dialog open={posDialog} onClose={() => setPosDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('events.positionDialog')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField label={`${t('events.posTitle')} *`} value={posForm.title} onChange={(e) => setPosForm((f) => ({ ...f, title: e.target.value }))} fullWidth />
            <TextField label={t('events.roleType')} value={posForm.roleType} onChange={(e) => setPosForm((f) => ({ ...f, roleType: e.target.value }))} fullWidth />
            <Stack direction="row" spacing={2}>
              <TextField label={`${t('events.headcount')} *`} type="number" value={posForm.headcount} onChange={(e) => setPosForm((f) => ({ ...f, headcount: e.target.value }))} fullWidth inputProps={{ min: 1 }} />
              <TextField label={`${t('events.payRateHour')} *`} type="number" value={posForm.payRatePerHour} onChange={(e) => setPosForm((f) => ({ ...f, payRatePerHour: e.target.value }))} fullWidth />
              <TextField label={t('events.billingRateHour')} type="number" value={posForm.billingRatePerHour} onChange={(e) => setPosForm((f) => ({ ...f, billingRatePerHour: e.target.value }))} fullWidth />
            </Stack>
            <TextField label={t('common.notes')} value={posForm.notes} onChange={(e) => setPosForm((f) => ({ ...f, notes: e.target.value }))} fullWidth multiline rows={2} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPosDialog(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={() => addPos()} disabled={addingPos || !posForm.title || !posForm.payRatePerHour}>{t('common.add')}</Button>
        </DialogActions>
      </Dialog>

      {/* Slot Management Dialog */}
      <Dialog
        open={slotDialog.open}
        onClose={() => { setSlotDialog({ open: false, positionId: '' }); setSlotForm({ startTime: '', endTime: '', breakMinutes: '0', notes: '' }); }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {t('events.slotsFor', { title: slotPos?.title ?? '' })}
        </DialogTitle>
        <DialogContent>
          {/* Existing slots */}
          {slotPos && slotPos.slots && slotPos.slots.length > 0 && (
            <Box mb={2}>
              <Typography variant="subtitle2" color="text.secondary" mb={1}>{t('events.existingSlots')}</Typography>
              <Stack spacing={0.5}>
                {slotPos.slots.map((slot: EventTimeSlot) => (
                  <Stack key={slot._id} direction="row" alignItems="center" justifyContent="space-between"
                    sx={{ px: 1.5, py: 0.75, bgcolor: 'action.hover', borderRadius: 1 }}>
                    <Typography variant="body2">
                      {new Date(slot.startTime).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                      {' – '}
                      {new Date(slot.endTime).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      {slot.breakMinutes > 0 && ` · ${slot.breakMinutes} ${t('events.breakMinutes')}`}
                      {slot.notes && ` (${slot.notes})`}
                    </Typography>
                    <IconButton size="small" color="error" onClick={() => deleteSlot({ positionId: slotDialog.positionId, slotId: slot._id })}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                ))}
              </Stack>
              <Divider sx={{ mt: 2, mb: 2 }} />
            </Box>
          )}

          {/* Add new slot form */}
          <Typography variant="subtitle2" color="text.secondary" mb={1}>{t('events.addNewSlot')}</Typography>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label={`${t('events.slotStart')} *`}
                type="datetime-local"
                value={slotForm.startTime}
                onChange={e => setSlotForm(f => ({ ...f, startTime: e.target.value }))}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label={`${t('events.slotEnd')} *`}
                type="datetime-local"
                value={slotForm.endTime}
                onChange={e => setSlotForm(f => ({ ...f, endTime: e.target.value }))}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField
                label={t('events.breakMinutes')}
                type="number"
                value={slotForm.breakMinutes}
                onChange={e => setSlotForm(f => ({ ...f, breakMinutes: e.target.value }))}
                fullWidth
                inputProps={{ min: 0 }}
              />
              <TextField
                label={t('common.notesOptional')}
                value={slotForm.notes}
                onChange={e => setSlotForm(f => ({ ...f, notes: e.target.value }))}
                fullWidth
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setSlotDialog({ open: false, positionId: '' }); setSlotForm({ startTime: '', endTime: '', breakMinutes: '0', notes: '' }); }}>
            {t('common.close')}
          </Button>
          <Button
            variant="contained"
            disabled={addingSlot || !slotForm.startTime || !slotForm.endTime}
            onClick={() => addSlot({
              positionId: slotDialog.positionId,
              startTime: new Date(slotForm.startTime).toISOString(),
              endTime: new Date(slotForm.endTime).toISOString(),
              breakMinutes: parseInt(slotForm.breakMinutes) || 0,
              notes: slotForm.notes || undefined,
            })}
          >
            {addingSlot ? t('common.adding') : t('events.addSlot')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
