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
            <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
                <div className="animate-spin w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    const isCalling = displayData?.status === 'CALLING';
    const isAssigned = displayData?.status === 'ASSIGNED';

    return (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-12">
            {/* Header */}
            <div className="absolute top-8 left-0 right-0 text-center">
                <h1 className="text-3xl font-bold text-slate-400">
                    {displayData?.showFlatName || 'Show Flat Queue System'}
                </h1>
            </div>

            {/* Main Content */}
            {displayData?.hasAssignment ? (
                <div className="text-center animate-fade-in">
                    {/* Status Badge */}
                    <div className="mb-6">
                        <div className={`inline-block px-6 py-2 rounded-full text-xl font-bold ${isCalling
                                ? 'bg-yellow-500/20 text-yellow-400 animate-pulse border-2 border-yellow-500'
                                : 'bg-green-500/20 text-green-400 border-2 border-green-500'
                            }`}>
                            {isCalling ? '📞 CALLING AGENT...' : '✅ ASSIGNED'}
                        </div>
                    </div>

                    {/* Queue Number Badge */}
                    <div className="mb-6">
                        <div className={`inline-block px-8 py-4 rounded-2xl shadow-2xl ${isCalling
                                ? 'bg-gradient-to-r from-yellow-500 to-orange-500 shadow-yellow-500/30 animate-pulse'
                                : 'bg-gradient-to-r from-green-500 to-emerald-500 shadow-green-500/30'
                            }`}>
                            <span className="text-5xl font-black text-white">
                                #{displayData.queueNumber}
                            </span>
                        </div>
                    </div>

                    {/* Customer Name */}
                    <div className="mb-8">
                        <p className="text-3xl text-slate-400 mb-2">Customer</p>
                        <p className="text-6xl font-bold text-white tracking-wide">
                            {displayData.customerName}
                        </p>
                    </div>

                    {/* Arrow Indicator */}
                    <div className={`mb-8 text-6xl ${isCalling ? 'text-yellow-400 animate-bounce' : 'text-primary-400'}`}>
                        ↓
                    </div>

                    {/* Instruction Text */}
                    <p className="text-3xl text-slate-300 mb-6">
                        {isCalling ? 'Waiting for agent response...' : 'Please proceed to'}
                    </p>

                    {/* Agency Badge */}
                    <div className="inline-block mb-8">
                        <div className={`px-12 py-6 rounded-2xl shadow-2xl ${isCalling
                                ? 'bg-gradient-to-r from-yellow-600 to-orange-600 shadow-yellow-500/30'
                                : 'bg-gradient-to-r from-primary-500 to-accent-500 shadow-primary-500/30'
                            }`}>
                            <span className="text-6xl font-black text-white">
                                Agency {displayData.agencyCode}
                            </span>
                        </div>
                    </div>

                    {/* Agent Name */}
                    <div className="mb-4">
                        <p className="text-2xl text-slate-400 mb-2">
                            {isCalling ? 'Calling Agent' : 'Your Agent'}
                        </p>
                        <p className="text-5xl font-bold text-white tracking-wide">
                            {displayData.agentName}
                        </p>
                    </div>

                    {/* Agency Name */}
                    <p className="text-xl text-slate-500">
                        {displayData.agencyName}
                    </p>
                </div>
            ) : (
                <div className="text-center">
                    {/* Waiting Icon */}
                    <div className="mb-8">
                        <div className="w-32 h-32 mx-auto rounded-full bg-slate-700 flex items-center justify-center">
                            <svg className="w-20 h-20 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                    </div>

                    <p className="text-5xl font-semibold text-slate-400">
                        Waiting for next customer...
                    </p>
                    <p className="text-2xl text-slate-600 mt-4">
                        Please register at the front desk
                    </p>
                </div>
            )}

            {/* Footer */}
            <div className="absolute bottom-8 left-0 right-0 text-center">
                <p className="text-sm text-slate-600">
                    Queue System • Live Updates
                </p>
            </div>

            {/* Decorative elements */}
            <div className={`absolute top-0 left-0 w-96 h-96 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 ${isCalling ? 'bg-yellow-500/10' : 'bg-primary-500/10'
                }`}></div>
            <div className={`absolute bottom-0 right-0 w-96 h-96 rounded-full blur-3xl translate-x-1/2 translate-y-1/2 ${isCalling ? 'bg-orange-500/10' : 'bg-accent-500/10'
                }`}></div>
        </div>
    );
}
