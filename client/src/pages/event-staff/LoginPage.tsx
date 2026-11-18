import { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Alert, Box, Button, Divider, InputAdornment, IconButton,
  Link, Stack, TextField, Typography,
} from '@mui/material';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import EmailIcon from '@mui/icons-material/Email';
import LockIcon from '@mui/icons-material/Lock';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { useTranslation } from 'react-i18next';
import { authApi } from '../../api/auth';
import { setApiToken } from '../../api/client';
import { useAuthStore } from '../../stores/authStore';

export default function EventStaffLoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const { data } = await authApi.login(email.trim(), password, 'demo');
      if ('accessToken' in data && data.accessToken) {
        setApiToken(data.accessToken);
        const user = await authApi.me();
        if (user.role !== 'event_staff') {
          setError(t('auth.staffPortalOnly'));
          return;
        }
        setAuth(user, data.accessToken);
        navigate('/event-staff/home', { replace: true });
      } else {
        setError(t('auth.loginFailed'));
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? t('auth.invalidPassword'));
    } finally { setLoading(false); }
  };

  return (
    <Box sx={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      bgcolor: 'background.default', px: 3, py: 6,
    }}>
      <Stack alignItems="center" spacing={0.5} mb={4}>
        <Box sx={{
          width: 52, height: 52, borderRadius: 2,
          background: 'linear-gradient(135deg, #4c2a85, #7c3aed)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <EventAvailableIcon sx={{ color: '#fff', fontSize: 28 }} />
        </Box>
        <Typography variant="h6" fontWeight={700} mt={0.5}>{t('auth.staffPortalTitle')}</Typography>
        <Typography variant="body2" color="text.secondary">{t('auth.staffLoginSubtitle')}</Typography>
      </Stack>

      <Box sx={{ width: '100%', maxWidth: 380 }}>
        <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 3, p: { xs: 3, sm: 4 } }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <form onSubmit={handleSubmit}>
            <Stack spacing={2.5}>
              <TextField
                fullWidth label={t('auth.email')} type="email" required autoFocus
                value={email} onChange={(e) => setEmail(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><EmailIcon sx={{ fontSize: 18, color: 'text.secondary' }} /></InputAdornment> }}
              />
              <TextField
                fullWidth label={t('auth.password')} required
                type={showPw ? 'text' : 'password'}
                value={password} onChange={(e) => setPassword(e.target.value)}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><LockIcon sx={{ fontSize: 18, color: 'text.secondary' }} /></InputAdornment>,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowPw((v) => !v)} edge="end">
                        {showPw ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <Button
                fullWidth variant="contained" size="large" type="submit"
                disabled={loading || !email.trim() || !password}
                sx={{
                  background: 'linear-gradient(135deg, #4c2a85, #7c3aed)',
                  '&:hover': { background: 'linear-gradient(135deg, #3b2068, #6d28d9)' },
                  fontWeight: 700, py: 1.4,
                }}
              >
                {loading ? t('auth.loggingInProgress') : t('auth.login')}
              </Button>
            </Stack>
          </form>
        </Box>

        <Divider sx={{ my: 2.5 }}>
          <Typography variant="caption" color="text.disabled">{t('auth.coordinatorQuestion')}</Typography>
        </Divider>

        <Button
          component={RouterLink} to="/login"
          variant="outlined" fullWidth color="inherit"
          sx={{ borderColor: 'divider', color: 'text.secondary' }}
        >
          {t('auth.toCoordinatorPortal')}
        </Button>

        <Stack direction="row" spacing={2} mt={4} justifyContent="center">
          <Link component={RouterLink} to="/impressum" variant="caption" color="text.disabled" underline="hover">Impressum</Link>
          <Link component={RouterLink} to="/datenschutz" variant="caption" color="text.disabled" underline="hover">Datenschutz</Link>
          <Link component={RouterLink} to="/agb" variant="caption" color="text.disabled" underline="hover">AGB</Link>
        </Stack>
      </Box>
    </Box>
  );
}
