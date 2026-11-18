import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Typography, Card, CardContent, Grid, Stack, Button, Chip, Alert,
  Avatar, Divider,
} from '@mui/material';
import EventIcon from '@mui/icons-material/Event';
import ReceiptIcon from '@mui/icons-material/Receipt';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useTranslation } from 'react-i18next';
import { eventClientPortalApi } from '../../api/eventClientPortal';
import { useAuthStore } from '../../stores/authStore';

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).setHours(0,0,0,0) - new Date().setHours(0,0,0,0);
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

function CountdownBadge({ days }: { days: number }) {
  const { t } = useTranslation();
  if (days < 0) return <Chip size="small" label={t('eventClient.past')} color="default" />;
  if (days === 0) return <Chip size="small" label={t('eventClient.today')} color="warning" />;
  return <Chip size="small" label={t('eventClient.inDays', { count: days })} color={days <= 7 ? 'warning' : 'default'} />;
}

export default function EventClientHomePage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { data: clientData } = useQuery({ queryKey: ['ec-me'], queryFn: () => eventClientPortalApi.me() });
  const client = clientData?.data;

  const { data: eventsData } = useQuery({
    queryKey: ['ec-events-all'],
    queryFn: () => eventClientPortalApi.listEvents({ limit: '200' }),
  });
  const events = eventsData?.data?.events ?? [];

  const upcoming = events
    .filter(e => ['planning', 'staffing', 'confirmed', 'in_progress'].includes(e.status))
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  const needsApproval = events.filter(
    e => e.requiresClientApproval && !e.clientApprovedAt && e.status === 'planning'
  );

  const thisYear = new Date().getFullYear();
  const eventsThisYear = events.filter(e => new Date(e.startDate).getFullYear() === thisYear).length;

  const { data: invoicesData } = useQuery({
    queryKey: ['ec-invoices-all'],
    queryFn: () => eventClientPortalApi.listInvoices({ limit: '200' }),
  });
  const invoices = invoicesData?.data?.invoices ?? [];
  const openInvoices = invoices.filter(i => i.status === 'sent');
  const openTotal = openInvoices.reduce((s, i) => s + i.total, 0);
  const overdue = openInvoices.filter(i => new Date(i.dueDate) < new Date());

  const statusLabels: Record<string, string> = {
    draft: t('eventClient.statusLabels.draft'),
    planning: t('eventClient.statusLabels.planning'),
    staffing: t('eventClient.statusLabels.staffing'),
    confirmed: t('eventClient.statusLabels.confirmed'),
    in_progress: t('eventClient.statusLabels.in_progress'),
    completed: t('eventClient.statusLabels.completed'),
    cancelled: t('eventClient.statusLabels.cancelled'),
  };
  const statusColors: Record<string, 'default' | 'info' | 'warning' | 'primary' | 'success' | 'error'> = {
    draft: 'default', planning: 'info', staffing: 'warning', confirmed: 'primary',
    in_progress: 'primary', completed: 'success', cancelled: 'error',
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={3} flexWrap="wrap" gap={1}>
        <Box>
          <Typography variant="h5" fontWeight={800} lineHeight={1.1}>
            {t('eventClient.welcome', { name: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() })}
          </Typography>
          {client && (
            <Typography variant="body2" color="text.secondary" mt={0.25}>{client.name}</Typography>
          )}
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" size="small" startIcon={<EventIcon />} onClick={() => navigate('/event-client/events')}>
            {t('eventClient.allEvents')}
          </Button>
          <Button variant="outlined" size="small" startIcon={<ReceiptIcon />} onClick={() => navigate('/event-client/invoices')}>
            {t('eventClient.invoices')}
          </Button>
        </Stack>
      </Stack>

      {needsApproval.map(e => (
        <Alert
          key={e._id}
          severity="warning"
          icon={<WarningAmberIcon />}
          sx={{ mb: 1.5, cursor: 'pointer' }}
          onClick={() => navigate(`/event-client/events/${e._id}`)}
          action={
            <Button size="small" color="warning" variant="contained" onClick={ev => { ev.stopPropagation(); navigate(`/event-client/events/${e._id}`); }}>
              {t('eventClient.approveNow')}
            </Button>
          }
        >
          <strong>{e.name}</strong> {t('eventClient.needsApproval')}
          &nbsp;·&nbsp;{new Date(e.startDate).toLocaleDateString()}
        </Alert>
      ))}

      <Grid container spacing={2} mb={3}>
        {[
          {
            label: t('eventClient.upcomingEvents'),
            value: upcoming.length,
            icon: <EventIcon />,
            color: 'primary.main',
          },
          {
            label: t('eventClient.eventsThisYear', { year: thisYear }),
            value: eventsThisYear,
            icon: <CheckCircleIcon />,
            color: 'success.main',
          },
          {
            label: t('eventClient.openInvoices'),
            value: openInvoices.length,
            icon: <ReceiptIcon />,
            color: openInvoices.length > 0 ? 'warning.main' : 'text.primary',
          },
          {
            label: t('eventClient.openAmount'),
            value: `€ ${openTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
            icon: <AccessTimeIcon />,
            color: overdue.length > 0 ? 'error.main' : 'text.primary',
          },
        ].map(kpi => (
          <Grid item xs={6} sm={6} md={3} key={kpi.label}>
            <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
              <CardContent sx={{ pb: '12px !important' }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600} display="block">
                  {kpi.label}
                </Typography>
                <Typography variant="h4" fontWeight={800} sx={{ color: kpi.color, mt: 0.5 }}>
                  {kpi.value}
                </Typography>
                {kpi.label === t('eventClient.openInvoices') && overdue.length > 0 && (
                  <Typography variant="caption" color="error.main" fontWeight={600}>
                    {t('eventClient.overdue', { count: overdue.length })}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={7}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', height: '100%' }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
                <Typography variant="subtitle1" fontWeight={700}>{t('eventClient.upcomingEvents')}</Typography>
                <Button size="small" onClick={() => navigate('/event-client/events')}>{t('eventClient.all')}</Button>
              </Stack>
              {upcoming.length === 0 ? (
                <Typography variant="body2" color="text.secondary" py={2} align="center">
                  {t('eventClient.noUpcomingEvents')}
                </Typography>
              ) : (
                <Stack spacing={0}>
                  {upcoming.slice(0, 6).map((e, idx) => {
                    const days = daysUntil(e.startDate);
                    const needsConfirm = e.requiresClientApproval && !e.clientApprovedAt && e.status === 'planning';
                    return (
                      <Box key={e._id}>
                        {idx > 0 && <Divider />}
                        <Stack
                          direction="row" alignItems="center" spacing={2} py={1.25}
                          sx={{ cursor: 'pointer', borderRadius: 1, px: 0.5, '&:hover': { bgcolor: 'action.hover' } }}
                          onClick={() => navigate(`/event-client/events/${e._id}`)}
                        >
                          <Box sx={{
                            minWidth: 44, textAlign: 'center',
                            bgcolor: days <= 7 ? 'warning.50' : 'action.selected',
                            borderRadius: 1.5, py: 0.5,
                          }}>
                            <Typography sx={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: 'text.secondary', lineHeight: 1 }}>
                              {new Date(e.startDate).toLocaleDateString(undefined, { month: 'short' })}
                            </Typography>
                            <Typography sx={{ fontSize: 20, fontWeight: 800, lineHeight: 1.1, color: days <= 7 ? 'warning.dark' : 'text.primary' }}>
                              {new Date(e.startDate).getDate()}
                            </Typography>
                          </Box>

                          <Box flex={1} minWidth={0}>
                            <Stack direction="row" alignItems="center" spacing={0.75} flexWrap="wrap">
                              <Typography variant="body2" fontWeight={700} noWrap>{e.name}</Typography>
                              {needsConfirm && <Chip size="small" color="warning" label={t('eventClient.approvalPending')} sx={{ fontSize: 10, height: 18 }} />}
                            </Stack>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Chip label={statusLabels[e.status] ?? e.status} color={statusColors[e.status] ?? 'default'} size="small" sx={{ fontSize: 10, height: 18 }} />
                              {e.venueName && (
                                <Typography variant="caption" color="text.secondary" noWrap>{e.venueName}</Typography>
                              )}
                            </Stack>
                          </Box>

                          <CountdownBadge days={days} />
                        </Stack>
                      </Box>
                    );
                  })}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={5}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', height: '100%' }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
                <Typography variant="subtitle1" fontWeight={700}>{t('eventClient.openInvoices')}</Typography>
                <Button size="small" onClick={() => navigate('/event-client/invoices')}>{t('eventClient.all')}</Button>
              </Stack>
              {openInvoices.length === 0 ? (
                <Stack alignItems="center" py={3} spacing={1}>
                  <Avatar sx={{ bgcolor: 'success.light', width: 40, height: 40 }}>
                    <CheckCircleIcon color="success" />
                  </Avatar>
                  <Typography variant="body2" color="text.secondary">{t('eventClient.allPaid')}</Typography>
                </Stack>
              ) : (
                <Stack spacing={0}>
                  {openInvoices.slice(0, 5).map((inv, idx) => {
                    const isOverdue = new Date(inv.dueDate) < new Date();
                    return (
                      <Box key={inv._id}>
                        {idx > 0 && <Divider />}
                        <Stack
                          direction="row" alignItems="center" spacing={1.5} py={1.25}
                          sx={{ cursor: 'pointer', borderRadius: 1, px: 0.5, '&:hover': { bgcolor: 'action.hover' } }}
                          onClick={() => navigate(`/event-client/invoices/${inv._id}`)}
                        >
                          <Box flex={1} minWidth={0}>
                            <Typography variant="body2" fontWeight={700} noWrap>{inv.invoiceNumber}</Typography>
                            <Typography variant="caption" color={isOverdue ? 'error.main' : 'text.secondary'} fontWeight={isOverdue ? 700 : 400}>
                              {t('eventClient.dueLabel', { date: new Date(inv.dueDate).toLocaleDateString() })}
                              {isOverdue ? ` ${t('eventClient.overdueLabel')}` : ''}
                            </Typography>
                          </Box>
                          <Typography variant="body2" fontWeight={700} sx={{ fontVariantNumeric: 'tabular-nums', color: isOverdue ? 'error.main' : 'text.primary', flexShrink: 0 }}>
                            € {inv.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </Typography>
                        </Stack>
                      </Box>
                    );
                  })}
                  {openInvoices.length > 0 && (
                    <>
                      <Divider />
                      <Stack direction="row" justifyContent="space-between" alignItems="center" pt={1.25} px={0.5}>
                        <Typography variant="caption" fontWeight={700} color="text.secondary">
                          {t('eventClient.totalOpen', { count: openInvoices.length })}
                        </Typography>
                        <Typography variant="body2" fontWeight={800} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                          € {openTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </Typography>
                      </Stack>
                    </>
                  )}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
