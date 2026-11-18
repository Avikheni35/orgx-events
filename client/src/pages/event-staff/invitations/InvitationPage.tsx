import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Box, Typography, Stack, Card, CardContent, Button, CircularProgress,
  Alert, TextField, Chip,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import WorkIcon from '@mui/icons-material/Work';
import EuroIcon from '@mui/icons-material/Euro';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { assignmentsApi } from '../../../api/assignments';

export default function InvitationPage() {
  const { token } = useParams<{ token: string }>();
  const { t } = useTranslation();
  const [note, setNote] = useState('');
  const [result, setResult] = useState<'confirmed' | 'declined' | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['invitation', token],
    queryFn: () => assignmentsApi.getInvitation(token!),
    retry: false,
  });
  const assignment = data?.data;

  const { mutate: respond, isPending } = useMutation({
    mutationFn: (response: 'confirmed' | 'declined') =>
      assignmentsApi.respond(token!, response, note || undefined),
    onSuccess: (_, response) => setResult(response),
  });

  if (isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}><CircularProgress /></Box>;
  }

  if (error || !assignment) {
    return (
      <Box sx={{ p: 3, maxWidth: 480, mx: 'auto' }}>
        <Alert severity="error">
          {t('eventStaff.invitation.invalid')}
        </Alert>
      </Box>
    );
  }

  if (result) {
    return (
      <Box sx={{ p: 3, maxWidth: 480, mx: 'auto', textAlign: 'center' }}>
        {result === 'confirmed' ? (
          <>
            <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
            <Typography variant="h6" fontWeight={700} mb={1}>{t('eventStaff.invitation.confirmed')}</Typography>
            <Typography color="text.secondary"
              dangerouslySetInnerHTML={{ __html: t('eventStaff.invitation.confirmedText', { event: `<strong>${assignment.eventName}</strong>` }) }} />
          </>
        ) : (
          <>
            <CancelIcon sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
            <Typography variant="h6" fontWeight={700} mb={1}>{t('eventStaff.invitation.declined')}</Typography>
            <Typography color="text.secondary"
              dangerouslySetInnerHTML={{ __html: t('eventStaff.invitation.declinedText', { event: `<strong>${assignment.eventName}</strong>` }) }} />
          </>
        )}
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, maxWidth: 480, mx: 'auto' }}>
      <Typography variant="h6" fontWeight={700} mb={0.5}>{t('eventStaff.invitation.title')}</Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        {t('eventStaff.invitation.subtitle')}
      </Typography>

      <Card elevation={2} sx={{ borderRadius: 2, mb: 2 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={700} mb={1.5}>{assignment.eventName}</Typography>
          <Stack spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center">
              <WorkIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="body2">{assignment.positionTitle}</Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <CalendarTodayIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="body2">
                {new Date(assignment.slotStart).toLocaleDateString(undefined, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <AccessTimeIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="body2">
                {new Date(assignment.slotStart).toLocaleTimeString(undefined, { timeStyle: 'short' })}
                {' – '}
                {new Date(assignment.slotEnd).toLocaleTimeString(undefined, { timeStyle: 'short' })}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <EuroIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="body2">{assignment.payRatePerHour} €/h</Typography>
            </Stack>
          </Stack>

          <Chip label={t('status.invited')} color="warning" size="small" sx={{ mt: 1.5 }} />
        </CardContent>
      </Card>

      <TextField
        fullWidth multiline rows={2} size="small"
        label={t('eventStaff.invitation.messageOptional')}
        placeholder={t('eventStaff.invitation.messagePlaceholder')}
        value={note} onChange={(e) => setNote(e.target.value)}
        sx={{ mb: 2 }}
      />

      <Stack direction="row" spacing={1.5}>
        <Button
          fullWidth variant="outlined" color="error" size="large"
          startIcon={<CancelIcon />}
          onClick={() => respond('declined')} disabled={isPending}
        >
          {t('assignments.decline')}
        </Button>
        <Button
          fullWidth variant="contained" color="success" size="large"
          startIcon={<CheckCircleIcon />}
          onClick={() => respond('confirmed')} disabled={isPending}
        >
          {t('assignments.confirm')}
        </Button>
      </Stack>
    </Box>
  );
}
