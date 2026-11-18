import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import EventIcon from '@mui/icons-material/Event';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useTranslation } from 'react-i18next';
import { authApi } from '../../api/auth';
import { useAuthStore } from '../../stores/authStore';
import { portalHome } from '../../types';

export default function MagicLoginPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const { t } = useTranslation();
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    authApi.magicLogin(token)
      .then(({ data }) => {
        setAuth(data.user, data.accessToken);
        navigate(portalHome(data.user.role));
      })
      .catch(() => setError(t('auth.linkExpired')));
  }, [token, navigate, setAuth, t]);

  return (
    <Box sx={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      bgcolor: 'background.default', px: 3,
    }}>
      <Box sx={{ maxWidth: 360, width: '100%', textAlign: 'center' }}>
        <Box sx={{
          width: 64, height: 64, borderRadius: 2,
          background: 'linear-gradient(135deg, #4c2a85, #7c3aed)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          mx: 'auto', mb: 3,
        }}>
          <EventIcon sx={{ color: '#fff', fontSize: 32 }} />
        </Box>

        {error ? (
          <Stack spacing={2.5}>
            <Box>
              <Typography variant="h6" fontWeight={700} gutterBottom>{t('auth.invalidLink')}</Typography>
              <Typography variant="body2" color="text.secondary">{t('auth.linkExpired')}</Typography>
            </Box>
            <Alert severity="error">{error}</Alert>
            <Button variant="contained" fullWidth size="large" startIcon={<ArrowBackIcon />}
              onClick={() => navigate('/login')}
              sx={{ background: 'linear-gradient(135deg, #4c2a85, #7c3aed)', fontWeight: 700 }}>
              {t('auth.backToLogin')}
            </Button>
          </Stack>
        ) : (
          <Stack spacing={2} alignItems="center">
            <CircularProgress size={36} />
            <Typography variant="body1" fontWeight={500}>{t('auth.loggingIn')}</Typography>
            <Typography variant="caption" color="text.disabled">{t('auth.oneMoment')}</Typography>
          </Stack>
        )}
      </Box>
    </Box>
  );
}
