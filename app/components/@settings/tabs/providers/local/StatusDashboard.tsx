import React from 'react';
import { Button } from '~/components/ui/Button';
import { Card, CardContent } from '~/components/ui/Card';
import { Cable, Server, ArrowLeft } from 'lucide-react';
import { useLocalModelHealth } from '~/lib/hooks/useLocalModelHealth';
import HealthStatusBadge from './HealthStatusBadge';

// Status Dashboard Component
function StatusDashboard({ onBack }: { onBack: () => void }) {
  const { healthStatuses } = useLocalModelHealth();

  return (
    <div className="space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="bg-transparent hover:bg-transparent text-mindvex-elements-textSecondary hover:text-mindvex-elements-textPrimary transition-all duration-200 p-2"
          aria-label="Back to Dashboard"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h2 className="text-xl font-semibold text-mindvex-elements-textPrimary">Provider Status</h2>
          <p className="text-sm text-mindvex-elements-textSecondary">Monitor the health of your local AI providers</p>
        </div>
      </div>

      {Object.keys(healthStatuses).length === 0 ? (
        <Card className="bg-mindvex-elements-background-depth-2">
          <CardContent className="p-8 text-center">
            <Cable className="w-16 h-16 mx-auto text-mindvex-elements-textTertiary mb-4" />
            <h3 className="text-lg font-medium text-mindvex-elements-textPrimary mb-2">No Endpoints Configured</h3>
            <p className="text-sm text-mindvex-elements-textSecondary">
              Configure and enable local providers to see their endpoint status here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(healthStatuses).map(([key, status]) => (
            <Card key={key} className="bg-mindvex-elements-background-depth-2">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-mindvex-elements-background-depth-3 flex items-center justify-center">
                      <Server className="w-5 h-5 text-mindvex-elements-textPrimary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-mindvex-elements-textPrimary">{key}</h3>
                      <p className="text-xs text-mindvex-elements-textSecondary font-mono">
                        {status.isHealthy ? 'Healthy' : 'Unhealthy'}
                      </p>
                    </div>
                  </div>
                  <HealthStatusBadge
                    status={status.isHealthy ? 'healthy' : 'unhealthy'}
                    responseTime={status.latency ?? undefined}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="text-center">
                    <div className="text-mindvex-elements-textSecondary">Latency</div>
                    <div className="text-lg font-semibold text-mindvex-elements-textPrimary">
                      {status.latency ? `${status.latency}ms` : 'N/A'}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-mindvex-elements-textSecondary">Last Check</div>
                    <div className="text-lg font-semibold text-mindvex-elements-textPrimary">
                      {status.lastChecked ? new Date(status.lastChecked).toLocaleTimeString() : 'Never'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default StatusDashboard;
