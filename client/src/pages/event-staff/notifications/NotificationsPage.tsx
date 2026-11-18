import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Box, Typography, Card, CardContent, Stack, Chip, Button, CircularProgress, IconButton } from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { notificationsApi, type Notification } from '../../../api/notifications';

export default function StaffNotificationsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { t } = useTranslation();

  const TYPE_LABELS: Record<Notification['type'], string> = {
    assignment_confirmed: t('notifications.types.assignment_confirmed'),
    assignment_declined:  t('notifications.types.assignment_declined'),
    timesheet_approved:   t('notifications.types.timesheet_approved'),
    payment_paid:         t('notifications.types.payment_paid'),
    general:              t('notifications.types.general'),
  };

  const TYPE_COLORS: Record<Notification['type'], 'success' | 'primary' | 'info' | 'warning' | 'default'> = {
    assignment_confirmed: 'success',
    assignment_declined:  'warning',
    timesheet_approved:   'primary',
    payment_paid:         'info',
    general:              'default',
  };

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list(),
  });
  const notifications: Notification[] = data?.data?.notifications ?? [];
  const unread = notifications.filter((n) => !n.read).length;

  const { mutate: markRead } = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications-count'] });
    },
  });

  const { mutate: markAll, isPending: markingAll } = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications-count'] });
    },
  });

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1} mb={2}>
        <IconButton size="small" onClick={() => navigate(-1)}><ArrowBackIcon fontSize="small" /></IconButton>
        <Box flex={1}>
          <Typography variant="h6" fontWeight={700}>{t('notifications.title')}</Typography>
          {unread > 0 && (
            <Typography variant="caption" color="text.secondary">
              {t('notifications.unreadCount', { count: unread })}
            </Typography>
          )}
        </Box>
        {unread > 0 && (
          <Button
            startIcon={<DoneAllIcon />}
            onClick={() => markAll()}
            disabled={markingAll}
            size="small"
            variant="outlined"
          >
            {t('notifications.markAll')}
          </Button>
        )}
      </Stack>

      {isLoading && <Box sx={{ py: 6, textAlign: 'center' }}><CircularProgress /></Box>}

      {!isLoading && notifications.length === 0 && (
        <Box sx={{ py: 10, textAlign: 'center' }}>
          <NotificationsIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography color="text.secondary" variant="body2">{t('notifications.noNotifications')}</Typography>
        </Box>
      )}

      <Stack spacing={1.5}>
        {notifications.map((n) => (
          <Card
            key={n._id}
            variant="outlined"
            sx={{
              cursor: n.read ? 'default' : 'pointer',
              borderLeft: n.read ? undefined : '3px solid',
              borderLeftColor: n.read ? undefined : 'primary.main',
              opacity: n.read ? 0.7 : 1,
              '&:hover': n.read ? {} : { bgcolor: 'action.hover' },
            }}
            onClick={() => { if (!n.read) markRead(n._id); }}
          >
            <CardContent sx={{ p: '12px !important' }}>
              <Stack direction="row" alignItems="flex-start" spacing={1}>
                <Box flex={1}>
                  <Stack direction="row" alignItems="center" spacing={0.75} mb={0.5} flexWrap="wrap">
                    <Chip
                      label={TYPE_LABELS[n.type]}
                      size="small"
                      color={TYPE_COLORS[n.type]}
                      sx={{ fontSize: 10 }}
                    />
                    {!n.read && <Chip label={t('notifications.new')} size="small" color="primary" sx={{ fontSize: 9, height: 16 }} />}
                  </Stack>
                  <Typography variant="body2" fontWeight={700}>{n.title}</Typography>
                  <Typography variant="body2" color="text.secondary">{n.body}</Typography>
                  <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: 'block' }}>
                    {new Date(n.createdAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Box>
  );
}
