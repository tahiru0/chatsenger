'use client';

import { useState } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { FiX } from 'react-icons/fi';

type SettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { theme, setTheme, availableThemes } = useTheme();
  const [activeTab, setActiveTab] = useState<'appearance' | 'account' | 'notifications'>('appearance');

  if (!isOpen) return null;

  return (
    <div className="modal modal-open">
      <div className="modal-box w-11/12 max-w-3xl bg-base-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg text-base-content">Settings</h3>
          <button 
            className="btn btn-sm btn-circle btn-ghost text-base-content" 
            onClick={onClose}
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>
        
        <div className="tabs tabs-boxed mb-4 bg-base-200">
          <button 
            className={`tab ${activeTab === 'appearance' ? 'tab-active' : ''} text-base-content`}
            onClick={() => setActiveTab('appearance')}
          >
            Appearance
          </button>
          <button 
            className={`tab ${activeTab === 'account' ? 'tab-active' : ''} text-base-content`}
            onClick={() => setActiveTab('account')}
          >
            Account
          </button>
          <button 
            className={`tab ${activeTab === 'notifications' ? 'tab-active' : ''} text-base-content`}
            onClick={() => setActiveTab('notifications')}
          >
            Notifications
          </button>
        </div>
        
        {activeTab === 'appearance' && (
          <div className="appearance-settings">
            <h4 className="font-semibold mb-2 text-base-content">Theme</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {availableThemes.map((t) => (
                <button
                  key={t}
                  className={`btn ${theme === t ? 'btn-primary' : 'btn-outline text-base-content'}`}
                  onClick={() => setTheme(t)}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {activeTab === 'account' && (
          <div className="account-settings">
            <h4 className="font-semibold mb-2 text-base-content">Account Settings</h4>
            <p className="text-base-content/70 mb-2">Manage your account settings and preferences.</p>
            <div className="form-control">
              <label className="label">
                <span className="label-text text-base-content/80">Display Name</span>
              </label>
              <input type="text" placeholder="Display Name" className="input input-bordered text-base-content" />
            </div>
            <div className="form-control mt-2">
              <label className="label">
                <span className="label-text text-base-content/80">Phone Number</span>
              </label>
              <input type="tel" placeholder="Phone Number" className="input input-bordered text-base-content" disabled />
            </div>
          </div>
        )}
        
        {activeTab === 'notifications' && (
          <div className="notification-settings">
            <h4 className="font-semibold mb-2 text-base-content">Notification Settings</h4>
            <p className="text-base-content/70 mb-2">Control your notification preferences.</p>
            <div className="form-control">
              <label className="label cursor-pointer">
                <span className="label-text text-base-content/80">Message Notifications</span>
                <input type="checkbox" className="toggle toggle-primary" defaultChecked />
              </label>
            </div>
            <div className="form-control">
              <label className="label cursor-pointer">
                <span className="label-text text-base-content/80">Friend Request Notifications</span>
                <input type="checkbox" className="toggle toggle-primary" defaultChecked />
              </label>
            </div>
            <div className="form-control">
              <label className="label cursor-pointer">
                <span className="label-text text-base-content/80">Sound Effects</span>
                <input type="checkbox" className="toggle toggle-primary" defaultChecked />
              </label>
            </div>
          </div>
        )}
        
        <div className="modal-action">
          <button className="btn bg-base-300 text-base-content hover:bg-base-200" onClick={onClose}>Close</button>
        </div>
      </div>
      <div className="modal-backdrop bg-base-300/50" onClick={onClose}></div>
    </div>
  );
}
