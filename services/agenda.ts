import * as Calendar from 'expo-calendar/legacy';

export interface AgendaEvent {
  id: string;
  title: string;
  startDate: string;
  allDay: boolean;
}

export async function calendarIsConnected() {
  const permission = await Calendar.getCalendarPermissionsAsync();
  return permission.granted;
}

export async function connectCalendar() {
  const permission = await Calendar.requestCalendarPermissionsAsync();
  return permission.granted;
}

export async function readTodayAgenda(): Promise<AgendaEvent[]> {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const readable = calendars.filter((calendar) => calendar.isVisible !== false);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  if (!readable.length) return [];
  const events = await Calendar.getEventsAsync(readable.map((calendar) => calendar.id), start, end);
  return events
    .filter((event) => event.status !== 'canceled')
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .slice(0, 3)
    .map((event) => ({
      id: event.id,
      title: event.title || 'Untitled event',
      startDate: new Date(event.startDate).toISOString(),
      allDay: !!event.allDay,
    }));
}
