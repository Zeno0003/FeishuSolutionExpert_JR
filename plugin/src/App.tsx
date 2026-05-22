/**
 * 插件主入口 — Tab 路由
 */
import React, { useState } from 'react';
import AccessorySplit from './tabs/AccessorySplit';
import BatchImport from './tabs/BatchImport';
import './App.css';

type TabKey = 'split' | 'import';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'split', label: '配件拆分' },
  { key: 'import', label: '批量导入' },
];

export default function App() {
  const [tab, setTab] = useState<TabKey>('split');

  return (
    <div className="app">
      <nav className="tab-bar">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`tab-btn ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="tab-body">
        {tab === 'split' && <AccessorySplit />}
        {tab === 'import' && <BatchImport />}
      </main>
    </div>
  );
}
