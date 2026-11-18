import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDroppable, useDraggable,
  type DragStartEvent, type DragEndEvent, type DragOverEvent,
} from '@dnd-kit/core';
import {
  Box, Typography, Stack, Chip, Card, CardContent, Divider, Avatar,
  IconButton, Alert, CircularProgress, LinearProgress,
  Paper, useTheme, Dialog, DialogTitle, DialogContent, DialogActions,
  Button,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import CancelIcon from '@mui/icons-material/Cancel';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import CloseIcon from '@mui/icons-material/Close';
import StarIcon from '@mui/icons-material/Star';
import StarHalfIcon from '@mui/icons-material/StarHalf';
import StarOutlineIcon from '@mui/icons-material/StarOutline';
import BlockIcon from '@mui/icons-material/Block';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import WorkHistoryIcon from '@mui/icons-material/WorkHistory';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import PersonIcon from '@mui/icons-material/Person';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import TimerIcon from '@mui/icons-material/Timer';
import VerifiedIcon from '@mui/icons-material/Verified';
import { eventsApi, type EventPosition, type EventTimeSlot } from '../../../api/events';
import { staffProfilesApi, type StaffProfile } from '../../../api/staffProfiles';
import { assignmentsApi, type Assignment, type AssignmentStatus } from '../../../api/assignments';
import { eventApplicationsApi, type EventApplication } from '../../../api/eventApplications';
import { staffAvailabilityApi, type StaffAvailability } from '../../../api/staffAvailability';

// ── Constants ────────────────────────────────────────────────────────────────

const MIN_REST_HOURS = 8; // minimum hours between event shifts

// ── Helpers ──────────────────────────────────────────────────────────────────

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseHHMM(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

function isAvailableForSlot(
  avail: StaffAvailability | null | undefined,
  slotStart: Date,
  slotEnd: Date,
): { available: boolean; reason?: string } {
  if (!avail) return { available: true };

  // Check a single datetime point against its day's availability + time window.
  // checkEnd=true means we're checking an end time (only upper bound matters).
  const checkPoint = (dt: Date, checkEnd: boolean): { ok: boolean; reason?: string } => {
    const iso = isoDate(dt);
    const override = avail!.dateOverrides?.find(o => isoDate(new Date(o.date)) === iso);
    if (override) {
      return override.available ? { ok: true } : { ok: false, reason: 'Abgemeldet für diesen Tag' };
    }
    const dow = dt.getDay();
    const pat = avail!.weeklyPattern?.find(s => s.dayOfWeek === dow);
    const dayAvail = pat?.available ?? (dow >= 1 && dow <= 5);
    if (!dayAvail) return { ok: false, reason: 'Nicht verfügbar laut Wochenmuster' };
    if (pat?.startTime && pat?.endTime) {
      const minOfDay = dt.getHours() * 60 + dt.getMinutes();
      if (!checkEnd && minOfDay < parseHHMM(pat.startTime))
        return { ok: false, reason: `Verfügbarkeit beginnt erst um ${pat.startTime}` };
      if (checkEnd && minOfDay > parseHHMM(pat.endTime))
        return { ok: false, reason: `Verfügbarkeit endet um ${pat.endTime}` };
    }
    return { ok: true };
  };

  // Always check start time
  const sc = checkPoint(slotStart, false);
  if (!sc.ok) return { available: false, reason: sc.reason };

  const sameDay = isoDate(slotStart) === isoDate(slotEnd);

  if (sameDay) {
    // Same-day slot: check end time against start day's window
    const ec = checkPoint(slotEnd, true);
    if (!ec.ok) return { available: false, reason: ec.reason };
  } else {
    // Slot spans midnight: start day's window must reach midnight, and end day must allow the end time
    const startIso = isoDate(slotStart);
    const startOverride = avail.dateOverrides?.find(o => isoDate(new Date(o.date)) === startIso);
    if (!startOverride) {
      const dow = slotStart.getDay();
      const pat = avail.weeklyPattern?.find(s => s.dayOfWeek === dow);
      if (pat?.endTime) {
        const winEnd = parseHHMM(pat.endTime);
        if (winEnd < 23 * 60 + 59)
          return { available: false, reason: `Schicht geht über Mitternacht, Verfügbarkeit endet um ${pat.endTime}` };
      }
    }
    // Check the end time point (skip if exactly midnight = 00:00 end)
    if (slotEnd.getHours() !== 0 || slotEnd.getMinutes() !== 0) {
      const ec = checkPoint(slotEnd, true);
      if (!ec.ok) return { available: false, reason: ec.reason };
    }
  }

  return { available: true };
}

function timesOverlap(aS: Date, aE: Date, bS: Date, bE: Date) {
  return aS < bE && bS < aE;
}

function fmt(d: Date | string, style: 'time' | 'datetime' = 'time') {
  const dt = typeof d === 'string' ? new Date(d) : d;
  return style === 'time'
    ? dt.toLocaleTimeString('de-DE', { timeStyle: 'short' })
    : dt.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
}

function initials(s: StaffProfile) {
  return `${s.firstName[0] ?? ''}${s.lastName[0] ?? ''}`.toUpperCase();
}

function avatarColor(name: string) {
  const colors = ['#1976d2', '#388e3c', '#7b1fa2', '#c62828', '#f57c00', '#00796b', '#5d4037', '#455a64'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % colors.length;
  return colors[h];
}

// ── Staff availability per slot ───────────────────────────────────────────────

type AvailStatus = 'available' | 'in_slot' | 'conflict' | 'rest_violation' | 'unavailable';

interface SlotAvailability {
  status: AvailStatus;
  reason?: string;
}

function getSlotAvailability(
  profile: StaffProfile,
  slot: EventTimeSlot,
  inEventAssignments: Assignment[],
  periodConflicts: Record<string, Assignment[]>,
  availRecord?: StaffAvailability | null,
): SlotAvailability {
  const slotStart = new Date(slot.startTime);
  const slotEnd   = new Date(slot.endTime);
  const pid = profile._id;

  // Check staff's own availability (date overrides / weekly pattern + time window)
  const availCheck = isAvailableForSlot(availRecord, slotStart, slotEnd);
  if (!availCheck.available) {
    return { status: 'unavailable', reason: availCheck.reason };
  }

  // Already in this specific slot
  const alreadyHere = inEventAssignments.find(
    (a) => a.staffProfileId === pid && a.slotId === slot._id && !['declined', 'cancelled'].includes(a.status)
  );
  if (alreadyHere) return { status: 'in_slot', reason: 'Bereits zugewiesen' };

  // Combine all known assignments for this person
  const allAssignments: Assignment[] = [
    ...inEventAssignments.filter((a) => a.staffProfileId === pid && !['declined', 'cancelled'].includes(a.status) && a.slotId !== slot._id),
    ...(periodConflicts[pid] ?? []),
  ];

  // Direct time overlap (conflict)
  for (const a of allAssignments) {
    const aS = new Date(a.slotStart);
    const aE = new Date(a.slotEnd);
    if (timesOverlap(aS, aE, slotStart, slotEnd)) {
      return {
        status: 'conflict',
        reason: `Besetzt: ${a.eventName !== undefined ? a.eventName + ' · ' : ''}${fmt(a.slotStart)}–${fmt(a.slotEnd)}`,
      };
    }
  }

  // Rest period violation
  for (const a of allAssignments) {
    const aS = new Date(a.slotStart);
    const aE = new Date(a.slotEnd);
    const hoursBefore = (slotStart.getTime() - aE.getTime()) / 3_600_000;
    const hoursAfter  = (aS.getTime() - slotEnd.getTime()) / 3_600_000;
    if (hoursBefore >= 0 && hoursBefore < MIN_REST_HOURS) {
      return {
        status: 'rest_violation',
        reason: `Nur ${hoursBefore.toFixed(1)}h Pause nach ${a.eventName ?? 'Einsatz'} (${fmt(aE)})`,
      };
    }
    if (hoursAfter >= 0 && hoursAfter < MIN_REST_HOURS) {
      return {
        status: 'rest_violation',
        reason: `Nur ${hoursAfter.toFixed(1)}h Pause bis nächster Einsatz (${fmt(aS)})`,
      };
    }
  }

  return { status: 'available' };
}

// ── Star rating ───────────────────────────────────────────────────────────────

function StarRating({ value, count }: { value: number; count: number }) {
  return (
    <Stack direction="row" alignItems="center" spacing={0.25}>
      {[1, 2, 3, 4, 5].map((i) => {
        const Icon = value >= i ? StarIcon : value >= i - 0.5 ? StarHalfIcon : StarOutlineIcon;
        return <Icon key={i} sx={{ fontSize: 13, color: 'warning.main' }} />;
      })}
      <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
        {value.toFixed(1)} <Box component="span" sx={{ opacity: 0.6 }}>({count})</Box>
      </Typography>
    </Stack>
  );
}

// ── Availability badge ────────────────────────────────────────────────────────

const AVAIL_CONFIG: Record<AvailStatus, { color: string; bg: string; label: string; Icon: React.ElementType }> = {
  available:      { color: 'success.main', bg: 'success.50', label: 'Verfügbar',     Icon: CheckCircleIcon },
  in_slot:        { color: 'primary.main', bg: 'primary.50', label: 'Zugewiesen',    Icon: CheckCircleIcon },
  conflict:       { color: 'error.main',   bg: 'error.50',   label: 'Besetzt',        Icon: BlockIcon },
  rest_violation: { color: 'warning.main', bg: 'warning.50', label: 'Ruhezeit',       Icon: AccessTimeIcon },
  unavailable:    { color: 'error.main',   bg: 'error.50',   label: 'Nicht verfügbar', Icon: EventBusyIcon },
};

function AvailBadge({ status }: { status: AvailStatus }) {
  const cfg = AVAIL_CONFIG[status];
  const Icon = cfg.Icon;
  return (
    <Stack direction="row" alignItems="center" spacing={0.4}>
      <Icon sx={{ fontSize: 11, color: cfg.color }} />
      <Typography variant="caption" sx={{ color: cfg.color, fontWeight: 600, fontSize: 10 }}>{cfg.label}</Typography>
    </Stack>
  );
}

// ── Staff detail modal ────────────────────────────────────────────────────────

function StaffDetailModal({ profile, open, onClose }: { profile: StaffProfile; open: boolean; onClose: () => void }) {
  const color = avatarColor(`${profile.firstName} ${profile.lastName}`);
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ pb: 0 }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Avatar sx={{ width: 52, height: 52, fontSize: 18, fontWeight: 700, bgcolor: color }}>
            {initials(profile)}
          </Avatar>
          <Box flex={1} minWidth={0}>
            <Typography variant="h6" fontWeight={700}>
              {profile.firstName} {profile.lastName}
            </Typography>
            <Chip
              label={profile.status === 'active' ? 'Aktiv' : 'Inaktiv'}
              size="small"
              color={profile.status === 'active' ? 'success' : 'default'}
              sx={{ mt: 0.25 }}
            />
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent dividers sx={{ pt: 2 }}>
        <Stack spacing={2.5}>
          {/* Contact */}
          <Box>
            <Typography variant="overline" color="text.secondary" sx={{ fontSize: 10, letterSpacing: 1 }}>
              Kontakt
            </Typography>
            <Stack spacing={1} mt={0.75}>
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
          </Box>

          <Divider />

          {/* Stats */}
          <Box>
            <Typography variant="overline" color="text.secondary" sx={{ fontSize: 10, letterSpacing: 1 }}>
              Statistik
            </Typography>
            <Stack direction="row" spacing={3} mt={1}>
              <Box textAlign="center">
                <Typography variant="h5" fontWeight={700} color="primary.main">
                  {profile.totalEventsWorked}
                </Typography>
                <Typography variant="caption" color="text.secondary">Einsätze</Typography>
              </Box>
              <Box textAlign="center">
                <Typography variant="h5" fontWeight={700} color="primary.main">
                  {profile.totalHoursWorked}
                </Typography>
                <Typography variant="caption" color="text.secondary">Stunden</Typography>
              </Box>
              <Box textAlign="center">
                <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.3}>
                  <Typography variant="h5" fontWeight={700} color="warning.main">
                    {profile.rating.average.toFixed(1)}
                  </Typography>
                  <StarIcon sx={{ fontSize: 18, color: 'warning.main', mt: 0.25 }} />
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  Bewertung ({profile.rating.count})
                </Typography>
              </Box>
            </Stack>
          </Box>

          <Divider />

          {/* Skills */}
          {profile.skills.length > 0 && (
            <Box>
              <Typography variant="overline" color="text.secondary" sx={{ fontSize: 10, letterSpacing: 1 }}>
                Fähigkeiten
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={0.75} mt={1}>
                {profile.skills.map((s) => (
                  <Chip key={s} label={s} size="small" color="primary" variant="outlined" />
                ))}
              </Stack>
            </Box>
          )}

          {/* Certifications */}
          {profile.certifications.length > 0 && (
            <>
              <Divider />
              <Box>
                <Typography variant="overline" color="text.secondary" sx={{ fontSize: 10, letterSpacing: 1 }}>
                  Zertifikate
                </Typography>
                <Stack spacing={1} mt={1}>
                  {profile.certifications.map((c) => (
                    <Stack key={c._id} direction="row" spacing={1.25} alignItems="flex-start">
                      <VerifiedIcon sx={{ fontSize: 16, color: 'success.main', mt: 0.2 }} />
                      <Box>
                        <Typography variant="body2" fontWeight={600}>{c.name}</Typography>
                        {c.issuer && (
                          <Typography variant="caption" color="text.secondary">{c.issuer}</Typography>
                        )}
                        {c.expiryDate && (
                          <Stack direction="row" alignItems="center" spacing={0.5} mt={0.25}>
                            <TimerIcon sx={{ fontSize: 12, color: new Date(c.expiryDate) < new Date() ? 'error.main' : 'text.disabled' }} />
                            <Typography variant="caption"
                              color={new Date(c.expiryDate) < new Date() ? 'error.main' : 'text.secondary'}>
                              Gültig bis {new Date(c.expiryDate).toLocaleDateString('de-DE')}
                            </Typography>
                          </Stack>
                        )}
                      </Box>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            </>
          )}

          {/* Notes */}
          {profile.notes && (
            <>
              <Divider />
              <Box>
                <Typography variant="overline" color="text.secondary" sx={{ fontSize: 10, letterSpacing: 1 }}>
                  Notizen
                </Typography>
                <Typography variant="body2" color="text.secondary" mt={0.75} sx={{ whiteSpace: 'pre-wrap' }}>
                  {profile.notes}
                </Typography>
              </Box>
            </>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 2.5, py: 1.5 }}>
        <Button onClick={onClose} variant="outlined" size="small">Schließen</Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Staff card ────────────────────────────────────────────────────────────────

interface StaffCardProps {
  profile: StaffProfile;
  availability?: SlotAvailability;
  isDragging?: boolean;
  isOverlay?: boolean;
  onView?: () => void;
  badge?: 'applied' | 'direct';
}

function StaffCard({ profile, availability, isDragging = false, isOverlay = false, onView, badge }: StaffCardProps) {
  const theme = useTheme();
  const avail = availability ?? { status: 'available' as AvailStatus };
  const isBlocked = avail.status === 'conflict' || avail.status === 'in_slot' || avail.status === 'unavailable';
  const isWarn    = avail.status === 'rest_violation';
  const cfg = AVAIL_CONFIG[avail.status];

  const borderColor = isBlocked ? theme.palette.error.main
    : isWarn ? theme.palette.warning.main
    : isDragging ? theme.palette.primary.main
    : theme.palette.divider;

  return (
    <Card
      elevation={isDragging || isOverlay ? 10 : 1}
      sx={{
        mb: 1,
        cursor: isBlocked ? 'not-allowed' : 'grab',
        opacity: isBlocked ? 0.5 : 1,
        border: `1.5px solid ${borderColor}`,
        borderRadius: 2,
        bgcolor: isBlocked ? 'action.disabledBackground' : isWarn ? 'warning.50' : 'background.paper',
        transition: 'all 0.15s',
        '&:hover': !isBlocked ? { borderColor: theme.palette.primary.main, boxShadow: theme.shadows[3] } : {},
        userSelect: 'none',
      }}
    >
      <CardContent sx={{ p: '10px !important' }}>
        <Stack direction="row" spacing={1.25} alignItems="flex-start">
          {/* Avatar */}
          <Avatar
            sx={{
              width: 36, height: 36, fontSize: 13, fontWeight: 700, flexShrink: 0,
              bgcolor: isBlocked ? 'text.disabled' : avatarColor(`${profile.firstName} ${profile.lastName}`),
            }}
          >
            {initials(profile)}
          </Avatar>

          {/* Main content */}
          <Box flex={1} minWidth={0}>
            {/* Name + icons row */}
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="body2" fontWeight={700} noWrap sx={{ fontSize: 13, flex: 1, minWidth: 0 }}>
                {profile.firstName} {profile.lastName}
              </Typography>
              <Stack direction="row" alignItems="center" spacing={0.25} flexShrink={0}>
                {!isOverlay && onView && (
                  <IconButton
                    size="small"
                    onClick={(e) => { e.stopPropagation(); onView(); }}
                    sx={{ p: 0.25 }}
                  >
                    <OpenInNewIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
                  </IconButton>
                )}
                {!isBlocked && <DragIndicatorIcon sx={{ fontSize: 14, color: 'text.disabled' }} />}
                {isBlocked && <BlockIcon sx={{ fontSize: 14, color: 'error.light' }} />}
              </Stack>
            </Stack>

            {/* Rating + badge */}
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <StarRating value={profile.rating.average} count={profile.rating.count} />
              {badge === 'applied' && (
                <Chip label="Beworben" size="small" color="success"
                  sx={{ fontSize: 9, height: 15, '& .MuiChip-label': { px: 0.6 } }} />
              )}
              {badge === 'direct' && (
                <Chip icon={<WorkHistoryIcon sx={{ fontSize: 10 }} />} label="Direkt" size="small" color="warning" variant="outlined"
                  sx={{ fontSize: 9, height: 15, '& .MuiChip-label': { px: 0.5 } }} />
              )}
            </Stack>

            {/* Stats */}
            <Stack direction="row" spacing={1.5} mt={0.5}>
              <Stack direction="row" alignItems="center" spacing={0.3}>
                <WorkHistoryIcon sx={{ fontSize: 11, color: 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary">{profile.totalEventsWorked} Einsätze</Typography>
              </Stack>
            </Stack>

            {/* Skills */}
            {profile.skills.length > 0 && (
              <Stack direction="row" flexWrap="wrap" gap={0.4} mt={0.75}>
                {profile.skills.slice(0, 4).map((s) => (
                  <Chip key={s} label={s} size="small"
                    sx={{ fontSize: 9, height: 16, '& .MuiChip-label': { px: 0.75 }, opacity: isBlocked ? 0.5 : 1 }}
                  />
                ))}
                {profile.skills.length > 4 && (
                  <Chip label={`+${profile.skills.length - 4}`} size="small"
                    sx={{ fontSize: 9, height: 16, '& .MuiChip-label': { px: 0.75 }, bgcolor: 'action.hover' }}
                  />
                )}
              </Stack>
            )}

            {/* Availability reason */}
            {avail.reason && (
              <Box mt={0.75} sx={{ bgcolor: cfg.bg, borderRadius: 1, px: 0.75, py: 0.3 }}>
                <Typography variant="caption" sx={{ color: cfg.color, fontSize: 10, display: 'block', lineHeight: 1.3 }}>
                  {avail.reason}
                </Typography>
              </Box>
            )}
            {!avail.reason && (
              <Box mt={0.5}><AvailBadge status={avail.status} /></Box>
            )}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

// ── Draggable wrapper ─────────────────────────────────────────────────────────

function DraggableStaffCard({ profile, availability, badge }: { profile: StaffProfile; availability?: SlotAvailability; badge?: 'applied' | 'direct' }) {
  const [modalOpen, setModalOpen] = useState(false);
  const isBlocked = availability?.status === 'conflict' || availability?.status === 'in_slot';
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: profile._id,
    data: { profile },
    disabled: isBlocked,
  });

  return (
    <>
      <div ref={setNodeRef} {...(!isBlocked ? listeners : {})} {...attributes}
        style={{ opacity: isDragging ? 0 : 1, touchAction: 'none' }}>
        <StaffCard profile={profile} availability={availability} onView={() => setModalOpen(true)} badge={badge} />
      </div>
      <StaffDetailModal profile={profile} open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}

// ── Slot drop zone ────────────────────────────────────────────────────────────

const ASSIGN_STATUS_CONFIG: Record<AssignmentStatus, { icon: React.ReactNode; bg: string; color: string; label: string }> = {
  invited:   { icon: <HourglassEmptyIcon sx={{ fontSize: 13 }} />, bg: '#fff3e0', color: 'warning.main',  label: 'Eingeladen' },
  confirmed: { icon: <CheckCircleIcon   sx={{ fontSize: 13 }} />, bg: '#e8f5e9', color: 'success.main',  label: 'Bestätigt' },
  declined:  { icon: <CancelIcon        sx={{ fontSize: 13 }} />, bg: '#ffebee', color: 'error.main',    label: 'Abgelehnt' },
  no_show:   { icon: <CancelIcon        sx={{ fontSize: 13 }} />, bg: '#ffebee', color: 'error.main',    label: 'No-Show' },
  worked:    { icon: <CheckCircleIcon   sx={{ fontSize: 13 }} />, bg: '#e3f2fd', color: 'primary.main',  label: 'Gearbeitet' },
  cancelled: { icon: <CancelIcon        sx={{ fontSize: 13 }} />, bg: '#f5f5f5', color: 'text.disabled', label: 'Abgesagt' },
};

function SlotDropZone({
  slot, position, slotAssignments, onCancel, isHovered,
}: {
  slot: EventTimeSlot; position: EventPosition;
  slotAssignments: Assignment[];
  onCancel: (id: string) => void;
  isHovered: boolean;
}) {
  const [cancelledOpen, setCancelledOpen] = useState(false);
  const posId = position._id;
  const { setNodeRef, isOver } = useDroppable({ id: `${posId}::${slot._id}` });

  const active     = slotAssignments.filter((a) => !['declined', 'cancelled'].includes(a.status));
  const cancelled  = slotAssignments.filter((a) => ['declined', 'cancelled'].includes(a.status));
  const activeCount = active.length;
  const isFull = activeCount >= position.headcount;
  const fillPct = Math.min(100, (activeCount / position.headcount) * 100);

  const borderColor = isOver && !isFull ? '#1976d2' : isFull ? '#2e7d32' : isHovered ? '#1976d240' : '#e0e0e0';
  const bgColor     = isOver && !isFull ? '#e3f2fd' : isFull ? '#e8f5e9' : 'background.paper';

  return (
    <Paper
      ref={setNodeRef}
      variant="outlined"
      sx={{
        borderColor, borderWidth: isOver ? 2 : 1, borderStyle: 'dashed',
        borderRadius: 2, p: 1.5, bgcolor: bgColor, minHeight: 110,
        transition: 'border-color 0.15s, background-color 0.15s',
        position: 'relative', overflow: 'hidden',
      }}
    >
      <LinearProgress
        variant="determinate" value={fillPct}
        color={isFull ? 'success' : activeCount > 0 ? 'warning' : 'inherit'}
        sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, borderRadius: 0 }}
      />

      {/* Slot time */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mt={0.5} mb={1}>
        <Box>
          <Typography variant="caption" fontWeight={700} sx={{ fontSize: 12 }}>
            {fmt(slot.startTime)} – {fmt(slot.endTime)}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: 11 }}>
            {new Date(slot.startTime).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}
            {slot.breakMinutes > 0 && ` · ${slot.breakMinutes}' Pause`}
          </Typography>
        </Box>
        <Chip
          label={`${activeCount}/${position.headcount}`} size="small"
          color={isFull ? 'success' : activeCount > 0 ? 'warning' : 'default'}
          sx={{ fontSize: 10, height: 18 }}
        />
      </Stack>

      {/* Active assignments */}
      <Stack spacing={0.5}>
        {active.length === 0 && (
          <Box sx={{ py: 1.5, textAlign: 'center' }}>
            <PersonIcon sx={{ fontSize: 20, color: 'text.disabled', display: 'block', mx: 'auto' }} />
            <Typography variant="caption" color="text.disabled">
              {isFull ? 'Vollständig besetzt' : 'Personal hier ablegen'}
            </Typography>
          </Box>
        )}
        {active.map((a) => {
          const cfg = ASSIGN_STATUS_CONFIG[a.status];
          return (
            <Stack key={a._id} direction="row" alignItems="center" spacing={0.75}
              sx={{ bgcolor: cfg.bg, borderRadius: 1.5, px: 1, py: 0.4 }}
            >
              <Box sx={{ color: cfg.color, display: 'flex' }}>{cfg.icon}</Box>
              <Typography variant="caption" fontWeight={600} flex={1} noWrap sx={{ fontSize: 11 }}>
                {a.staffName}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10, flexShrink: 0 }}>
                {cfg.label}
              </Typography>
              {['invited', 'confirmed', 'declined'].includes(a.status) && (
                <IconButton size="small" onClick={() => onCancel(a._id)} sx={{ p: 0.1 }}>
                  <CloseIcon sx={{ fontSize: 12 }} />
                </IconButton>
              )}
            </Stack>
          );
        })}
      </Stack>

      {/* Collapsed cancelled/declined */}
      {cancelled.length > 0 && (
        <Box mt={0.75}>
          <Stack
            direction="row" alignItems="center" spacing={0.5}
            onClick={() => setCancelledOpen((o) => !o)}
            sx={{ cursor: 'pointer', color: 'text.disabled', userSelect: 'none' }}
          >
            <CancelIcon sx={{ fontSize: 11 }} />
            <Typography variant="caption" sx={{ fontSize: 10 }}>
              {cancelled.length} Abgesagt/Abgelehnt
            </Typography>
            <Typography variant="caption" sx={{ fontSize: 10, ml: 'auto' }}>
              {cancelledOpen ? '▲' : '▼'}
            </Typography>
          </Stack>
          {cancelledOpen && (
            <Stack spacing={0.4} mt={0.5}>
              {cancelled.map((a) => {
                const cfg = ASSIGN_STATUS_CONFIG[a.status];
                return (
                  <Stack key={a._id} direction="row" alignItems="center" spacing={0.75}
                    sx={{ bgcolor: cfg.bg, borderRadius: 1.5, px: 1, py: 0.3, opacity: 0.7 }}
                  >
                    <Box sx={{ color: cfg.color, display: 'flex' }}>{cfg.icon}</Box>
                    <Typography variant="caption" flex={1} noWrap sx={{ fontSize: 10, textDecoration: 'line-through' }}>
                      {a.staffName}
                    </Typography>
                    <Typography variant="caption" sx={{ fontSize: 9, color: 'text.disabled', flexShrink: 0 }}>
                      {cfg.label}
                    </Typography>
                  </Stack>
                );
              })}
            </Stack>
          )}
        </Box>
      )}
    </Paper>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function WorkforceSheetPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [activeProfile, setActiveProfile] = useState<StaffProfile | null>(null);
  const [hoveredSlot, setHoveredSlot] = useState<{ positionId: string; slotId: string } | null>(null);
  const [error, setError] = useState('');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  // ── Data ────────────────────────────────────────────────────────────────────
  const { data: evData } = useQuery({ queryKey: ['event', id], queryFn: () => eventsApi.get(id!) });
  const event = evData?.data;

  const { data: asgData } = useQuery({
    queryKey: ['assignments', id],
    queryFn: () => assignmentsApi.listByEvent(id!),
  });
  const inEventAssignments: Assignment[] = asgData?.data ?? [];

  const { data: staffData, isLoading: staffLoading } = useQuery({
    queryKey: ['staff-profiles', 'active'],
    queryFn: () => staffProfilesApi.list({ limit: '300', status: 'active' }),
  });
  const allStaff: StaffProfile[] = staffData?.data?.profiles ?? [];

  // Applications for this event
  const { data: appData } = useQuery({
    queryKey: ['event-applications', id],
    queryFn: () => eventApplicationsApi.listByEvent(id!),
    enabled: !!id,
  });
  const applications: EventApplication[] = appData?.data ?? [];
  const appliedIds = new Set(applications.map((a) => a.staffProfileId));

  // Cross-event conflicts for the event's full time window
  const { data: conflictData } = useQuery({
    queryKey: ['period-conflicts', event?.startDate, event?.endDate],
    queryFn: () => assignmentsApi.periodConflicts(
      new Date(event!.startDate).toISOString(),
      new Date(event!.endDate).toISOString(),
    ),
    enabled: !!event,
  });
  const periodConflicts: Record<string, Assignment[]> = conflictData?.data ?? {};

  // Staff availability (date overrides + weekly pattern) for the event window
  const { data: availOverviewData } = useQuery({
    queryKey: ['availability-overview', event?.startDate, event?.endDate],
    queryFn: () => staffAvailabilityApi.getOverview(
      isoDate(new Date(event!.startDate)),
      isoDate(new Date(event!.endDate)),
    ),
    enabled: !!event,
  });
  const availByProfileId = new Map<string, StaffAvailability | null>(
    (availOverviewData?.data?.staff ?? []).map(e => [e.profileId, e.availability])
  );

  // ── Mutations ───────────────────────────────────────────────────────────────
  const { mutate: assign } = useMutation({
    mutationFn: ({ positionId, slotId, staffProfileId, forceInvite }: { positionId: string; slotId: string; staffProfileId: string; forceInvite?: boolean }) =>
      assignmentsApi.create({ eventId: id!, positionId, slotId, staffProfileId, forceInvite }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assignments', id] });
      qc.invalidateQueries({ queryKey: ['period-conflicts'] });
      qc.invalidateQueries({ queryKey: ['event-applications', id] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Zuweisung fehlgeschlagen.');
    },
  });

  const { mutate: cancelAssignment } = useMutation({
    mutationFn: (aId: string) => assignmentsApi.cancel(aId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assignments', id] }); qc.invalidateQueries({ queryKey: ['period-conflicts'] }); },
  });

  // ── DnD handlers ────────────────────────────────────────────────────────────
  const handleDragStart = (e: DragStartEvent) => {
    setActiveProfile(e.active.data.current?.profile ?? null);
    setError('');
  };

  const handleDragOver = (e: DragOverEvent) => {
    if (e.over) {
      const [positionId, slotId] = (e.over.id as string).split('::');
      setHoveredSlot({ positionId, slotId });
    } else {
      setHoveredSlot(null);
    }
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveProfile(null);
    setHoveredSlot(null);
    if (!e.over) return;
    const [positionId, slotId] = (e.over.id as string).split('::');
    const staffProfileId = e.active.id as string;
    const profile: StaffProfile | undefined = e.active.data.current?.profile;
    const slotObj = (() => {
      if (!event) return undefined;
      const pos = event.positions.find((p: EventPosition) => p._id === positionId);
      return pos?.slots.find((s: EventTimeSlot) => s._id === slotId);
    })();
    const avail = profile && slotObj ? getAvailability(profile, slotObj) : undefined;
    const forceInvite = avail?.status === 'unavailable';
    assign({ positionId, slotId, staffProfileId, forceInvite });
  };

  // ── Compute availability for current drag target ─────────────────────────────
  const getAvailability = useCallback((profile: StaffProfile, slot?: EventTimeSlot): SlotAvailability | undefined => {
    if (!slot) return undefined;
    return getSlotAvailability(profile, slot, inEventAssignments, periodConflicts, availByProfileId.get(profile._id));
  }, [inEventAssignments, periodConflicts, availByProfileId]);

  // Find the hovered slot object for availability computation
  const hoveredSlotObj: EventTimeSlot | undefined = (() => {
    if (!hoveredSlot || !event) return undefined;
    const pos = event.positions.find((p: EventPosition) => p._id === hoveredSlot.positionId);
    return pos?.slots.find((s: EventTimeSlot) => s._id === hoveredSlot.slotId);
  })();

  const getSlotAssignments = useCallback(
    (positionId: string, slotId: string) =>
      inEventAssignments.filter((a) => a.positionId === positionId && a.slotId === slotId),
    [inEventAssignments]
  );

  if (!event) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  const totalCapacity = event.positions.reduce((s: number, p: EventPosition) => s + p.slots.length * p.headcount, 0);
  const filledCount = inEventAssignments.filter((a) => !['declined', 'cancelled'].includes(a.status)).length;
  const fillPct = totalCapacity > 0 ? Math.round((filledCount / totalCapacity) * 100) : 0;

  const availSort = (list: StaffProfile[]) =>
    hoveredSlotObj
      ? [...list].sort((a, b) => {
          const order: Record<AvailStatus, number> = { available: 0, in_slot: 1, rest_violation: 2, conflict: 3, unavailable: 4 };
          const aA = getSlotAvailability(a, hoveredSlotObj, inEventAssignments, periodConflicts, availByProfileId.get(a._id));
          const bA = getSlotAvailability(b, hoveredSlotObj, inEventAssignments, periodConflicts, availByProfileId.get(b._id));
          return order[aA.status] - order[bA.status];
        })
      : list;

  const appliedStaff    = availSort(allStaff.filter((p) => appliedIds.has(p._id)));
  const notAppliedStaff = availSort(allStaff.filter((p) => !appliedIds.has(p._id)));

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2, py: 1.5, flexShrink: 0, bgcolor: 'background.paper' }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <IconButton size="small" onClick={() => navigate(`/coordinator/events/${id}`)}>
              <ArrowBackIcon />
            </IconButton>
            <Box flex={1} minWidth={0}>
              <Typography variant="h6" fontWeight={700} noWrap>Workforce Sheet</Typography>
              <Typography variant="caption" color="text.secondary" noWrap>{event.name}</Typography>
            </Box>
            <Stack direction="row" alignItems="center" spacing={2}>
              <Box sx={{ width: 160 }}>
                <Stack direction="row" justifyContent="space-between" mb={0.25}>
                  <Typography variant="caption" color="text.secondary">Besetzung</Typography>
                  <Typography variant="caption" fontWeight={700}>{filledCount}/{totalCapacity} ({fillPct}%)</Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={fillPct}
                  color={fillPct === 100 ? 'success' : fillPct > 50 ? 'warning' : 'error'}
                  sx={{ height: 6, borderRadius: 3 }}
                />
              </Box>
              <Chip
                label={`${event.positions.length} Positionen`}
                size="small"
                variant="outlined"
              />
            </Stack>
          </Stack>
        </Box>

        {error && (
          <Alert severity="error" onClose={() => setError('')} sx={{ mx: 2, mt: 1, flexShrink: 0 }}>
            {error}
          </Alert>
        )}

        {hoveredSlotObj && activeProfile && (
          <Alert severity="info" icon={<AccessTimeIcon fontSize="small" />} sx={{ mx: 2, mt: 1, py: 0.25, flexShrink: 0 }}>
            <Typography variant="caption">
              Slot: {fmt(hoveredSlotObj.startTime, 'datetime')} – {fmt(hoveredSlotObj.endTime)} · Personal-Liste nach Verfügbarkeit sortiert
            </Typography>
          </Alert>
        )}

        {/* ── Body ───────────────────────────────────────────────────────────── */}
        <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* Left panel — staff roster */}
          <Box
            sx={{
              width: 268, flexShrink: 0,
              borderRight: 1, borderColor: 'divider',
              overflow: 'auto',
              p: 1.5,
              bgcolor: (theme) => theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50',
            }}
          >
            {hoveredSlotObj && (
              <Box sx={{ mb: 1.25, p: 0.75, bgcolor: 'primary.50', borderRadius: 1, border: '1px solid', borderColor: 'primary.200' }}>
                <Typography variant="caption" color="primary.main" fontWeight={600} sx={{ fontSize: 10 }}>
                  Slot-Verfügbarkeit aktiv
                </Typography>
                <Stack direction="row" spacing={1.5} mt={0.5}>
                  {(['available', 'rest_violation', 'conflict'] as AvailStatus[]).map((s) => (
                    <AvailBadge key={s} status={s} />
                  ))}
                </Stack>
              </Box>
            )}

            {staffLoading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={24} /></Box>
            )}

            {/* ── Applied section ── */}
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.75}>
              <Stack direction="row" alignItems="center" spacing={0.75}>
                <CheckCircleIcon sx={{ fontSize: 12, color: 'success.main' }} />
                <Typography variant="caption" fontWeight={700} color="success.main"
                  sx={{ textTransform: 'uppercase', letterSpacing: 0.7, fontSize: 10 }}>
                  Beworben
                </Typography>
              </Stack>
              <Chip label={appliedStaff.length} size="small" color="success"
                sx={{ height: 16, fontSize: 10, bgcolor: 'success.100' }} />
            </Stack>

            {appliedStaff.length === 0 ? (
              <Box sx={{ mb: 1.5, py: 1, textAlign: 'center', borderRadius: 1,
                border: '1px dashed', borderColor: 'divider', bgcolor: 'action.hover' }}>
                <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10 }}>
                  Noch keine Bewerbungen
                </Typography>
              </Box>
            ) : (
              <Box mb={1.5}>
                {appliedStaff.map((p) => (
                  <DraggableStaffCard key={p._id} profile={p}
                    availability={hoveredSlotObj ? getAvailability(p, hoveredSlotObj) : undefined}
                    badge="applied"
                  />
                ))}
              </Box>
            )}

            <Divider sx={{ mb: 1.25 }} />

            {/* ── Not applied section ── */}
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.75}>
              <Stack direction="row" alignItems="center" spacing={0.75}>
                <PersonIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
                <Typography variant="caption" fontWeight={700} color="text.secondary"
                  sx={{ textTransform: 'uppercase', letterSpacing: 0.7, fontSize: 10 }}>
                  Nicht beworben
                </Typography>
              </Stack>
              <Chip label={notAppliedStaff.length} size="small"
                sx={{ height: 16, fontSize: 10 }} />
            </Stack>

            {notAppliedStaff.map((p) => (
              <DraggableStaffCard key={p._id} profile={p}
                availability={hoveredSlotObj ? getAvailability(p, hoveredSlotObj) : undefined}
                badge={p.directAssignable ? 'direct' : undefined}
              />
            ))}

            {!staffLoading && allStaff.length === 0 && (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <EventBusyIcon sx={{ fontSize: 32, color: 'text.disabled' }} />
                <Typography variant="body2" color="text.disabled" mt={1}>
                  Keine aktiven Profile
                </Typography>
              </Box>
            )}
          </Box>

          {/* Right panel — positions + slots */}
          <Box sx={{ flex: 1, overflow: 'auto', p: 2.5 }}>
            {event.positions.length === 0 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 1 }}>
                <EventBusyIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
                <Typography color="text.secondary">Noch keine Positionen vorhanden.</Typography>
                <Typography variant="caption" color="text.disabled">Im Event-Detail Positionen und Zeitslots hinzufügen.</Typography>
              </Box>
            )}

            <Stack spacing={4}>
              {event.positions.map((pos: EventPosition) => {
                const posFilledCount = inEventAssignments.filter(
                  (a) => a.positionId === pos._id && !['declined', 'cancelled'].includes(a.status)
                ).length;
                const posTotalCapacity = pos.slots.length * pos.headcount;
                const posFilledPct = posTotalCapacity > 0 ? Math.round((posFilledCount / posTotalCapacity) * 100) : 0;

                return (
                  <Box key={pos._id}>
                    {/* Position header card */}
                    <Paper variant="outlined" sx={{ p: 1.5, mb: 1.5, borderRadius: 2 }}>
                      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1}>
                        <Box>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="subtitle1" fontWeight={700}>{pos.title}</Typography>
                            {pos.roleType && <Chip label={pos.roleType} size="small" color="primary" variant="outlined" sx={{ fontSize: 11 }} />}
                          </Stack>
                          <Stack direction="row" spacing={1} mt={0.5} flexWrap="wrap">
                            <Chip label={`${pos.headcount} Person${pos.headcount > 1 ? 'en' : ''}/Slot`} size="small" sx={{ fontSize: 11 }} />
                            <Chip label={`€ ${pos.payRatePerHour}/h Lohn`} size="small" variant="outlined" sx={{ fontSize: 11 }} />
                            {pos.billingRatePerHour && <Chip label={`€ ${pos.billingRatePerHour}/h Abrechnung`} size="small" variant="outlined" sx={{ fontSize: 11 }} />}
                            {pos.dresscode && <Chip label={`👔 ${pos.dresscode}`} size="small" variant="outlined" sx={{ fontSize: 11 }} />}
                            {pos.skills?.map((s: string) => <Chip key={s} label={s} size="small" color="info" variant="outlined" sx={{ fontSize: 11 }} />)}
                          </Stack>
                        </Box>
                        <Box sx={{ minWidth: 140 }}>
                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="caption" color="text.secondary">Besetzt</Typography>
                            <Typography variant="caption" fontWeight={700}>{posFilledCount}/{posTotalCapacity}</Typography>
                          </Stack>
                          <LinearProgress
                            variant="determinate" value={posFilledPct}
                            color={posFilledPct === 100 ? 'success' : posFilledPct > 50 ? 'warning' : 'inherit'}
                            sx={{ height: 5, borderRadius: 3, mt: 0.5 }}
                          />
                        </Box>
                      </Stack>
                    </Paper>

                    {pos.slots.length === 0 ? (
                      <Box sx={{ p: 2, textAlign: 'center', borderRadius: 2, border: '1px dashed', borderColor: 'divider' }}>
                        <Typography variant="body2" color="text.secondary">
                          Noch keine Zeitslots — im Event-Detail hinzufügen.
                        </Typography>
                      </Box>
                    ) : (
                      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 1.5 }}>
                        {pos.slots.map((slot: EventTimeSlot) => {
                          const slotAssignments = getSlotAssignments(pos._id, slot._id);
                          const isHovered = hoveredSlot?.positionId === pos._id && hoveredSlot?.slotId === slot._id;
                          return (
                            <SlotDropZone
                              key={slot._id}
                              slot={slot}
                              position={pos}
                              slotAssignments={slotAssignments}
                              onCancel={cancelAssignment}
                              isHovered={isHovered}
                            />
                          );
                        })}
                      </Box>
                    )}
                    <Divider sx={{ mt: 3 }} />
                  </Box>
                );
              })}
            </Stack>
          </Box>
        </Box>
      </Box>

      {/* Drag overlay */}
      <DragOverlay dropAnimation={null}>
        {activeProfile && (
          <Box sx={{ width: 252, transform: 'rotate(2deg)', pointerEvents: 'none' }}>
            <StaffCard
              profile={activeProfile}
              availability={hoveredSlotObj ? getAvailability(activeProfile, hoveredSlotObj) : undefined}
              isOverlay
            />
          </Box>
        )}
      </DragOverlay>
    </DndContext>
  );
}
