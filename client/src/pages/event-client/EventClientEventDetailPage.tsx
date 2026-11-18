import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Card, CardContent, Chip, Stack, Divider, Alert, Button, IconButton,
  Tab, Tabs, Avatar,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ReceiptIcon from '@mui/icons-material/Receipt';
import PeopleIcon from '@mui/icons-material/People';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { useTranslation } from 'react-i18next';
import { eventClientPortalApi } from '../../api/eventClientPortal';

function initials(name: string) {
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export default function EventClientEventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { t } = useTranslation();
  const [tab, setTab] = useState(0);

  const STATUS_LABELS: Record<string, string> = {
    draft: t('eventClient.statusLabels.draft'),
    planning: t('eventClient.statusLabels.planning'),
    staffing: t('eventClient.statusLabels.staffing'),
    confirmed: t('eventClient.statusLabels.confirmed'),
    in_progress: t('eventClient.statusLabels.in_progress'),
    completed: t('eventClient.statusLabels.completed'),
    cancelled: t('eventClient.statusLabels.cancelled'),
  };
  const STATUS_COLORS: Record<string, 'default' | 'info' | 'warning' | 'primary' | 'success' | 'error'> = {
    draft: 'default', planning: 'info', staffing: 'warning', confirmed: 'primary',
    in_progress: 'primary', completed: 'success', cancelled: 'error',
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['ec-event', eventId],
    queryFn: () => eventClientPortalApi.getEvent(eventId!),
    enabled: !!eventId,
  });
  const event = data?.data;

  const { data: staffData, isLoading: staffLoading } = useQuery({
    queryKey: ['ec-event-staff', eventId],
    queryFn: () => eventClientPortalApi.getEventStaff(eventId!),
    enabled: !!eventId && tab === 1,
  });
  const staffList = staffData?.data?.staff ?? [];

  const approveMutation = useMutation({
    mutationFn: () => eventClientPortalApi.approveEvent(eventId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ec-event', eventId] });
      qc.invalidateQueries({ queryKey: ['ec-events-all'] });
    },
  });

  if (isLoading) return <Box sx={{ p: 3 }}>{t('common.loading')}</Box>;
  if (error || !event) return <Box sx={{ p: 3 }}><Alert severity="error">{t('eventClient.notFound')}</Alert></Box>;

  const totalPositions = event.positions?.length ?? 0;
  const totalHeadcount = event.positions?.reduce((s: number, p: { headcount: number }) => s + p.headcount, 0) ?? 0;
  const needsApproval = event.requiresClientApproval && !event.clientApprovedAt && event.status === 'planning';
  const alreadyApproved = event.requiresClientApproval && !!event.clientApprovedAt;

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" mb={2}>
        <IconButton onClick={() => navigate('/event-client/events')} size="small"><ArrowBackIcon /></IconButton>
        <Box flex={1} minWidth={0}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Typography variant="h5" fontWeight={700} noWrap>{event.name}</Typography>
            <Chip label={STATUS_LABELS[event.status] ?? event.status} color={STATUS_COLORS[event.status] ?? 'default'} size="small" />
          </Stack>
          <Typography variant="caption" color="text.secondary">{event.eventNumber}</Typography>
        </Box>
      </Stack>

      {needsApproval && (
        <Alert
          severity="warning"
          icon={<WarningAmberIcon />}
          sx={{ mb: 2 }}
          action={
            <Button
              size="small"
              color="warning"
              variant="contained"
              disabled={approveMutation.isPending}
              onClick={() => approveMutation.mutate()}
            >
              {approveMutation.isPending ? t('eventClient.approving') : t('eventClient.approveEvent')}
            </Button>
          }
        >
          {t('eventClient.approvalText')}
        </Alert>
      )}
      {alreadyApproved && (
        <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 2 }}>
          {t('eventClient.approvedOn', { date: new Date(event.clientApprovedAt!).toLocaleDateString(undefined, { day: '2-digit', month: 'long', year: 'numeric' }) })}
        </Alert>
      )}
      {approveMutation.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>{t('eventClient.approvalFailed')}</Alert>
      )}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Tab label={t('eventClient.overview')} />
        <Tab label={`${t('eventClient.team')}${staffList.length > 0 ? ` (${staffList.length})` : ''}`} icon={<PeopleIcon sx={{ fontSize: 16 }} />} iconPosition="start" />
      </Tabs>

      {tab === 0 && (
        <>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle2" fontWeight={600} mb={2}>{t('eventClient.eventDetails')}</Typography>
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={4} flexWrap="wrap" gap={1}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">{t('events.startDate')}</Typography>
                    <Typography variant="body2">
                      {new Date(event.startDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">{t('events.endDate')}</Typography>
                    <Typography variant="body2">
                      {new Date(event.endDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </Typography>
                  </Box>
                </Stack>
                {event.venueName && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">{t('events.venue')}</Typography>
                    <Typography variant="body2">{event.venueName}</Typography>
                  </Box>
                )}
                {event.type && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">{t('events.type')}</Typography>
                    <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>{event.type.replace('_', ' ')}</Typography>
                  </Box>
                )}
                {event.description && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">{t('common.description')}</Typography>
                    <Typography variant="body2">{event.description}</Typography>
                  </Box>
                )}
              </Stack>
            </CardContent>
          </Card>

          {totalPositions > 0 && (
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="subtitle2" fontWeight={600} mb={2}>
                  {t('eventClient.positionsLabel', { count: totalPositions, total: totalHeadcount })}
                </Typography>
                {event.positions?.map((pos: { _id: string; title: string; roleType?: string; headcount: number; dresscode?: string; notes?: string }) => (
                  <Box key={pos._id} sx={{ mb: 1.5, pb: 1.5, borderBottom: '1px solid', borderColor: 'divider', '&:last-child': { border: 0, mb: 0, pb: 0 } }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Box>
                        <Typography variant="body2" fontWeight={600}>{pos.title}</Typography>
                        {pos.roleType && <Typography variant="caption" color="text.secondary">{pos.roleType}</Typography>}
                      </Box>
                      <Chip label={`${pos.headcount}`} size="small" variant="outlined" />
                    </Stack>
                    {pos.dresscode && <Typography variant="caption" color="text.secondary">{t('eventClient.dresscode')} {pos.dresscode}</Typography>}
                    {pos.notes && <Typography variant="caption" color="text.secondary" display="block">{pos.notes}</Typography>}
                  </Box>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle2" fontWeight={600}>{t('eventClient.invoicesSection')}</Typography>
                <Button size="small" startIcon={<ReceiptIcon />} onClick={() => navigate('/event-client/invoices')}>
                  {t('eventClient.allInvoices')}
                </Button>
              </Stack>
              <Divider sx={{ my: 1 }} />
              <Typography variant="body2" color="text.secondary">
                {t('eventClient.invoicesHint')}
              </Typography>
            </CardContent>
          </Card>
        </>
      )}

      {tab === 1 && (
        <Card>
          <CardContent>
            <Typography variant="subtitle2" fontWeight={600} mb={2}>{t('eventClient.staffDeployed')}</Typography>
            {staffLoading ? (
              <Typography variant="body2" color="text.secondary">{t('common.loading')}</Typography>
            ) : staffList.length === 0 ? (
              <Stack alignItems="center" py={4} spacing={1}>
                <Avatar sx={{ bgcolor: 'action.selected', width: 48, height: 48 }}>
                  <PeopleIcon />
                </Avatar>
                <Typography variant="body2" color="text.secondary">
                  {t('eventClient.noStaffYet')}
                </Typography>
              </Stack>
            ) : (
              <Stack spacing={0}>
                {staffList.map((member, idx) => (
                  <Box key={member._id}>
                    {idx > 0 && <Divider />}
                    <Stack direction="row" alignItems="center" spacing={2} py={1.5}>
                      <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.light', fontSize: 13, fontWeight: 700 }}>
                        {initials(member.staffName)}
                      </Avatar>
                      <Box flex={1} minWidth={0}>
                        <Typography variant="body2" fontWeight={600}>{member.staffName}</Typography>
                        <Typography variant="caption" color="text.secondary">{member.positionTitle}</Typography>
                      </Box>
                      <Stack alignItems="flex-end" spacing={0.25}>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <AccessTimeIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
                          <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                            {fmtTime(member.slotStart)} – {fmtTime(member.slotEnd)}
                          </Typography>
                        </Stack>
                        <Chip
                          size="small"
                          label={member.status === 'worked' ? t('eventClient.worked') : t('status.confirmed')}
                          color={member.status === 'worked' ? 'success' : 'primary'}
                          sx={{ fontSize: 10, height: 18 }}
                        />
                      </Stack>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
