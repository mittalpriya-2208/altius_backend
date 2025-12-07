import { dataLayer } from '../data';
import { DashboardStats, IncidentReport } from '../types';

export const getDashboardStats = async (): Promise<DashboardStats> => {
  return dataLayer.getDashboardStats();
};

export const getNeedsAcknowledgement = async (limit = 10): Promise<IncidentReport[]> => {
  return dataLayer.getNeedsAcknowledgement(limit);
};

export const getRecentUpdates = async (
  page = 1,
  limit = 20
): Promise<{ data: IncidentReport[]; total: number }> => {
  return dataLayer.getRecentUpdates(page, limit);
};
