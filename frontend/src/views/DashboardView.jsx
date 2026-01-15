import { useState, useEffect } from 'react';
import socket from '../socket';
import API_URL from '../api';

/**
 * Dashboard View - Front Desk Interface
 * Features:
 * - New Walk-In button with customer name input
 * - Agency columns with queued agents
 * - Active agency highlighting
 * - Live call status
 */
export default function DashboardView() {
    const [dashboard, setDashboard] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [callStatus, setCallStatus] = useState(null);
    const [customerName, setCustomerName] = useState('');
    const [showNameInput, setShowNameInput] = useState(false);

    // Fetch dashboard data
    const fetchDashboard = async () => {
        try {
            const res = await fetch(`${API_URL}/api/dashboard`);
            const data = await res.json();
            setDashboard(data);
            setIsLoading(false);
        } catch (err) {
            console.error('Failed to fetch dashboard:', err);
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboard();
        socket.connect();

        // Listen for queue updates
        socket.on('QUEUE_UPDATED', (data) => {
            console.log('Queue updated:', data);
            setDashboard(data);
        });

        socket.on('AGENT_ACCEPTED', (data) => {
            console.log('Agent accepted:', data);
            setCallStatus({
                type: 'success',
                message: `${data.agent.name} from Agency ${data.agency.code} accepted the customer!`,
            });
            setTimeout(() => setCallStatus(null), 5000);
        });

        socket.on('TIMEOUT', (data) => {
            console.log('Timeout:', data);
            if (data.status === 'FAILED') {
                setCallStatus({
                    type: 'error',
                    message: data.message || 'No agents available',
                });
                setTimeout(() => setCallStatus(null), 5000);
            }
        });

        return () => {
            socket.off('QUEUE_UPDATED');
            socket.off('AGENT_ACCEPTED');
            socket.off('TIMEOUT');
        };
    }, []);

    // Create new walk-in
    const handleNewWalkIn = async () => {
        if (!customerName.trim()) {
            setShowNameInput(true);
            return;
        }

        setIsCreating(true);
        setCallStatus(null);

        try {
            const res = await fetch(`${API_URL}/api/walkin/new`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customerName: customerName.trim() }),
            });
            const data = await res.json();

            if (data.success) {
                setCallStatus({
                    type: 'calling',
                    message: `Calling ${data.agent.name} for ${customerName} (Queue #${data.walkIn.queueNumber})...`,
                    walkInId: data.walkIn.id,
                });
                setCustomerName('');
                setShowNameInput(false);
            } else {
                setCallStatus({
                    type: 'error',
                    message: data.error || 'Failed to create walk-in',
                });
                setTimeout(() => setCallStatus(null), 5000);
            }
        } catch (err) {
            console.error('Failed to create walk-in:', err);
            setCallStatus({
                type: 'error',
                message: 'Failed to create walk-in',
            });
            setTimeout(() => setCallStatus(null), 5000);
        } finally {
            setIsCreating(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="animate-spin w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto">
            {/* Header with New Walk-In Button */}
            <div className="glass-card p-6 mb-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-white">{dashboard?.showFlat?.name || 'Show Flat'}</h2>
                        <p className="text-slate-400">
                            Rotation: {dashboard?.showFlat?.rotationOrder?.join(' → ')} |
                            Timeout: {dashboard?.showFlat?.timeoutSeconds}s
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        {showNameInput && (
                            <input
                                type="text"
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                placeholder="Customer name..."
                                className="px-4 py-3 rounded-xl bg-slate-800 border border-slate-600 text-white placeholder-slate-400 focus:outline-none focus:border-primary-500"
                                onKeyPress={(e) => e.key === 'Enter' && handleNewWalkIn()}
                                autoFocus
                            />
                        )}
                        <button
                            onClick={() => showNameInput ? handleNewWalkIn() : setShowNameInput(true)}
                            disabled={isCreating || callStatus?.type === 'calling'}
                            className="btn-glow px-8 py-4 bg-gradient-to-r from-primary-500 to-accent-500 rounded-xl font-bold text-xl text-white shadow-lg shadow-primary-500/30 hover:shadow-primary-500/50 transition-all transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
                        >
                            {isCreating ? (
                                <span className="flex items-center gap-2">
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    Creating...
                                </span>
                            ) : showNameInput ? (
                                'SUBMIT'
                            ) : (
                                '+ NEW WALK-IN'
                            )}
                        </button>
                        {showNameInput && (
                            <button
                                onClick={() => { setShowNameInput(false); setCustomerName(''); }}
                                className="px-4 py-4 rounded-xl bg-slate-700 text-slate-300 hover:bg-slate-600"
                            >
                                Cancel
                            </button>
                        )}
                    </div>
                </div>

                {/* Call Status Banner */}
                {callStatus && (
                    <div className={`mt-4 p-4 rounded-xl flex items-center gap-3 ${callStatus.type === 'calling' ? 'bg-yellow-500/20 border border-yellow-500/30' :
                        callStatus.type === 'success' ? 'bg-green-500/20 border border-green-500/30' :
                            'bg-red-500/20 border border-red-500/30'
                        }`}>
                        {callStatus.type === 'calling' && (
                            <div className="w-6 h-6 border-3 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
                        )}
                        {callStatus.type === 'success' && (
                            <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        )}
                        {callStatus.type === 'error' && (
                            <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        )}
                        <span className={`font-medium ${callStatus.type === 'calling' ? 'text-yellow-300' :
                            callStatus.type === 'success' ? 'text-green-300' :
                                'text-red-300'
                            }`}>
                            {callStatus.message}
                        </span>
                    </div>
                )}
            </div>

            {/* Agency Columns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {dashboard?.agencyQueues?.map((agency) => (
                    <div
                        key={agency.id}
                        className={`glass-card p-6 transition-all ${agency.isActive ? 'agency-active' : ''
                            }`}
                    >
                        {/* Agency Header */}
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold ${agency.isActive
                                    ? 'bg-gradient-to-br from-primary-500 to-accent-500 text-white pulse-ring'
                                    : 'bg-slate-700 text-slate-300'
                                    }`}>
                                    {agency.code}
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-white">{agency.name}</h3>
                                    <p className="text-sm text-slate-400">
                                        {agency.queuedAgents.length} / {agency.totalAgents} online
                                    </p>
                                </div>
                            </div>
                            {agency.isActive && (
                                <span className="px-3 py-1 bg-primary-500/20 text-primary-300 rounded-full text-sm font-medium animate-pulse">
                                    NEXT
                                </span>
                            )}
                        </div>

                        {/* Agent Queue */}
                        <div className="space-y-2">
                            {agency.queuedAgents.length === 0 ? (
                                <div className="py-8 text-center text-slate-500">
                                    <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                    <p>No agents online</p>
                                </div>
                            ) : (
                                agency.queuedAgents.map((agent, index) => (
                                    <div
                                        key={agent.id}
                                        className={`p-3 rounded-lg flex items-center gap-3 ${index === 0 && agency.isActive
                                            ? 'bg-primary-500/20 border border-primary-500/30'
                                            : 'bg-slate-800/50'
                                            }`}
                                    >
                                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                        <div className="flex-1">
                                            <span className="font-medium text-white">{agent.name}</span>
                                        </div>
                                        <span className="text-xs text-slate-500">
                                            #{index + 1}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Last Assignment Info */}
            {dashboard?.lastAssignment && (
                <div className="glass-card p-4 mt-6">
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span className="text-slate-400">Last Assignment:</span>
                        <span className="font-medium text-white">
                            {dashboard.lastAssignment.agentName}
                        </span>
                        <span className="text-slate-400">from Agency</span>
                        <span className="font-medium text-primary-400">
                            {dashboard.lastAssignment.agencyCode}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
