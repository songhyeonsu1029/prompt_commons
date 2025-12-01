import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { Badge } from './index';

const ExperimentHeader = ({
    experiment,
    selectedVersion,
    onVersionChange,
    displayData,
    formatDate
}) => {
    return (
        <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-gray-900">{experiment.title}</h1>
                {/* Version Selector */}
                <div className="relative inline-block">
                    <select
                        value={selectedVersion || ''}
                        onChange={(e) => onVersionChange(e.target.value)}
                        className="appearance-none bg-gray-100 border border-gray-300 text-gray-700 py-1 pl-3 pr-8 rounded leading-tight focus:outline-none focus:bg-white focus:border-gray-500 text-sm font-medium cursor-pointer"
                    >
                        {experiment.versions.map((v) => (
                            <option key={v.version_number} value={v.version_number}>
                                {v.version_number} {v.version_number === experiment.active_version ? '(Latest)' : ''}
                            </option>
                        ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                        <ChevronDown className="h-4 w-4" />
                    </div>
                </div>
                <Badge variant="info">{selectedVersion}</Badge>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gray-700 text-white flex items-center justify-center font-bold">
                        {experiment.author.username.charAt(0).toUpperCase()}
                    </div>
                    <Link to={`/users/${experiment.author.username}`} className="hover:underline">
                        <span>{experiment.author.username}</span>
                    </Link>
                </div>
                <span>•</span>
                <span>Published on {formatDate(displayData.created_at)}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
                {displayData.tags.map((tag) => (
                    <Link key={tag} to={`/search?tag=${tag}`} className="hover:opacity-80 transition-opacity">
                        <Badge className="cursor-pointer hover:bg-gray-200">{tag}</Badge>
                    </Link>
                ))}
            </div>
        </div>
    );
};

export default ExperimentHeader;
