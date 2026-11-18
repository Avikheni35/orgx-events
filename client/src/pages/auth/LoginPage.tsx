import { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { APP_EVENTS, APP_PLATFORM } from '@/config/brand';
import {
  Box, TextField, Button, Typography, Alert, Stack, Link,
  InputAdornment, IconButton, Divider,
} from '@mui/material';
import EventIcon from '@mui/icons-material/Event';
import EmailIcon from '@mui/icons-material/Email';
import LockIcon from '@mui/icons-material/Lock';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import BadgeIcon from '@mui/icons-material/Badge';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import { useTranslation } from 'react-i18next';
import { authApi } from '../../api/auth';
import { useAuthStore } from '../../stores/authStore';
import type { AuthUser } from '../../types';
import { portalHome } from '../../types';

export default function LoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantCode, setTenantCode] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const FEATURES = [
    { icon: <CalendarMonthIcon sx={{ fontSize: 20 }} />, text: t('login.feature1') },
    { icon: <PeopleAltIcon sx={{ fontSize: 20 }} />, text: t('login.feature2') },
    { icon: <AssignmentTurnedInIcon sx={{ fontSize: 20 }} />, text: t('login.feature3') },
    { icon: <BadgeIcon sx={{ fontSize: 20 }} />, text: t('login.feature4') },
  ];

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await authApi.login(email, password, tenantCode || undefined);
      if ('requiresOtp' in res.data && res.data.requiresOtp) {
        setStep('otp');
      } else {
        const { accessToken, user } = res.data as { accessToken: string; user: AuthUser };
        setAuth(user, accessToken);
        navigate(portalHome(user.role));
      }
    } catch {
      setError(t('auth.invalidCredentials'));
    } finally {
      setLoading(false);
    }
  };

  const handleOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const { data } = await authApi.verifyOtp(email, otp, tenantCode || undefined);
      setAuth(data.user, data.accessToken);
      navigate(portalHome(data.user.role));
    } catch {
      setError(t('auth.loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Left branding panel */}
      <Box sx={{
        display: { xs: 'none', md: 'flex' },
        width: '42%', flexShrink: 0, flexDirection: 'column',
        justifyContent: 'center', px: 6, py: 8,
        background: 'linear-gradient(160deg, #1a0f3c 0%, #2d1b69 60%, #4c2a85 100%)',
        color: '#fff', position: 'relative', overflow: 'hidden',
      }}>
        <Box sx={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'rgba(124,58,237,0.12)', top: -100, right: -120, pointerEvents: 'none' }} />
        <Box sx={{ position: 'absolute', width: 250, height: 250, borderRadius: '50%', background: 'rgba(124,58,237,0.08)', bottom: 40, left: -60, pointerEvents: 'none' }} />
        <Stack spacing={1} mb={5} sx={{ position: 'relative' }}>
          <Box sx={{ width: 52, height: 52, borderRadius: 2, bgcolor: 'rgba(124,58,237,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
            <EventIcon sx={{ fontSize: 30, color: '#c4b5fd' }} />
          </Box>
          <Typography variant="overline" sx={{ color: '#a78bfa', letterSpacing: 3, fontSize: '0.7rem' }}>{APP_PLATFORM}</Typography>
          <Typography variant="h4" fontWeight={800} lineHeight={1.2} sx={{ color: '#fff' }}>{t('login.headline')}</Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.55)', mt: 1, maxWidth: 280 }}>{t('login.subheadline')}</Typography>
        </Stack>
        <Stack spacing={2} sx={{ position: 'relative' }}>
          {FEATURES.map((f) => (
            <Stack key={f.text} direction="row" spacing={1.5} alignItems="center">
              <Box sx={{ width: 36, height: 36, borderRadius: 1.5, flexShrink: 0, bgcolor: 'rgba(124,58,237,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c4b5fd' }}>{f.icon}</Box>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.75)' }}>{f.text}</Typography>
            </Stack>
          ))}
        </Stack>
        <Box sx={{ mt: 'auto', pt: 6, position: 'relative' }}>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.12)', mb: 2.5 }} />
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.35)' }}>
            {t('auth.staffPortalQuestion')} →{' '}
            <Link component={RouterLink} to="/event-staff/login" sx={{ color: 'rgba(167,139,250,0.7)', textDecorationColor: 'transparent' }}>event-staff/login</Link>
          </Typography>
        </Box>
      </Box>

      {/* Right login form */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', px: { xs: 3, sm: 6 }, py: 6, bgcolor: 'background.default' }}>
        <Stack alignItems="center" spacing={0.5} mb={4} sx={{ display: { md: 'none' } }}>
          <Box sx={{ width: 48, height: 48, borderRadius: 2, background: 'linear-gradient(135deg, #4c2a85, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <EventIcon sx={{ color: '#fff', fontSize: 26 }} />
          </Box>
          <Typography variant="h6" fontWeight={700}>{APP_EVENTS}</Typography>
        </Stack>

        <Box sx={{ width: '100%', maxWidth: 400 }}>
          {step === 'credentials' ? (
            <>
              <Typography variant="h5" fontWeight={700} mb={0.5}>{t('auth.loginTitle')}</Typography>
              <Typography variant="body2" color="text.secondary" mb={3}>{t('auth.coordinatorSubtitle')}</Typography>
              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
              <form onSubmit={handleLogin}>
                <Stack spacing={2.5}>
                  <TextField label={t('auth.email')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required fullWidth autoFocus
                    InputProps={{ startAdornment: <InputAdornment position="start"><EmailIcon sx={{ fontSize: 18, color: 'text.secondary' }} /></InputAdornment> }} />
                  <TextField label={t('auth.password')} type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required fullWidth
                    InputProps={{
                      startAdornment: <InputAdornment position="start"><LockIcon sx={{ fontSize: 18, color: 'text.secondary' }} /></InputAdornment>,
                      endAdornment: <InputAdornment position="end"><IconButton size="small" onClick={() => setShowPw((v) => !v)} edge="end">{showPw ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}</IconButton></InputAdornment>,
                    }} />
                  <TextField label={t('auth.tenantCode')} value={tenantCode} onChange={(e) => setTenantCode(e.target.value)} fullWidth placeholder="z. B. demo" helperText={t('auth.tenantCodeHelper')} />
                  <Button type="submit" variant="contained" fullWidth disabled={loading} size="large"
                    sx={{ background: 'linear-gradient(135deg, #4c2a85, #7c3aed)', '&:hover': { background: 'linear-gradient(135deg, #3b2068, #6d28d9)' }, fontWeight: 700, py: 1.4 }}>
                    {loading ? t('auth.loggingInProgress') : t('auth.login')}
                  </Button>
                </Stack>
              </form>
              <Divider sx={{ my: 3 }}><Typography variant="caption" color="text.disabled">{t('auth.staffPortalQuestion')}</Typography></Divider>
              <Button component={RouterLink} to="/event-staff/login" variant="outlined" fullWidth color="inherit" sx={{ color: 'text.secondary', borderColor: 'divider' }}>
                {t('auth.toEventStaffPortal')}
              </Button>
            </>
          ) : (
            <>
              <Typography variant="h5" fontWeight={700} mb={0.5}>{t('auth.twoFactor')}</Typography>
              <Typography variant="body2" color="text.secondary" mb={3} dangerouslySetInnerHTML={{ __html: t('auth.otpSent', { email: `<strong>${email}</strong>` }) }} />
              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
              <form onSubmit={handleOtp}>
                <Stack spacing={2.5}>
                  <TextField label={t('auth.otpCode')} value={otp} onChange={(e) => setOtp(e.target.value)} required fullWidth autoFocus inputProps={{ maxLength: 6, inputMode: 'numeric', pattern: '[0-9]*' }} />
                  <Button type="submit" variant="contained" fullWidth disabled={loading} size="large"
                    sx={{ background: 'linear-gradient(135deg, #4c2a85, #7c3aed)', fontWeight: 700, py: 1.4 }}>
                    {loading ? t('auth.verifying') : t('common.confirm')}
                  </Button>
                  <Button variant="text" onClick={() => { setStep('credentials'); setError(''); }}>{t('auth.backToLoginArrow')}</Button>
                </Stack>
              </form>
            </>
          )}
        </Box>

        <Stack direction="row" spacing={2} mt={6} flexWrap="wrap" justifyContent="center">
          <Link component={RouterLink} to="/impressum" variant="caption" color="text.disabled" underline="hover">Impressum</Link>
          <Link component={RouterLink} to="/datenschutz" variant="caption" color="text.disabled" underline="hover">Datenschutz</Link>
          <Link component={RouterLink} to="/agb" variant="caption" color="text.disabled" underline="hover">AGB</Link>
        </Stack>
      </Box>
    </Box>
  );
}
