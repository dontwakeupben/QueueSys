import { useState, useEffect } from 'react';
import socket from '../socket';
import API_URL from '../api';

/**
 * Public Display - TV-friendly screen
 * Shows the current customer being called OR assigned
 */
export default function PublicDisplay() {
    const [displayData, setDisplayData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchDisplayData = async () => {
        try {
            const res = await fetch(`${API_URL}/api/public-display`);
            const data = await res.json();
            setDisplayData(data);
            setIsLoading(false);
        } catch (err) {
            console.error('Failed to fetch display data:', err);
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchDisplayData();
        socket.connect();

        // Listen for updates - refresh on any queue change
        socket.on('PUBLIC_DISPLAY_UPDATED', (data) => {
            console.log('Public display updated:', data);
            setDisplayData(data);
        });

        socket.on('QUEUE_UPDATED', () => {
            fetchDisplayData();
        });

        socket.on('AGENT_ACCEPTED', () => {
            fetchDisplayData();
        });

        socket.on('TIMEOUT', () => {
            fetchDisplayData();
        });

        // Poll every 5 seconds as backup
        const interval = setInterval(fetchDisplayData, 5000);

        return () => {
            socket.off('PUBLIC_DISPLAY_UPDATED');
            socket.off('QUEUE_UPDATED');
            socket.off('AGENT_ACCEPTED');
            socket.off('TIMEOUT');
            clearInterval(interval);
        };
    }, []);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
                <div className="animate-spin w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    const isCalling = displayData?.status === 'CALLING';
    const isAssigned = displayData?.status === 'ASSIGNED';

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 flex flex-col">
            {/* Header */}
            <div className="text-center py-4">
                <h1 className="text-2xl font-bold text-slate-400">
                    {displayData?.showFlatName || 'Show Flat Queue System'}
                </h1>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex items-center justify-center">
                {displayData?.hasAssignment ? (
                    <div className="text-center">
                        {/* Status Badge */}
                        <div className="mb-6">
                            <div className={`inline-block px-6 py-2 rounded-full text-lg font-bold ${isCalling
                                    ? 'bg-yellow-500/20 text-yellow-400 animate-pulse border-2 border-yellow-500'
                                    : 'bg-green-500/20 text-green-400 border-2 border-green-500'
                                }`}>
                                {isCalling ? '📞 CALLING AGENT...' : '✅ ASSIGNED'}
                            </div>
                        </div>

                        {/* Queue Number Badge */}
                        <div className="mb-4">
                            <div className={`inline-block px-6 py-3 rounded-xl shadow-xl ${isCalling
                                    ? 'bg-gradient-to-r from-yellow-500 to-orange-500 shadow-yellow-500/30 animate-pulse'
                                    : 'bg-gradient-to-r from-green-500 to-emerald-500 shadow-green-500/30'
                                }`}>
                                <span className="text-4xl font-black text-white">
                                    #{displayData.queueNumber}
                                </span>
                            </div>
                        </div>

                        {/* Customer Name */}
                        <div className="mb-6">
                            <p className="text-xl text-slate-400 mb-1">Customer</p>
                            <p className="text-4xl font-bold text-white">
                                {displayData.customerName}
                            </p>
                        </div>

                        {/* Arrow Indicator */}
                        <div className={`mb-4 text-4xl ${isCalling ? 'text-yellow-400 animate-bounce' : 'text-primary-400'}`}>
                            ↓
                        </div>

                        {/* Instruction Text */}
                        <p className="text-xl text-slate-300 mb-4">
                            {isCalling ? 'Waiting for agent response...' : 'Please proceed to'}
                        </p>

                        {/* Agency Badge */}
                        <div className="inline-block mb-6">
                            <div className={`px-8 py-4 rounded-xl shadow-xl ${isCalling
                                    ? 'bg-gradient-to-r from-yellow-600 to-orange-600 shadow-yellow-500/30'
                                    : 'bg-gradient-to-r from-primary-500 to-accent-500 shadow-primary-500/30'
                                }`}>
                                <span className="text-4xl font-black text-white">
                                    Agency {displayData.agencyCode}
                                </span>
                            </div>
                        </div>

                        {/* Agent Name */}
                        <div className="mb-2">
                            <p className="text-lg text-slate-400 mb-1">
                                {isCalling ? 'Calling Agent' : 'Your Agent'}
                            </p>
                            <p className="text-3xl font-bold text-white">
                                {displayData.agentName}
                            </p>
                        </div>

                        {/* Agency Name */}
                        <p className="text-lg text-slate-500">
                            {displayData.agencyName}
                        </p>
                    </div>
                ) : (
                    <div className="text-center">
                        {/* Waiting Icon */}
                        <div className="mb-6">
                            <div className="w-24 h-24 mx-auto rounded-full bg-slate-700 flex items-center justify-center">
                                <svg className="w-14 h-14 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        </div>

                        <p className="text-4xl font-semibold text-slate-400">
                            Waiting for next customer...
                        </p>
                        <p className="text-xl text-slate-600 mt-3">
                            Please register at the front desk
                        </p>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="text-center py-4">
                <p className="text-sm text-slate-600">
                    Queue System • Live Updates
                </p>
            </div>

            {/* Decorative elements */}
            <div className={`fixed top-0 left-0 w-64 h-64 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none ${isCalling ? 'bg-yellow-500/10' : 'bg-primary-500/10'
                }`}></div>
            <div className={`fixed bottom-0 right-0 w-64 h-64 rounded-full blur-3xl translate-x-1/2 translate-y-1/2 pointer-events-none ${isCalling ? 'bg-orange-500/10' : 'bg-accent-500/10'
                }`}></div>
        </div>
    );
}
