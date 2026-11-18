import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Box, Grid, Card, CardContent, Typography, Chip, Stack, Button, Divider } from '@mui/material';
import EventIcon from '@mui/icons-material/Event';
import PeopleIcon from '@mui/icons-material/People';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PaymentsIcon from '@mui/icons-material/Payments';
import { useNavigate } from 'react-router-dom';
import { eventsApi, type EventStatus } from '../../api/events';
import { staffProfilesApi } from '../../api/staffProfiles';
import { timesheetsApi } from '../../api/timesheets';
import { paymentsApi } from '../../api/payments';

const STATUS_COLORS: Record<EventStatus, 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'> = {
  draft: 'default', planning: 'info', staffing: 'secondary', confirmed: 'primary',
  in_progress: 'warning', completed: 'success', cancelled: 'error',
};

const STATUS_LABELS: Record<EventStatus, string> = {
  draft: 'Entwurf', planning: 'Planung', staffing: 'Besetzung', confirmed: 'Bestätigt',
  in_progress: 'Läuft', completed: 'Abgeschlossen', cancelled: 'Abgesagt',
};

function StatCard({ title, value, icon, color, onClick }: { title: string; value: number | string; icon: React.ReactNode; color: string; onClick?: () => void }) {
  return (
    <Card sx={{ cursor: onClick ? 'pointer' : 'default', '&:hover': onClick ? { boxShadow: 4 } : {} }} onClick={onClick}>
      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box sx={{ bgcolor: color, borderRadius: 2, p: 1.5, color: 'white', display: 'flex' }}>{icon}</Box>
        <Box>
          <Typography variant="h4" fontWeight={700}>{value}</Typography>
          <Typography variant="body2" color="text.secondary">{title}</Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

function getWeekRange() {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(now);
  weekEnd.setDate(now.getDate() + 7);
  weekEnd.setHours(23, 59, 59, 999);
  return { weekStart, weekEnd };
}

export default function CoordinatorDashboardPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const now = new Date();
  const currentYear  = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const { data: eventsData }    = useQuery({ queryKey: ['events', 'active'],    queryFn: () => eventsApi.list({ status: 'in_progress', limit: '5' }) });
  const { data: upcomingData }  = useQuery({ queryKey: ['events', 'upcoming'],  queryFn: () => eventsApi.list({ status: 'confirmed', limit: '20' }) });
  const { data: staffData }     = useQuery({ queryKey: ['staff', 'count'],      queryFn: () => staffProfilesApi.list({ limit: '1' }) });
  const { data: tsData }        = useQuery({ queryKey: ['timesheets', 'pending'], queryFn: () => timesheetsApi.list({ status: 'pending', limit: '1' }) });
  const { data: paymentsData }  = useQuery({
    queryKey: ['payments', 'pending-count', currentYear, currentMonth],
    queryFn: () => paymentsApi.list({ year: currentYear, month: currentMonth, status: 'pending' }),
  });

  const pendingPaymentsCount = paymentsData?.data?.payments?.length ?? 0;

  const { weekEnd } = getWeekRange();
  const thisWeekEvents = (upcomingData?.data?.events ?? []).filter((ev) => {
    const d = new Date(ev.startDate);
    return d <= weekEnd;
  }).slice(0, 5);

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={3}>{t('dashboard.title')}</Typography>

      <Grid container spacing={2} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title={t('dashboard.upcomingEvents')} value={eventsData?.data?.total ?? '—'} icon={<EventIcon />} color="#6c3fc5"
            onClick={() => navigate('/coordinator/events?status=in_progress')} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title={t('nav.staff')} value={staffData?.data?.total ?? '—'} icon={<PeopleIcon />} color="#10b981"
            onClick={() => navigate('/coordinator/staff')} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title={t('dashboard.openTimesheets')} value={tsData?.data?.total ?? '—'} icon={<AccessTimeIcon />} color="#f59e0b"
            onClick={() => navigate('/coordinator/timesheets')} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title={t('dashboard.pendingInvoices')} value={pendingPaymentsCount} icon={<PaymentsIcon />} color="#ef4444"
            onClick={() => navigate('/coordinator/payments')} />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" fontWeight={600}>{t('dashboard.recentEvents')}</Typography>
                <Button size="small" onClick={() => navigate('/coordinator/events?status=in_progress')}>{t('common.all')}</Button>
              </Stack>
              <Divider sx={{ mb: 2 }} />
              {(eventsData?.data?.events?.length ?? 0) === 0 && (
                <Typography variant="body2" color="text.secondary">{t('dashboard.noUpcomingEvents')}</Typography>
              )}
              <Stack spacing={1}>
                {eventsData?.data?.events?.map((ev) => (
                  <Box key={ev._id}
                    sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', p: 1, borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}
                    onClick={() => navigate(`/coordinator/events/${ev._id}`)}>
                    <Box>
                      <Typography variant="body2" fontWeight={600}>{ev.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{ev.clientName}</Typography>
                    </Box>
                    <Chip label={STATUS_LABELS[ev.status]} color={STATUS_COLORS[ev.status]} size="small" />
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" fontWeight={600}>{t('dashboard.thisMonth')}</Typography>
                <Button size="small" onClick={() => navigate('/coordinator/events?status=confirmed')}>{t('common.all')}</Button>
              </Stack>
              <Divider sx={{ mb: 2 }} />
              {thisWeekEvents.length === 0 && (
                <Typography variant="body2" color="text.secondary">{t('dashboard.noUpcomingEvents')}</Typography>
              )}
              <Stack spacing={1}>
                {thisWeekEvents.map((ev) => (
                  <Box key={ev._id}
                    sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', p: 1, borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}
                    onClick={() => navigate(`/coordinator/events/${ev._id}`)}>
                    <Box>
                      <Typography variant="body2" fontWeight={600}>{ev.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(ev.startDate).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                        {ev.clientName ? ` · ${ev.clientName}` : ''}
                      </Typography>
                    </Box>
                    <Button size="small" variant="outlined" onClick={(e) => { e.stopPropagation(); navigate(`/coordinator/events/${ev._id}/workforce`); }}>
                      Workforce
                    </Button>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
