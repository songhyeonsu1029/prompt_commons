import React from 'react';
import { History, GitCommit } from 'lucide-react';
import { Badge, Button } from './index';

const VersionHistory = ({
    activeTab,
    onTabChange,
    versions,
    activeVersion,
    selectedVersion,
    onVersionSelect,
    formatDate
}) => {
    return (
        <div className="mt-8">
            <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex space-x-8">
                    <button
                        onClick={() => onTabChange(activeTab === 'history' ? null : 'history')}
                        className={`${activeTab === 'history' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
                    >
                        <History className="w-4 h-4" />
                        {activeTab === 'history' ? 'Hide Version History' : 'Show Version History'}
                    </button>
                </nav>
            </div>

            {/* History Tab Timeline */}
            {activeTab === 'history' && (
                <div className="space-y-0 mb-12">
                    {[...versions].reverse().map((version, index, arr) => (
                        <div key={version.version_number} className="flex gap-4 relative">
                            {/* Timeline Line */}
                            {index !== arr.length - 1 && (
                                <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-gray-200 -ml-px"></div>
                            )}

                            <div className="flex flex-col items-center z-10">
                                <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center">
                                    <GitCommit className="w-4 h-4" />
                                </div>
                            </div>
                            <div className="pb-8 flex-1">
                                <div className="bg-white p-4 rounded-lg border border-gray-200 hover:shadow-sm transition">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-lg font-bold text-gray-900">{version.version_number}</h3>
                                            {version.version_number === activeVersion && <Badge variant="success">Latest</Badge>}
                                            {version.version_number === selectedVersion && <Badge variant="info">Viewing</Badge>}
                                        </div>
                                        <span className="text-sm text-gray-500">{formatDate(version.created_at)}</span>
                                    </div>
                                    <p className="text-gray-700 mb-4">{version.changelog}</p>
                                    <Button
                                        variant={selectedVersion === version.version_number ? "secondary" : "outline"}
                                        size="sm"
                                        onClick={() => onVersionSelect(version.version_number)}
                                        disabled={selectedVersion === version.version_number}
                                    >
                                        {selectedVersion === version.version_number ? "Currently Viewing" : "View This Version"}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default VersionHistory;
