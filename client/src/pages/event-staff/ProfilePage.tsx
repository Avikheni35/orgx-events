import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Stack, Card, CardContent, Chip, Avatar, Divider,
  CircularProgress, Rating, Button,
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import WorkHistoryIcon from '@mui/icons-material/WorkHistory';
import TimerIcon from '@mui/icons-material/Timer';
import VerifiedIcon from '@mui/icons-material/Verified';
import LogoutIcon from '@mui/icons-material/Logout';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore';
import { staffProfilesApi } from '../../api/staffProfiles';
import { authApi } from '../../api/auth';

function initials(first: string, last: string) {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();
}

export default function EventStaffProfilePage() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleLogout = async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    logout();
    navigate('/event-staff/login', { replace: true });
  };

  const { data, isLoading } = useQuery({
    queryKey: ['my-staff-profile'],
    queryFn: () => staffProfilesApi.list({ limit: '1', email: user?.email ?? '' }),
  });
  const profile = data?.data?.profiles?.[0];

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;

  if (!profile) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="text.secondary">{t('eventStaff.profile.noProfile')}</Typography>
      </Box>
    );
  }

  const color = ['#1976d2', '#388e3c', '#7b1fa2', '#c62828', '#f57c00'][
    (profile.firstName.charCodeAt(0) ?? 0) % 5
  ];

  return (
    <Box sx={{ p: 2 }}>
      <Stack alignItems="center" spacing={1} mb={3} mt={1}>
        <Avatar sx={{ width: 72, height: 72, bgcolor: color, fontSize: 26, fontWeight: 700 }}>
          {initials(profile.firstName, profile.lastName)}
        </Avatar>
        <Typography variant="h6" fontWeight={700}>{profile.firstName} {profile.lastName}</Typography>
        <Rating value={profile.rating.average} precision={0.5} readOnly size="small" />
        <Typography variant="caption" color="text.secondary">
          {t('eventStaff.profile.ratings', { count: profile.rating.count })}
        </Typography>
        <Chip
          label={profile.directAssignable ? t('eventStaff.profile.directAssignable') : t('eventStaff.profile.standard')}
          color={profile.directAssignable ? 'warning' : 'default'}
          size="small"
        />
      </Stack>

      <Stack direction="row" spacing={1.5} mb={2}>
        <Card sx={{ flex: 1 }} elevation={1}>
          <CardContent sx={{ p: '10px !important', textAlign: 'center' }}>
            <WorkHistoryIcon sx={{ fontSize: 20, color: 'primary.main' }} />
            <Typography variant="h6" fontWeight={700}>{profile.totalEventsWorked}</Typography>
            <Typography variant="caption" color="text.secondary">{t('eventStaff.profile.eventsCount')}</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1 }} elevation={1}>
          <CardContent sx={{ p: '10px !important', textAlign: 'center' }}>
            <TimerIcon sx={{ fontSize: 20, color: 'primary.main' }} />
            <Typography variant="h6" fontWeight={700}>{Math.round(profile.totalHoursWorked)}</Typography>
            <Typography variant="caption" color="text.secondary">{t('eventStaff.profile.hoursCount')}</Typography>
          </CardContent>
        </Card>
      </Stack>

      <Card elevation={1} sx={{ mb: 2, borderRadius: 2 }}>
        <CardContent>
          <Typography variant="subtitle2" color="text.secondary" mb={1}>{t('eventStaff.profile.contact')}</Typography>
          <Stack spacing={1}>
            <Stack direction="row" spacing={1.25} alignItems="center">
              <EmailIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="body2">{profile.email}</Typography>
            </Stack>
            {profile.phone && (
              <Stack direction="row" spacing={1.25} alignItems="center">
                <PhoneIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="body2">{profile.phone}</Typography>
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>

      {profile.skills.length > 0 && (
        <Card elevation={1} sx={{ mb: 2, borderRadius: 2 }}>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary" mb={1}>{t('eventStaff.profile.skills')}</Typography>
            <Stack direction="row" flexWrap="wrap" gap={0.75}>
              {profile.skills.map((s) => <Chip key={s} label={s} size="small" color="primary" variant="outlined" />)}
            </Stack>
          </CardContent>
        </Card>
      )}

      {profile.certifications.length > 0 && (
        <Card elevation={1} sx={{ borderRadius: 2 }}>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary" mb={1}>{t('eventStaff.profile.certifications')}</Typography>
            <Stack spacing={1}>
              {profile.certifications.map((c, i) => (
                <Box key={c._id}>
                  {i > 0 && <Divider sx={{ mb: 1 }} />}
                  <Stack direction="row" spacing={1.25} alignItems="flex-start">
                    <VerifiedIcon sx={{ fontSize: 16, color: 'success.main', mt: 0.2 }} />
                    <Box>
                      <Typography variant="body2" fontWeight={600}>{c.name}</Typography>
                      {c.issuer && <Typography variant="caption" color="text.secondary">{c.issuer}</Typography>}
                      {c.expiryDate && (
                        <Typography variant="caption" display="block"
                          color={new Date(c.expiryDate) < new Date() ? 'error' : 'text.secondary'}>
                          {t('eventStaff.profile.validUntil', { date: new Date(c.expiryDate).toLocaleDateString() })}
                        </Typography>
                      )}
                    </Box>
                  </Stack>
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      {profile.notes && (
        <Card elevation={1} sx={{ mt: 2, borderRadius: 2 }}>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary" mb={0.5}>{t('common.notes')}</Typography>
            <Typography variant="body2">{profile.notes}</Typography>
          </CardContent>
        </Card>
      )}

      <Button
        fullWidth
        variant="outlined"
        color="error"
        startIcon={<LogoutIcon />}
        onClick={handleLogout}
        sx={{ mt: 3, mb: 1, borderRadius: 2 }}
      >
        {t('common.logout')}
      </Button>
    </Box>
  );
}
