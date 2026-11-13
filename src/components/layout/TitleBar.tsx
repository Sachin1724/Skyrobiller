import React, { useState, useEffect } from 'react';
import { Minus, Square, Copy, X, Plane, Cpu } from 'lucide-react';
import { useSystemStore } from '../../store/useSystemStore';

export const TitleBar: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false);
  const { company } = useSystemStore();

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.isMaximized().then(setIsMaximized);
    }
  }, []);

  const handleMinimize = () => {
    window.electronAPI?.minimize();
  };

  const handleMaximize = async () => {
    await window.electronAPI?.maximize();
    const max = await window.electronAPI?.isMaximized();
    setIsMaximized(max ?? false);
  };

  const handleClose = () => {
    window.electronAPI?.close();
  };

  return (
    <div className="h-9 w-full bg-slate-950/90 backdrop-blur border-b border-slate-800/80 flex items-center justify-between px-3 drag-region select-none text-xs text-slate-300 z-50">
      {/* Brand & Identity */}
      <div className="flex items-center gap-2.5">
        <div className="h-5 w-5 rounded bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
          <Plane className="h-3.5 w-3.5 transform -rotate-45" />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-bold tracking-wider text-slate-100 uppercase">Skyro Biller</span>
          <span className="text-slate-500 text-[10px]">v1.0</span>
          <span className="px-1.5 py-0.5 rounded bg-blue-950/60 border border-blue-800/50 text-[10px] text-blue-400 font-medium">
            {company.financialYear}
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400 text-[11px] truncate max-w-[200px]">{company.tradeName}</span>
        </div>
      </div>

      {/* Middle Drag Zone */}
      <div className="flex-1 text-center font-medium text-slate-500 tracking-wide text-[11px]">
        UAV Parts & Systems Billing Suite
      </div>

      {/* Windows Native Control Buttons */}
      <div className="flex items-center no-drag -mr-3 h-full">
        <button
          onClick={handleMinimize}
          className="h-full px-3.5 hover:bg-slate-800/80 transition-colors flex items-center justify-center text-slate-400 hover:text-slate-100"
          title="Minimize"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={handleMaximize}
          className="h-full px-3.5 hover:bg-slate-800/80 transition-colors flex items-center justify-center text-slate-400 hover:text-slate-100"
          title={isMaximized ? "Restore" : "Maximize"}
        >
          {isMaximized ? <Copy className="h-3 w-3" /> : <Square className="h-3 w-3" />}
        </button>
        <button
          onClick={handleClose}
          className="h-full px-4 hover:bg-red-600/90 transition-colors flex items-center justify-center text-slate-400 hover:text-white"
          title="Close"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
