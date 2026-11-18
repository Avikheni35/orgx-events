import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Stack, IconButton, Dialog, DialogContent, DialogActions,
  Button, Switch, TextField, ToggleButtonGroup, ToggleButton,
  CircularProgress, Alert,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import TodayIcon from '@mui/icons-material/Today';
import RepeatIcon from '@mui/icons-material/Repeat';
import EditCalendarIcon from '@mui/icons-material/EditCalendar';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { staffAvailabilityApi, type WeeklySlot, type DateOverride } from '../../api/staffAvailability';
import { assignmentsApi, type Assignment } from '../../api/assignments';

// ── Palette tokens ────────────────────────────────────────────────────────────

const C = {
  avail:       '#1B5E3B',
  availLight:  '#E9F5EE',
  availBorder: '#A8D5B8',
  amber:       '#C17B3A',
  amberLight:  '#FEF3E7',
  textPrimary: '#1A1917',
  textSecond:  '#6B6761',
  border:      '#E0E0E0',
  muted:       '#BDBDBD',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAY_NAMES    = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const DAY_NAMES_LONG = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
const MONTH_NAMES  = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];

function getMondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function fmtDayMonth(date: Date): string {
  return `${String(date.getDate()).padStart(2,'0')}. ${MONTH_NAMES[date.getMonth()]}`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface EditState {
  date: Date;
  dayOfWeek: number;
  existingOverrideId?: string;
  available: boolean;
  startTime: string;
  endTime: string;
  note: string;
  scope: 'date' | 'weekly';
}

interface DayData {
  date: Date;
  available: boolean;
  startTime?: string;
  endTime?: string;
  note?: string;
  isOverride: boolean;
  overrideId?: string;
  // weekly pattern data preserved when an override exists, so both can be shown
  weeklyAvailable?: boolean;
  weeklyStartTime?: string;
  weeklyEndTime?: string;
}

// ── Edit Dialog ───────────────────────────────────────────────────────────────

function EditDialog({ state, onClose, onSave }: { state: EditState; onClose: () => void; onSave: (s: EditState) => void }) {
  const [s, setS] = useState<EditState>(state);
  const U = (patch: Partial<EditState>) => setS(prev => ({ ...prev, ...patch }));

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth
      PaperProps={{ sx: { borderRadius: '20px', overflow: 'hidden', bgcolor: 'background.paper' } }}>

      {/* Header */}
      <Box sx={{ bgcolor: s.available ? C.availLight : 'background.default', px: 3, pt: 3, pb: 2, borderBottom: `1px solid ${C.border}` }}>
        <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.textSecond, mb: 0.5 }}>
          {s.scope === 'weekly' ? `Jeden ${DAY_NAMES_LONG[s.dayOfWeek]}` : 'Einzelner Tag'}
        </Typography>
        <Typography sx={{ fontSize: 22, fontWeight: 800, color: C.textPrimary, lineHeight: 1.1 }}>
          {DAY_NAMES_LONG[s.dayOfWeek]}
        </Typography>
        <Typography sx={{ fontSize: 14, color: C.textSecond, mt: 0.25 }}>
          {fmtDayMonth(s.date)} {s.date.getFullYear()}
        </Typography>
      </Box>

      <DialogContent sx={{ px: 3, pt: 2.5, pb: 1 }}>
        <Stack spacing={3}>

          {/* Available toggle */}
          <Box sx={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            bgcolor: s.available ? C.availLight : 'background.default',
            border: `1.5px solid ${s.available ? C.availBorder : C.border}`,
            borderRadius: '14px', px: 2, py: 1.5,
          }}>
            <Box>
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: s.available ? C.avail : C.textSecond }}>
                {s.available ? 'Verfügbar' : 'Nicht verfügbar'}
              </Typography>
              <Typography sx={{ fontSize: 12, color: C.textSecond }}>
                {s.available ? 'Du stehst für Einsätze bereit' : 'Kein Einsatz möglich'}
              </Typography>
            </Box>
            <Switch
              checked={s.available}
              onChange={e => U({ available: e.target.checked })}
              sx={{
                '& .MuiSwitch-thumb': { bgcolor: s.available ? C.avail : C.muted },
                '& .MuiSwitch-track': { bgcolor: s.available ? C.availBorder : C.border },
              }}
            />
          </Box>

          {/* Time range */}
          {s.available && (
            <Box>
              <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.25}>
                <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: C.textSecond }}>
                  Zeitfenster
                </Typography>
                <Stack direction="row" alignItems="center" spacing={0.75}>
                  <Typography sx={{ fontSize: 12, color: (!s.startTime || !s.endTime) ? C.avail : C.textSecond, fontWeight: 600 }}>
                    Ganztag
                  </Typography>
                  <Switch
                    size="small"
                    checked={!s.startTime || !s.endTime}
                    onChange={e => {
                      if (e.target.checked) {
                        U({ startTime: '', endTime: '' });
                      } else {
                        U({ startTime: '07:00', endTime: '22:00' });
                      }
                    }}
                    sx={{
                      '& .MuiSwitch-thumb': { bgcolor: (!s.startTime || !s.endTime) ? C.avail : C.muted },
                      '& .MuiSwitch-track': { bgcolor: (!s.startTime || !s.endTime) ? C.availBorder : C.border },
                    }}
                  />
                </Stack>
              </Stack>
              {s.startTime && s.endTime && (
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <TextField
                    label="Von" type="time" size="small" value={s.startTime}
                    onChange={e => U({ startTime: e.target.value })}
                    InputLabelProps={{ shrink: true }} inputProps={{ step: 900 }}
                    sx={{ flex: 1, '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                  />
                  <Typography sx={{ color: C.muted, fontSize: 18, fontWeight: 300 }}>–</Typography>
                  <TextField
                    label="Bis" type="time" size="small" value={s.endTime}
                    onChange={e => U({ endTime: e.target.value })}
                    InputLabelProps={{ shrink: true }} inputProps={{ step: 900 }}
                    sx={{ flex: 1, '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                  />
                </Stack>
              )}
              {(!s.startTime || !s.endTime) && (
                <Typography sx={{ fontSize: 12, color: C.avail, fontWeight: 600, textAlign: 'center', py: 0.5 }}>
                  Den ganzen Tag verfügbar — keine Zeiteinschränkung
                </Typography>
              )}
            </Box>
          )}

          {/* Scope */}
          <Box>
            <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: C.textSecond, mb: 1.25 }}>
              Gilt für
            </Typography>
            <ToggleButtonGroup value={s.scope} exclusive fullWidth onChange={(_, v) => v && U({ scope: v })}
              sx={{ '& .MuiToggleButton-root': { borderRadius: '12px !important', border: `1.5px solid ${C.border} !important`, fontSize: 13, textTransform: 'none', fontWeight: 600, py: 1.25 } }}>
              <ToggleButton value="date" sx={{ gap: 0.75 }}>
                <EditCalendarIcon sx={{ fontSize: 16 }} /> Nur heute
              </ToggleButton>
              <ToggleButton value="weekly" sx={{ gap: 0.75 }}>
                <RepeatIcon sx={{ fontSize: 16 }} /> Jeden {DAY_NAMES[s.dayOfWeek]}
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* Note */}
          {s.scope === 'date' && (
            <TextField
              label="Notiz" size="small" value={s.note}
              onChange={e => U({ note: e.target.value })}
              placeholder="z.B. Arzttermin"
              multiline rows={2}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
            />
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 1 }}>
        <Button onClick={onClose} fullWidth variant="outlined"
          sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 600, borderColor: C.border, color: C.textSecond, '&:hover': { borderColor: C.muted } }}>
          Abbrechen
        </Button>
        <Button onClick={() => onSave(s)} fullWidth variant="contained"
          sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 700, bgcolor: C.avail, '&:hover': { bgcolor: '#164d30' }, boxShadow: 'none' }}>
          Speichern
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Day Tile (mini grid) ──────────────────────────────────────────────────────

function DayTile({ day, isToday, confirmedShifts, onClick }: { day: DayData; isToday: boolean; confirmedShifts: Assignment[]; onClick: () => void }) {
  const avail = day.available;
  const hasTime = !!(day.startTime && day.endTime);
  // Shifts not already shown via the override note
  const extraShifts = confirmedShifts.filter(a => !(day.isOverride && day.note === a.eventName));

  return (
    <Box onClick={onClick} sx={{
      cursor: 'pointer', borderRadius: '14px', overflow: 'hidden',
      bgcolor: avail ? C.availLight : 'background.default',
      border: `1.5px solid ${isToday ? C.amber : avail ? C.availBorder : C.border}`,
      boxShadow: isToday ? `0 0 0 3px ${C.amberLight}` : 'none',
      transition: 'transform 0.12s, box-shadow 0.12s',
      '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.10)' },
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      pt: 1.25, pb: 1, px: 0.5, minHeight: 88,
      position: 'relative',
    }}>
      {/* Exception badge (top-right) */}
      {day.isOverride && (
        <Box sx={{
          position: 'absolute', top: 5, right: 5,
          width: 6, height: 6, borderRadius: '50%',
          bgcolor: day.note ? C.amber : C.avail,
        }} />
      )}
      {/* Confirmed event dot (top-left) — only when not already covered by override */}
      {extraShifts.length > 0 && (
        <Box sx={{
          position: 'absolute', top: 5, left: 5,
          width: 6, height: 6, borderRadius: '50%',
          bgcolor: C.avail,
        }} />
      )}

      {/* Day name */}
      <Typography sx={{
        fontSize: 9, fontWeight: 700, letterSpacing: '0.09em',
        textTransform: 'uppercase', color: isToday ? C.amber : avail ? C.avail : C.muted,
        lineHeight: 1, mb: 0.5,
      }}>
        {DAY_NAMES[day.date.getDay()]}
      </Typography>

      {/* Date number */}
      <Box sx={{
        width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        bgcolor: isToday ? C.amber : 'transparent',
        mb: 0.75,
      }}>
        <Typography sx={{
          fontSize: 17, fontWeight: 800, lineHeight: 1,
          color: isToday ? '#fff' : avail ? C.avail : C.muted,
        }}>
          {day.date.getDate()}
        </Typography>
      </Box>

      {/* Status indicator */}
      {avail ? (
        <Box sx={{ width: '70%', height: 3, borderRadius: 2, bgcolor: hasTime ? C.avail : C.availBorder }} />
      ) : (
        <Box sx={{ width: 16, height: 3, borderRadius: 2, bgcolor: C.border }} />
      )}

      {/* Time hint */}
      {avail && (
        <Typography sx={{ fontSize: 8, color: C.avail, fontWeight: 600, mt: 0.5, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>
          {hasTime ? `${day.startTime!.replace(':','·')}–${day.endTime!.replace(':','·')}` : 'Ganztag'}
        </Typography>
      )}
    </Box>
  );
}

// ── Week Detail Row ───────────────────────────────────────────────────────────

function WeekRow({ day, isToday, confirmedShifts, onClick }: {
  day: DayData; isToday: boolean; confirmedShifts: Assignment[]; onClick: () => void;
}) {
  const avail = day.available;
  const toHHMM = (iso: string) => new Date(iso).toLocaleTimeString('de-DE', { timeStyle: 'short' });

  return (
    <Box onClick={onClick} sx={{
      display: 'flex', alignItems: 'flex-start', gap: 2,
      px: 2, py: 1.5, cursor: 'pointer', borderRadius: '12px',
      bgcolor: isToday ? C.amberLight : 'transparent',
      border: `1px solid ${isToday ? C.amber + '40' : 'transparent'}`,
      transition: 'background 0.12s',
      '&:hover': { bgcolor: isToday ? C.amberLight : 'background.default' },
    }}>
      {/* Availability dot */}
      <Box sx={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, mt: '4px', bgcolor: confirmedShifts.length > 0 ? C.avail : avail ? C.avail : C.muted }} />

      {/* Day label */}
      <Typography sx={{ fontSize: 13, fontWeight: 700, color: isToday ? C.amber : C.textPrimary, width: 24, flexShrink: 0, mt: '1px' }}>
        {DAY_NAMES[day.date.getDay()]}
      </Typography>
      <Typography sx={{ fontSize: 13, color: C.textSecond, width: 52, flexShrink: 0, fontVariantNumeric: 'tabular-nums', mt: '1px' }}>
        {fmtDayMonth(day.date)}
      </Typography>

      {/* Status / time + confirmed shifts */}
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        {/* Availability line */}
        {day.isOverride ? (
          <>
            <Stack direction="row" spacing={0.75} alignItems="center">
              {day.available ? (
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: C.avail, fontVariantNumeric: 'tabular-nums' }}>
                  {day.startTime && day.endTime ? `${day.startTime} – ${day.endTime}` : 'Ganztägig'}
                </Typography>
              ) : (
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: C.muted }}>Nicht verfügbar</Typography>
              )}
              {day.note && (
                <Typography sx={{ fontSize: 11, color: C.amber, fontWeight: 600, bgcolor: C.amberLight, px: 0.75, py: 0.1, borderRadius: '6px', flexShrink: 0 }} noWrap>
                  {day.note}
                </Typography>
              )}
            </Stack>
            <Typography sx={{ fontSize: 11, color: C.textSecond, mt: 0.2, fontVariantNumeric: 'tabular-nums' }}>
              Regulär: {day.weeklyAvailable
                ? (day.weeklyStartTime && day.weeklyEndTime ? `${day.weeklyStartTime} – ${day.weeklyEndTime}` : 'Ganztägig')
                : 'Nicht verfügbar'}
            </Typography>
          </>
        ) : avail ? (
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: C.avail, fontVariantNumeric: 'tabular-nums' }}>
            {day.startTime && day.endTime ? `${day.startTime} – ${day.endTime}` : 'Ganztägig verfügbar'}
          </Typography>
        ) : (
          <Typography sx={{ fontSize: 12, color: C.muted }}>Nicht verfügbar</Typography>
        )}

        {/* Confirmed shifts for this day — skip any already shown as the override note */}
        {confirmedShifts.filter(a => !(day.isOverride && day.note === a.eventName)).map(a => (
          <Stack key={a._id} direction="row" spacing={0.75} alignItems="center" mt={0.5}>
            <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: C.avail, flexShrink: 0 }} />
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: C.avail }} noWrap>
              {a.eventName}
            </Typography>
            <Typography sx={{ fontSize: 11, color: C.textSecond, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
              {toHHMM(a.slotStart)}–{toHHMM(a.slotEnd)}
            </Typography>
          </Stack>
        ))}
      </Box>

      {/* Edit arrow */}
      <Typography sx={{ fontSize: 16, color: C.muted, flexShrink: 0, mt: '1px' }}>›</Typography>
    </Box>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AvailabilityPage() {
  const qc = useQueryClient();
  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOf(new Date()));
  const [editing, setEditing] = useState<EditState | null>(null);
  const [saveError, setSaveError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['my-availability'],
    queryFn: () => staffAvailabilityApi.getMine(),
  });
  const avail = data?.data;

  const { data: asgData } = useQuery({
    queryKey: ['my-assignments'],
    queryFn: () => assignmentsApi.mine(),
  });
  // Map isoDate → confirmed assignments for that day
  const confirmedByDate = ((asgData?.data ?? []) as Assignment[])
    .filter(a => a.status === 'confirmed')
    .reduce<Record<string, Assignment[]>>((acc, a) => {
      const d = new Date(a.slotStart);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      (acc[key] ??= []).push(a);
      return acc;
    }, {});

  const { mutate: updateWeekly } = useMutation({
    mutationFn: (weeklyPattern: WeeklySlot[]) => staffAvailabilityApi.updateWeekly(weeklyPattern),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-availability'] }); setSaveError(''); },
    onError: () => setSaveError('Speichern fehlgeschlagen.'),
  });

  const { mutate: upsertOverride } = useMutation({
    mutationFn: (o: Omit<DateOverride, '_id'>) => staffAvailabilityApi.upsertOverride(o),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-availability'] }); setSaveError(''); },
    onError: () => setSaveError('Speichern fehlgeschlagen.'),
  });

  const { mutate: deleteOverride } = useMutation({
    mutationFn: (id: string) => staffAvailabilityApi.deleteOverride(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-availability'] }),
  });

  const weekDays: DayData[] = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const iso = isoDate(date);
    const dow = date.getDay();
    const override = avail?.dateOverrides.find((o) => isoDate(new Date(o.date)) === iso);
    const slot = avail?.weeklyPattern.find((s) => s.dayOfWeek === dow);
    if (override) {
      return {
        date, available: override.available, startTime: override.startTime, endTime: override.endTime,
        note: override.note, isOverride: true, overrideId: override._id,
        weeklyAvailable: slot?.available ?? (dow >= 1 && dow <= 5),
        weeklyStartTime: slot?.startTime, weeklyEndTime: slot?.endTime,
      };
    }
    return { date, available: slot?.available ?? (dow >= 1 && dow <= 5), startTime: slot?.startTime, endTime: slot?.endTime, isOverride: false };
  });

  const openEdit = useCallback((day: DayData) => {
    setEditing({
      date: day.date,
      dayOfWeek: day.date.getDay(),
      existingOverrideId: day.overrideId,
      available: day.available,
      startTime: day.startTime ?? '09:00',
      endTime: day.endTime ?? '17:00',
      note: day.note ?? '',
      scope: day.isOverride ? 'date' : 'weekly',
    });
  }, []);

  const handleSave = useCallback((s: EditState) => {
    setEditing(null);
    if (s.scope === 'weekly') {
      const newPattern: WeeklySlot[] = (avail?.weeklyPattern ?? []).map(slot =>
        slot.dayOfWeek === s.dayOfWeek
          ? { dayOfWeek: s.dayOfWeek, available: s.available, startTime: s.available ? s.startTime : undefined, endTime: s.available ? s.endTime : undefined }
          : slot
      );
      for (let d = 0; d < 7; d++) {
        if (!newPattern.find(p => p.dayOfWeek === d)) newPattern.push({ dayOfWeek: d, available: d >= 1 && d <= 5 });
      }
      newPattern.sort((a, b) => a.dayOfWeek - b.dayOfWeek);
      updateWeekly(newPattern);
    } else {
      upsertOverride({
        date: isoDate(s.date),
        available: s.available,
        startTime: s.available ? s.startTime : undefined,
        endTime: s.available ? s.endTime : undefined,
        note: s.note || undefined,
      });
    }
  }, [avail, updateWeekly, upsertOverride]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const availableDays = weekDays.filter(d => d.available).length;
  const weekEndDate = addDays(weekStart, 6);
  const weekLabel = weekStart.getMonth() === weekEndDate.getMonth()
    ? `${weekStart.getDate()}. – ${weekEndDate.getDate()}. ${MONTH_NAMES[weekStart.getMonth()]} ${weekStart.getFullYear()}`
    : `${String(weekStart.getDate()).padStart(2,'0')}.${MONTH_NAMES[weekStart.getMonth()]} – ${String(weekEndDate.getDate()).padStart(2,'0')}.${MONTH_NAMES[weekEndDate.getMonth()]}`;

  const upcomingOverrides = (avail?.dateOverrides ?? [])
    .filter(o => new Date(o.date) >= today)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100%' }}>

      {/* Page header */}
      <Box sx={{ px: 2.5, pt: 2.5, pb: 1.5 }}>
        <Typography sx={{ fontSize: 22, fontWeight: 800, color: C.textPrimary, lineHeight: 1.1 }}>
          Verfügbarkeit
        </Typography>
        <Typography sx={{ fontSize: 13, color: C.textSecond, mt: 0.5 }}>
          Teile dem Team mit, wann du da bist.
        </Typography>
      </Box>

      {saveError && (
        <Box sx={{ px: 2.5, mb: 1 }}>
          <Alert severity="error" onClose={() => setSaveError('')} sx={{ borderRadius: '12px' }}>{saveError}</Alert>
        </Box>
      )}

      {/* Week navigation */}
      <Box sx={{ px: 2, pb: 1.5 }}>
        <Box sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          bgcolor: 'background.paper', borderRadius: '16px', px: 1.5, py: 1,
          boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
        }}>
          <IconButton size="small" onClick={() => setWeekStart(w => addDays(w, -7))} sx={{ color: C.textSecond }}>
            <ChevronLeftIcon />
          </IconButton>

          <Box sx={{ textAlign: 'center' }}>
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>{weekLabel}</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mt: 0.25 }}>
              {Array.from({ length: 7 }, (_, i) => (
                <Box key={i} sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: weekDays[i]?.available ? C.avail : C.border }} />
              ))}
              <Typography sx={{ fontSize: 10, color: C.textSecond, ml: 0.75 }}>
                {availableDays}/7
              </Typography>
            </Box>
          </Box>

          <Stack direction="row" spacing={0.25}>
            <IconButton size="small" onClick={() => setWeekStart(getMondayOf(new Date()))} sx={{ color: C.textSecond }}>
              <TodayIcon sx={{ fontSize: 18 }} />
            </IconButton>
            <IconButton size="small" onClick={() => setWeekStart(w => addDays(w, 7))} sx={{ color: C.textSecond }}>
              <ChevronRightIcon />
            </IconButton>
          </Stack>
        </Box>
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress size={28} sx={{ color: C.avail }} /></Box>
      ) : (
        <>
          {/* 7-day mini grid */}
          <Box sx={{ px: 2, pb: 2 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.75 }}>
              {weekDays.map(day => (
                <DayTile
                  key={isoDate(day.date)}
                  day={day}
                  isToday={isoDate(day.date) === isoDate(today)}
                  confirmedShifts={confirmedByDate[isoDate(day.date)] ?? []}
                  onClick={() => openEdit(day)}
                />
              ))}
            </Box>
          </Box>

          {/* Week detail list */}
          <Box sx={{ mx: 2, mb: 2, bgcolor: 'background.paper', borderRadius: '18px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
            <Box sx={{ px: 2, pt: 1.75, pb: 1, borderBottom: `1px solid ${C.border}` }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.textSecond }}>
                Diese Woche
              </Typography>
            </Box>
            <Box sx={{ py: 0.75 }}>
              {weekDays.map(day => (
                <WeekRow
                  key={isoDate(day.date)}
                  day={day}
                  isToday={isoDate(day.date) === isoDate(today)}
                  confirmedShifts={confirmedByDate[isoDate(day.date)] ?? []}
                  onClick={() => openEdit(day)}
                />
              ))}
            </Box>
          </Box>

          {/* Upcoming exceptions */}
          {upcomingOverrides.length > 0 && (
            <Box sx={{ mx: 2, mb: 3, bgcolor: 'background.paper', borderRadius: '18px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
              <Box sx={{ px: 2, pt: 1.75, pb: 1, borderBottom: `1px solid ${C.border}` }}>
                <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.textSecond }}>
                  Ausnahmen
                </Typography>
              </Box>
              <Box>
                {upcomingOverrides.map((o, idx) => {
                  const d = new Date(o.date);
                  return (
                    <Box key={o._id} sx={{
                      display: 'flex', alignItems: 'center', gap: 1.5,
                      px: 2, py: 1.5,
                      borderBottom: idx < upcomingOverrides.length - 1 ? `1px solid ${C.border}` : 'none',
                    }}>
                      {/* Date block */}
                      <Box sx={{
                        width: 40, height: 40, borderRadius: '12px', flexShrink: 0,
                        bgcolor: o.available ? C.availLight : 'background.default',
                        border: `1.5px solid ${o.available ? C.availBorder : C.border}`,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Typography sx={{ fontSize: 8, fontWeight: 700, color: C.textSecond, lineHeight: 1, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                          {MONTH_NAMES[d.getMonth()]}
                        </Typography>
                        <Typography sx={{ fontSize: 16, fontWeight: 800, color: o.available ? C.avail : C.muted, lineHeight: 1.1 }}>
                          {d.getDate()}
                        </Typography>
                      </Box>

                      {/* Info */}
                      <Box sx={{ flex: 1, overflow: 'hidden' }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 700, color: C.textPrimary }}>
                          {DAY_NAMES_LONG[d.getDay()]}
                          {o.available
                            ? (o.startTime && o.endTime ? ` · ${o.startTime}–${o.endTime}` : ' · Ganztägig')
                            : ' · Nicht verfügbar'}
                        </Typography>
                        {o.note && (
                          <Typography sx={{ fontSize: 12, color: C.amber, fontWeight: 600, mt: 0.1 }} noWrap>
                            {o.note}
                          </Typography>
                        )}
                      </Box>

                      {/* Delete */}
                      <IconButton size="small" onClick={() => o._id && deleteOverride(o._id)}
                        sx={{ color: C.muted, '&:hover': { color: '#C62828', bgcolor: '#FFEBEE' }, borderRadius: '8px' }}>
                        <DeleteOutlineIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          )}
        </>
      )}

      {editing && (
        <EditDialog state={editing} onClose={() => setEditing(null)} onSave={handleSave} />
      )}
    </Box>
  );
}
