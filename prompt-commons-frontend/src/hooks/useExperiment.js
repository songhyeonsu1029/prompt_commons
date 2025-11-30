import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchExperimentById, saveExperiment, updateExperiment } from '../services/api';
import toast from 'react-hot-toast';

export const useExperiment = (id, user) => {
    const queryClient = useQueryClient();

    // Fetch Experiment Data
    const { data: experiment, isLoading, isError, error } = useQuery({
        queryKey: ['experiment', id, { version: user?.username }], // user.username is for isSaved check
        queryFn: () => fetchExperimentById(id, user?.username),
        enabled: !!id,
    });

    // Save Mutation
    const saveMutation = useMutation({
        mutationFn: () => saveExperiment(id, user?.username),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['experiment', id] });
            queryClient.invalidateQueries({ queryKey: ['user', 'me'] });
            toast.success(data.isSaved ? "Experiment saved!" : "Experiment unsaved.");
        },
        onError: (err) => {
            toast.error(err.message || "Failed to update save status.");
        }
    });

    // Publish Version Mutation
    const publishMutation = useMutation({
        mutationFn: (newVersionData) => updateExperiment(id, newVersionData),
        onSuccess: (updatedExperiment) => {
            toast.success('New version published!');
            queryClient.setQueryData(['experiment', id, { version: user?.username }], updatedExperiment);
            queryClient.invalidateQueries({ queryKey: ['experiments'] });
            queryClient.invalidateQueries({ queryKey: ['user', 'me'] });
        },
        onError: (err) => {
            console.error('Failed to publish new version:', err);
            toast.error('Failed to publish new version.');
        }
    });

    return {
        experiment,
        isLoading,
        isError,
        error,
        saveMutation,
        publishMutation,
    };
};
