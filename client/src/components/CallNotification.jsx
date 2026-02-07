import React from 'react';
import { Phone, PhoneOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const CallNotification = ({ caller, roomId, onDecline, onAccept }) => {
    const navigate = useNavigate();

    const handleAccept = () => {
        onAccept();
        navigate(`/room/${roomId}`);
    };

    return (
        <div className="fixed top-4 right-4 z-50 bg-white dark:bg-slate-900 rounded-lg shadow-xl border-l-4 border-indigo-500 p-4 max-w-sm w-full animate-in slide-in-from-top-2 duration-300">
            <div className="flex items-start gap-4">
                <div className="bg-indigo-100 dark:bg-slate-800 p-3 rounded-full">
                    <Phone className="text-indigo-600 dark:text-indigo-400 w-6 h-6 animate-pulse" />
                </div>
                <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white">Incoming Call</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        <span className="font-medium text-gray-900 dark:text-white">{caller}</span> is calling you...
                    </p>
                    <div className="flex gap-3 mt-4">
                        <button
                            onClick={handleAccept}
                            className="flex-1 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            <Phone className="w-4 h-4" />
                            Accept
                        </button>
                        <button
                            onClick={onDecline}
                            className="flex-1 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            <PhoneOff className="w-4 h-4" />
                            Decline
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CallNotification;
