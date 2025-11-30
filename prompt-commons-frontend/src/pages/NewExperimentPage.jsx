import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import PropTypes from 'prop-types';
import toast from 'react-hot-toast';
import { useForm, useWatch } from 'react-hook-form';
import { Button } from '../components';
import { createExperiment } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

// Helper component for labels to avoid repetition
const FormLabel = ({ htmlFor, required, children }) => (
  <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 mb-1">
    {children}
    {required && <span className="text-red-500 ml-1">*</span>}
  </label>
);

FormLabel.propTypes = {
  htmlFor: PropTypes.string.isRequired,
  required: PropTypes.bool,
  children: PropTypes.node.isRequired,
};

// Helper for error messages
const FormError = ({ message }) => (
  <p className="text-xs text-red-600 mt-1">{message}</p>
);

FormError.propTypes = {
  message: PropTypes.string,
};

const NewExperimentPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { register, handleSubmit, control, formState: { errors } } = useForm({
    defaultValues: {
      title: '',
      ai_model: '',
      model_version: '',
      task_type: '',
      prompt_text: '',
      modification_guide: '',
      description: '',
      tags: '',
    }
  });

  const promptText = useWatch({ control, name: 'prompt_text' });

  const queryClient = useQueryClient();
  const createMutation = useMutation({
    mutationFn: (data) => createExperiment(data, user),
    onSuccess: (newExperiment) => {
      toast.success('Experiment created successfully!');
      queryClient.invalidateQueries({ queryKey: ['experiments'] });
      navigate(`/experiments/${newExperiment.id}`);
    },
    onError: (err) => {
      console.error('Failed to create experiment:', err);
      toast.error('Failed to create experiment.');
    }
  });

  const onSubmit = (data) => {
    if (!user) {
      toast.error('You must be logged in to create an experiment.');
      return;
    }
    createMutation.mutate(data);
  };

  const handleCancel = () => {
    if (window.confirm('Are you sure you want to discard your changes?')) {
      navigate(-1);
    }
  };

  const getInputClassName = (fieldName) =>
    `w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 ${errors[fieldName] ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`;

  return (
    <div className="max-w-3xl mx-auto my-10">
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Create New Experiment</h1>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Title */}
          <div>
            <FormLabel htmlFor="title" required>
              Experiment Title
            </FormLabel>
            <input
              type="text"
              id="title"
              {...register('title', { required: 'Title is required.' })}
              placeholder="e.g., GPT-4 TDD Code Generation"
              className={getInputClassName('title')}
            />
            {errors.title && <FormError message={errors.title.message} />}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* AI Model */}
            <div>
              <FormLabel htmlFor="ai_model" required>
                AI Model
              </FormLabel>
              <input
                type="text"
                id="ai_model"
                {...register('ai_model', { required: 'AI Model is required.' })}
                placeholder="e.g., GPT-4, Claude 3, Gemini Pro"
                className={getInputClassName('ai_model')}
              />
              {errors.ai_model && <FormError message={errors.ai_model.message} />}
            </div>

            {/* Model Version */}
            <div>
              <FormLabel htmlFor="model_version">Model Version</FormLabel>
              <input
                type="text"
                id="model_version"
                {...register('model_version')}
                placeholder="e.g., gpt-4-turbo-2024-04-09"
                className={getInputClassName('model_version')}
              />
              <p className="text-xs text-gray-500 mt-1">Specific version string if known.</p>
            </div>
          </div>

          {/* Task Type */}
          <div>
            <FormLabel htmlFor="task_type">
              Task Type
            </FormLabel>
            <input
              type="text"
              id="task_type"
              {...register('task_type')}
              placeholder="e.g., Code Generation, Translation, Analysis"
              className={getInputClassName('task_type')}
            />
            <p className="text-xs text-gray-500 mt-1">Describe the type of task this prompt is designed for.</p>
          </div>

          {/* Prompt Text */}
          <div>
            <FormLabel htmlFor="prompt_text" required>
              Prompt
            </FormLabel>
            <textarea
              id="prompt_text"
              rows="10"
              {...register('prompt_text', { required: 'Prompt text is required.' })}
              placeholder="Paste your full prompt here..."
              className={`${getInputClassName('prompt_text')} font-mono text-sm`}
            />
            {errors.prompt_text && <FormError message={errors.prompt_text.message} />}
            <p className="text-xs text-gray-500 text-right mt-1">
              {promptText?.length || 0} chars
            </p>
          </div>

          {/* Modification Guide */}
          <div>
            <FormLabel htmlFor="modification_guide">Modification Guide</FormLabel>
            <textarea
              id="modification_guide"
              rows="4"
              {...register('modification_guide')}
              placeholder="Instructions for others on how to adapt this prompt (e.g., 'Replace [Subject] with your topic')."
              className={getInputClassName('modification_guide')}
            />
            <p className="text-xs text-gray-500 mt-1">This will be shown in the Reproduction Workbench.</p>
          </div>

          {/* Description */}
          <div>
            <FormLabel htmlFor="description">Prompt Description</FormLabel>
            <textarea
              id="description"
              rows="4"
              {...register('description')}
              placeholder="Explain the purpose and context of this prompt..."
              className={getInputClassName('description')}
            />
          </div>

          {/* Tags */}
          <div>
            <FormLabel htmlFor="tags">Tags</FormLabel>
            <input
              type="text"
              id="tags"
              {...register('tags', {
                pattern: {
                  value: /^[a-zA-Z0-9, ]*$/,
                  message: "Tags should be comma-separated words."
                }
              })}
              placeholder="e.g., React, TDD, Testing"
              className={getInputClassName('tags')}
            />
            {errors.tags && <FormError message={errors.tags.message} />}
            <p className="text-xs text-gray-500 mt-1">Max 5 tags, comma-separated.</p>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-4 pt-4">
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Register Experiment'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewExperimentPage;