/** Calculate net worked hours after subtracting a break. */
export function calcHours(
  startTime: Date,
  endTime: Date,
  breakTaken: boolean,
  breakMinutes: number
): number {
  const mins = (endTime.getTime() - startTime.getTime()) / 60_000;
  const net = breakTaken ? Math.max(0, mins - breakMinutes) : mins;
  return Math.round(net / 60 * 100) / 100;
}
