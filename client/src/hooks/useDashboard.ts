import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { DashboardMetrics } from '../types';

export function useDashboardOverview() {
  return useQuery({
    queryKey: ['dashboard', 'overview'],
    queryFn: () => api.getDashboardOverview(),
    refetchInterval: 30000
  });
}

export function useRecoveryCases(params?: { page?: number; limit?: number; status?: string }) {
  return useQuery({
    queryKey: ['recovery-cases', params],
    queryFn: () => api.getRecoveryCases(params),
    refetchInterval: 15000
  });
}

export function useRecoveryCase(id: string, enabled = true) {
  return useQuery({
    queryKey: ['recovery-case', id],
    queryFn: () => api.getRecoveryCase(id),
    enabled: enabled && !!id,
    refetchInterval: 10000
  });
}

export function useMetrics() {
  return useQuery({
    queryKey: ['recovery', 'metrics'],
    queryFn: () => api.getMetrics(),
    refetchInterval: 60000
  });
}

export function useAuditTrail(caseId: string, enabled = true) {
  return useQuery({
    queryKey: ['audit', caseId],
    queryFn: () => api.getAuditTrail(caseId),
    enabled: enabled && !!caseId
  });
}

export function useIncidents() {
  return useQuery({
    queryKey: ['incidents'],
    queryFn: () => api.getIncidents(),
    refetchInterval: 60000
  });
}