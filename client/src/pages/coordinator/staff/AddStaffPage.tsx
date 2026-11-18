import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Box, Typography, Card, CardContent, TextField, Button, Stack, Alert, Grid, Chip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { staffProfilesApi } from '../../../api/staffProfiles';

export default function AddStaffPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', notes: '' });
  const [skillInput, setSkillInput] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [error, setError] = useState('');
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const addSkill = () => {
    const s = skillInput.trim();
    if (s && !skills.includes(s)) setSkills((prev) => [...prev, s]);
    setSkillInput('');
  };

  const { mutate, isPending } = useMutation({
    mutationFn: () => staffProfilesApi.create({
      firstName: form.firstName, lastName: form.lastName, email: form.email,
      phone: form.phone || undefined, notes: form.notes || undefined, skills,
    }),
    onSuccess: (res) => navigate(`/coordinator/staff/${res.data._id}`),
    onError: () => setError(t('staff.createError')),
  });

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={3}>{t('staff.new')}</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Card>
        <CardContent>
          <Stack spacing={3}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField label={`${t('staff.firstName')} *`} value={form.firstName} onChange={(e) => set('firstName', e.target.value)} fullWidth />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField label={`${t('staff.lastName')} *`} value={form.lastName} onChange={(e) => set('lastName', e.target.value)} fullWidth />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField label={`${t('common.email')} *`} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} fullWidth />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField label={t('common.phone')} value={form.phone} onChange={(e) => set('phone', e.target.value)} fullWidth />
              </Grid>
            </Grid>

            <Box>
              <Typography variant="subtitle2" color="text.secondary" mb={1}>{t('staff.skills')}</Typography>
              <Stack direction="row" spacing={1} mb={1}>
                <TextField size="small" placeholder={t('staff.addSkillPlaceholder')} value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }} />
                <Button variant="outlined" size="small" onClick={addSkill}>{t('common.add')}</Button>
              </Stack>
              <Stack direction="row" flexWrap="wrap" gap={1}>
                {skills.map((s) => <Chip key={s} label={s} onDelete={() => setSkills((prev) => prev.filter((x) => x !== s))} />)}
              </Stack>
            </Box>

            <TextField label={t('common.notes')} value={form.notes} onChange={(e) => set('notes', e.target.value)} fullWidth multiline rows={3} />

            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <Button variant="outlined" onClick={() => navigate(-1)}>{t('common.cancel')}</Button>
              <Button variant="contained" onClick={() => mutate()} disabled={isPending || !form.firstName || !form.lastName || !form.email}>
                {t('staff.createProfile')}
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
