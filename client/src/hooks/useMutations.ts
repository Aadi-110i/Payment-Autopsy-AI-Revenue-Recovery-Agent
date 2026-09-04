import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

export function useAnalyzeCase() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (caseId: string) => api.analyzeCase(caseId),
    onSuccess: (_, caseId) => {
      queryClient.invalidateQueries({ queryKey: ['recovery-case', caseId] });
      queryClient.invalidateQueries({ queryKey: ['recovery-cases'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'overview'] });
    }
  });
}

export function useApproveCase() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ caseId, approved, resolutionNote }: { caseId: string; approved: boolean; resolutionNote?: string }) =>
      api.approveCase(caseId, approved, resolutionNote),
    onSuccess: (_, { caseId }) => {
      queryClient.invalidateQueries({ queryKey: ['recovery-case', caseId] });
      queryClient.invalidateQueries({ queryKey: ['recovery-cases'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'overview'] });
    }
  });
}

export function useRetryCase() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (caseId: string) => api.retryCase(caseId),
    onSuccess: (_, caseId) => {
      queryClient.invalidateQueries({ queryKey: ['recovery-case', caseId] });
      queryClient.invalidateQueries({ queryKey: ['recovery-cases'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'overview'] });
    }
  });
}

export function useStopCase() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (caseId: string) => api.stopCase(caseId),
    onSuccess: (_, caseId) => {
      queryClient.invalidateQueries({ queryKey: ['recovery-case', caseId] });
      queryClient.invalidateQueries({ queryKey: ['recovery-cases'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'overview'] });
    }
  });
}

export function useSeedDatabase() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (count?: number) => api.seedDatabase(count),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recovery-cases'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'overview'] });
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
    }
  });
}

export function useRunSimulation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => api.runSimulation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recovery', 'metrics'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'overview'] });
    }
  });
}