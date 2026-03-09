import React from 'react';
import { Dialog, DialogRoot, DialogTitle } from '~/components/ui/Dialog';
import { classNames } from '~/utils/classNames';
import { Link2, Github, X } from 'lucide-react';

interface ImportRepoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectUrl: () => void;
  onSelectGithub: () => void;
}

export function ImportRepoModal({ isOpen, onClose, onSelectUrl, onSelectGithub }: ImportRepoModalProps) {
  return (
    <DialogRoot open={isOpen} onOpenChange={onClose}>
      <Dialog
        showCloseButton={false}
        className="w-[450px] bg-[#0d0d0d] border border-white/5 !rounded-2xl !p-6 overflow-hidden shadow-2xl"
      >
        <div className="flex flex-col w-full">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <DialogTitle className="text-xl font-bold text-white mb-0">Import Repository</DialogTitle>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {/* Clone by URL */}
            <button
              onClick={onSelectUrl}
              className={classNames(
                'flex flex-col items-start text-left w-full p-4 rounded-xl transition-all duration-200',
                'bg-[#121212] border border-white/5 hover:border-green-500/50 hover:bg-[#151515]',
                'group relative overflow-hidden',
              )}
            >
              <div className="flex items-center gap-4 relative z-10 w-full">
                <div className="w-12 h-12 rounded-lg bg-[#0e1a12] flex items-center justify-center border border-green-500/10 flex-shrink-0">
                  <Link2 className="w-6 h-6 text-green-500" />
                </div>
                <div className="flex flex-col gap-1 items-start w-full">
                  <span className="text-base font-bold text-white">Clone by URL</span>
                  <span className="text-[13px] text-gray-400">Enter a public GitHub repository URL</span>
                </div>
              </div>
            </button>

            {/* My GitHub Repositories */}
            <button
              onClick={onSelectGithub}
              className={classNames(
                'flex flex-col items-start text-left w-full p-4 rounded-xl transition-all duration-200',
                'bg-[#121212] border border-white/5 hover:border-blue-500/50 hover:bg-[#151515]',
                'group relative overflow-hidden',
              )}
            >
              <div className="flex items-center gap-4 relative z-10 w-full">
                <div className="w-12 h-12 rounded-lg bg-[#111928] flex items-center justify-center border border-blue-500/10 flex-shrink-0">
                  <Github className="w-6 h-6 text-blue-400" />
                </div>
                <div className="flex flex-col gap-1 items-start flex-1 min-w-0">
                  <div className="flex items-center justify-between w-full">
                    <span className="text-base font-bold text-white">My GitHub Repositories</span>
                    <div className="bg-[#0e1a12] border border-green-500/20 px-2 py-0.5 rounded text-[10px] font-bold text-green-400">
                      Connected
                    </div>
                  </div>
                  <span className="text-[13px] text-gray-400">Browse and import your private/public repositories</span>
                </div>
              </div>
            </button>
          </div>
        </div>
      </Dialog>
    </DialogRoot>
  );
}
