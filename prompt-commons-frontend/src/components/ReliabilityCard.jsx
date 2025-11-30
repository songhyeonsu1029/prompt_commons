import React from 'react';
import { Eye } from 'lucide-react';
import { Badge } from './index';

const ReliabilityCard = ({ stats }) => {
    const isVerified = stats.reproduction_rate >= 80;
    const rateColor = isVerified ? 'text-green-600' : 'text-yellow-600';

    return (
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-6 my-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className={`text-4xl font-bold ${rateColor}`}>{stats.reproduction_rate}%</div>
                    <div>
                        <Badge variant={isVerified ? 'success' : 'warning'}>
                            {isVerified ? '✅ Verified' : '⚠️ Unverified'}
                        </Badge>
                        <p className="text-sm text-gray-600 mt-1">
                            {Math.round(stats.reproduction_count * (stats.reproduction_rate / 100))} successes out of {stats.reproduction_count}{' '}
                            attempts
                        </p>
                    </div>
                </div>
                <div className="flex items-center text-gray-600 gap-2">
                    <Eye className="w-5 h-5" />
                    <span>{stats.views.toLocaleString()} views</span>
                </div>
            </div>
        </div>
    );
};

export default ReliabilityCard;
