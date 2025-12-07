import { dataLayer } from '../data';
import { IncidentReport } from '../types';

interface PendingAction {
  ticket: IncidentReport;
  urgency: 'overdue' | 'due_soon' | 'action_required' | 'pending_closure';
  dueIn?: string;
  message: string;
}

export const getPendingActions = async (username: string): Promise<PendingAction[]> => {
  const tickets = await dataLayer.getPendingActions();

  return tickets.map((ticket) => {
    const now = new Date().getTime();
    const lastUpdate = new Date(
      ticket.escl_status_last_updated_date_time || ticket.open_time || 0
    ).getTime();
    const hoursSinceUpdate = Math.floor((now - lastUpdate) / (60 * 60 * 1000));

    let urgency: PendingAction['urgency'];
    let dueIn: string | undefined;
    let message: string;

    if ((ticket.status === 'Open' || !ticket.status) && hoursSinceUpdate > 24) {
      urgency = 'overdue';
      message = `${ticket.event_name || 'Incident'} - immediate attention required`;
    } else if (ticket.status === 'Assigned') {
      urgency = 'due_soon';
      dueIn = `Due in ${Math.max(0, 4 - (hoursSinceUpdate % 4))} hours`;
      message = `${ticket.event_name || 'Incident'} - requires progress update`;
    } else if (ticket.status === 'In Progress') {
      urgency = 'action_required';
      dueIn = `Due in ${Math.max(0, 6 - (hoursSinceUpdate % 6))} hours`;
      message = `${ticket.event_name || 'Incident'} - action needed`;
    } else if (ticket.status === 'Resolved') {
      urgency = 'pending_closure';
      message = `${ticket.event_name || 'Incident'} - verify and close`;
    } else {
      urgency = 'action_required';
      message = ticket.event_name || 'Incident requires attention';
    }

    return {
      ticket,
      urgency,
      dueIn,
      message,
    };
  });
};

export const getNotificationCount = async (username: string): Promise<number> => {
  const tickets = await dataLayer.getPendingActions();
  return tickets.length;
};
