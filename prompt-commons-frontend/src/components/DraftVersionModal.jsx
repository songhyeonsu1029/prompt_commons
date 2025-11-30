import React from 'react';
import { Button } from './index';

const DraftVersionModal = ({
    isOpen,
    onClose,
    onSubmit,
    experiment,
    selectedVersion,
    displayData
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <h2 className="text-2xl font-bold mb-4">Draft New Version</h2>
                <form onSubmit={onSubmit}>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label htmlFor="source-version" className="block text-sm font-medium text-gray-700 mb-1">Source Version</label>
                            <input
                                id="source-version"
                                type="text"
                                value={selectedVersion || experiment.active_version}
                                disabled
                                className="w-full bg-gray-100 border border-gray-300 rounded-md shadow-sm p-2 text-gray-500"
                            />
                        </div>
                        <div>
                            <label htmlFor="version-number" className="block text-sm font-medium text-gray-700 mb-1">New Version Number</label>
                            <input
                                id="version-number"
                                name="version_number"
                                type="text"
                                placeholder="e.g., v1.3"
                                required
                                className="w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label htmlFor="ai-model" className="block text-sm font-medium text-gray-700 mb-1">AI Model</label>
                            <input
                                id="ai-model"
                                name="ai_model"
                                type="text"
                                defaultValue={experiment.ai_model}
                                placeholder="e.g., GPT-4, Claude 3"
                                required
                                className="w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label htmlFor="model-version" className="block text-sm font-medium text-gray-700 mb-1">Model Version</label>
                            <input
                                id="model-version"
                                name="model_version"
                                type="text"
                                defaultValue={experiment.model_version}
                                placeholder="e.g., gpt-4-turbo-2024-04-09"
                                required
                                className="w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>

                    <div className="mb-4">
                        <label htmlFor="prompt-description" className="block text-sm font-medium text-gray-700 mb-1">Prompt Description</label>
                        <textarea
                            id="prompt-description"
                            name="prompt_description"
                            defaultValue={displayData.prompt_description || ''}
                            placeholder="Describe what this prompt does and its purpose..."
                            rows={3}
                            className="w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>

                    <div className="mb-4">
                        <label htmlFor="modification-guide" className="block text-sm font-medium text-gray-700 mb-1">Modification Guide</label>
                        <textarea
                            id="modification-guide"
                            name="modification_guide"
                            defaultValue={displayData.modification_guide || ''}
                            placeholder="Provide guidance on how to modify or customize this prompt..."
                            rows={3}
                            className="w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>

                    <div className="mb-4">
                        <label htmlFor="prompt-text" className="block text-sm font-medium text-gray-700 mb-1">Prompt Text</label>
                        <textarea
                            id="prompt-text"
                            name="prompt_text"
                            defaultValue={displayData.prompt_text}
                            rows={10}
                            required
                            className="w-full border border-gray-300 rounded-md shadow-sm p-2 font-mono text-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>

                    <div className="mb-6">
                        <label htmlFor="changelog" className="block text-sm font-medium text-gray-700 mb-1">Changelog</label>
                        <textarea
                            id="changelog"
                            name="changelog"
                            placeholder="What changed in this version?"
                            rows={3}
                            required
                            className="w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>

                    <div className="flex justify-end gap-3">
                        <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
                        <Button variant="primary" type="submit">Publish Version</Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default DraftVersionModal;
