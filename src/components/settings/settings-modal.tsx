'use client'

import { useState } from 'react'
import { X, User, Shield, Settings, Globe, Palette } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useTranslation } from '@/lib/language-context'
import { AdminPanel } from './admin-panel'
import { ProfilePanel } from './profile-panel'
import { LanguagePanel } from './language-panel'
import { AppearancePanel } from './appearance-panel'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

type SettingsTab = 'profile' | 'appearance' | 'language' | 'admin'

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { isAdmin } = useAuth()
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile')

  if (!isOpen) return null

  const tabs = [
    { id: 'profile' as const, label: t('settings', 'profile'), icon: User },
    { id: 'appearance' as const, label: t('settings', 'appearance'), icon: Palette },
    { id: 'language' as const, label: t('settings', 'language'), icon: Globe },
    ...(isAdmin ? [{ id: 'admin' as const, label: t('settings', 'administration'), icon: Shield }] : []),
  ]

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="bg-surface rounded-lg shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{
          animation: 'slideUp 0.2s ease',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-paper-lines bg-paper-warm/50">
          <div className="flex items-center gap-3 min-w-0">
            <Settings size={18} className="text-ink-light flex-shrink-0" />
            <div className="min-w-0">
              <h2 className="font-hand text-xl text-ink leading-tight">{t('settings', 'title')}</h2>
              <p className="text-xs text-ink-faded">{t('settings', 'subtitle')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-icon hover:bg-red-50 hover:text-red-500 hover:border-red-200 flex-shrink-0"
            aria-label={t('common', 'close')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content with Tabs */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Tabs */}
          <div className="w-48 border-r border-paper-lines bg-paper-cream/50 py-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all
                  ${activeTab === tab.id 
                    ? 'bg-surface text-ink border-r-2 border-ink-blue shadow-sm' 
                    : 'text-ink-light hover:bg-surface/50 hover:text-ink'
                  }`}
              >
                <tab.icon size={18} />
                <span className="font-medium text-sm">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-6 bg-surface">
            {activeTab === 'profile' && <ProfilePanel />}
            {activeTab === 'appearance' && <AppearancePanel />}
            {activeTab === 'language' && <LanguagePanel />}
            {activeTab === 'admin' && isAdmin && <AdminPanel />}
          </div>
        </div>
      </div>
    </div>
  )
}
