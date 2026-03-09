/**
 * RealTimeGraphPage.tsx
 *
 * Real-Time Dependency Graph with WebSocket Streaming
 * Uses react-force-graph-2d for visualization and STOMP over WebSocket for live updates
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { NodeObject, LinkObject } from 'react-force-graph-2d';
import ForceGraph2D from 'react-force-graph-2d';

// WebSocket libraries will be imported dynamically to prevent SSR/Hydration issues
import type { Client, StompConfig, IMessage } from '@stomp/stompjs';
import { Button } from '~/components/ui/Button';
import { Badge } from '~/components/ui/Badge';
import { Activity, Pause, Play, Download, RefreshCw, Wifi, WifiOff, ZoomIn, ZoomOut } from 'lucide-react';
import { toast } from 'react-toastify';

interface Props {
  onBack: () => void;
  repoUrl?: string;
}

interface GraphNode extends NodeObject {
  id: string;
  label: string;
  fileType: string;
  dependencies: number;
  dependents: number;
  group: string;
  size: number;
}

interface GraphLink extends LinkObject {
  source: string | GraphNode;
  target: string | GraphNode;
  type: string;
  weight: number;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface WebSocketMessage {
  type: 'job_started' | 'node_added' | 'edge_added' | 'batch_update' | 'complete' | 'heartbeat' | 'error';
  repoId: string;
  nodes?: any[];
  edges?: any[];
  metadata?: {
    totalNodes?: number;
    totalEdges?: number;
    processedFiles?: number;
    status?: string;
    message?: string;
  };
  timestamp: number;
}

interface UpdateBuffer {
  nodes: GraphNode[];
  links: GraphLink[];
}

export function RealTimeGraphPage({ onBack, repoUrl }: Props) {
  const graphRef = useRef<any>(null);
  const stompClientRef = useRef<Client | null>(null);
  const updateBufferRef = useRef<UpdateBuffer>({ nodes: [], links: [] });
  const mergeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // State
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [isConnected, setIsConnected] = useState(false);
  const [lastHeartbeat, setLastHeartbeat] = useState<Date | null>(null);
  const [physicsEnabled, setPhysicsEnabled] = useState(true);
  const [stats, setStats] = useState({
    totalNodes: 0,
    totalEdges: 0,
    processedFiles: 0,
    status: 'idle' as 'idle' | 'connecting' | 'processing' | 'completed' | 'failed',
  });
  const connectionAttemptsRef = useRef(0);
  const [repoId, setRepoId] = useState<string>('');

  // Extract repo ID from URL
  useEffect(() => {
    if (repoUrl) {
      const extractedId = extractRepoId(repoUrl);
      console.log('[RealTimeGraph] Repo URL:', repoUrl, '=> Repo ID:', extractedId);
      setRepoId(extractedId);
    } else {
      console.warn('[RealTimeGraph] No repoUrl provided!');
    }
  }, [repoUrl]);

  // Helper: Extract repo ID from URL
  const extractRepoId = (url: string): string => {
    const parts = url.replace(/\.git$/, '').split('/');

    if (parts.length >= 2) {
      return `${parts[parts.length - 2]}-${parts[parts.length - 1]}`;
    }

    return url.replace(/[^a-zA-Z0-9-]/g, '-');
  };

  // WebSocket Connection with Exponential Backoff
  const connectWebSocket = useCallback(async () => {
    if (!repoId) {
      console.warn('[WebSocket] Cannot connect - no repoId');
      return;
    }

    // Dynamic imports for browser-only WebSocket libraries
    const [{ Client }, { default: sockJS }] = await Promise.all([import('@stomp/stompjs'), import('sockjs-client')]);

    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';
    const wsUrl = backendUrl.replace(/^http/, 'ws').replace(/\/api$/, '');

    console.log('[WebSocket] Connecting to:', `${wsUrl}/ws-graph`, 'for repo:', repoId);

    setStats((prev) => ({ ...prev, status: 'connecting' }));

    const stompConfig: StompConfig = {
      webSocketFactory: () => new sockJS(`${wsUrl}/ws-graph`) as any,
      debug: (str) => console.log('[STOMP]', str),
      reconnectDelay: Math.min(1000 * Math.pow(2, connectionAttemptsRef.current), 30000),
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      onConnect: () => {
        console.log('[WebSocket] Connected successfully to repo:', repoId);
        setIsConnected(true);
        connectionAttemptsRef.current = 0;
        setStats((prev) => ({ ...prev, status: 'processing' }));

        if (stompClientRef.current) {
          stompClientRef.current.subscribe(`/topic/graph-updates/${repoId}`, handleGraphUpdate);
          stompClientRef.current.subscribe('/topic/graph-heartbeat', handleHeartbeat);
          stompClientRef.current.publish({
            destination: `/app/graph/subscribe/${repoId}`,
            body: JSON.stringify({ repoId }),
          });
        }

        toast.success('WebSocket connected - Live updates enabled');
      },
      onDisconnect: () => {
        console.log('[WebSocket] Disconnected');
        setIsConnected(false);
        toast.warning('WebSocket disconnected - Attempting to reconnect...');
      },
      onStompError: (frame) => {
        console.error('[STOMP Error]', frame);
        setIsConnected(false);
        connectionAttemptsRef.current += 1;
        console.log('[WebSocket] Connection attempt:', connectionAttemptsRef.current);
        toast.error(`WebSocket error: ${frame.headers.message || 'Connection failed'}`);
      },
    };

    const stompClient = new Client(stompConfig);
    stompClientRef.current = stompClient;
    stompClient.activate();
  }, [repoId]);

  // Handle incoming graph updates
  const handleGraphUpdate = (message: IMessage) => {
    try {
      const update: WebSocketMessage = JSON.parse(message.body);
      console.log('[Graph Update]', update.type, update);

      switch (update.type) {
        case 'job_started':
          setStats((prev) => ({ ...prev, status: 'processing' }));
          toast.info('Graph extraction started...');
          break;

        case 'node_added':
        case 'batch_update':
          if (update.nodes) {
            const newNodes: GraphNode[] = update.nodes.map((n) => ({
              id: n.id,
              label: n.label || n.id,
              fileType: n.fileType || 'unknown',
              dependencies: n.dependencies || 0,
              dependents: n.dependents || 0,
              group: n.group || 'default',
              size: n.size || 5,
            }));
            updateBufferRef.current.nodes.push(...newNodes);
          }

          if (update.edges) {
            const newLinks: GraphLink[] = update.edges.map((e) => ({
              source: e.source,
              target: e.target,
              type: e.type || 'import',
              weight: e.weight || 1,
            }));
            updateBufferRef.current.links.push(...newLinks);
          }

          break;

        case 'complete':
          setStats({
            totalNodes: update.metadata?.totalNodes || 0,
            totalEdges: update.metadata?.totalEdges || 0,
            processedFiles: update.metadata?.processedFiles || 0,
            status: 'completed',
          });
          toast.success('Graph extraction completed!');
          break;

        case 'error':
          setStats((prev) => ({ ...prev, status: 'failed' }));
          toast.error(`Error: ${update.metadata?.message || 'Unknown error'}`);
          break;
      }
    } catch (error) {
      console.error('[handleGraphUpdate] Parse error:', error);
    }
  };

  // Handle heartbeat messages
  const handleHeartbeat = (message: IMessage) => {
    setLastHeartbeat(new Date());
  };

  // Merge buffered updates periodically (100ms interval)
  useEffect(() => {
    mergeIntervalRef.current = setInterval(() => {
      const buffer = updateBufferRef.current;

      if (buffer.nodes.length > 0 || buffer.links.length > 0) {
        setGraphData((prevData) => {
          // Merge nodes
          const mergedNodeMap = new Map(prevData.nodes.map((n) => [n.id, n]));
          buffer.nodes.forEach((n) => mergedNodeMap.set(n.id, n));

          const mergedNodes = Array.from(mergedNodeMap.values());

          // Merge links
          const linkSet = new Set(prevData.links.map((l) => `${l.source}-${l.target}`));
          const newLinks = buffer.links.filter((l) => {
            const key = `${l.source}-${l.target}`;

            if (!linkSet.has(key)) {
              linkSet.add(key);
              return true;
            }

            return false;
          });

          // Clear buffer
          updateBufferRef.current = { nodes: [], links: [] };

          setStats((prevCountStats) => ({
            ...prevCountStats,
            totalNodes: mergedNodeMap.size,
            totalEdges: prevCountStats.totalEdges + buffer.links.length,
          }));

          return {
            nodes: mergedNodes,
            links: [...prevData.links, ...newLinks],
          };
        });
      }
    }, 100);

    return () => {
      if (mergeIntervalRef.current) {
        clearInterval(mergeIntervalRef.current);
      }
    };
  }, []);

  // Connect on mount
  useEffect(() => {
    if (repoId) {
      console.log('[RealTimeGraph] Initiating WebSocket connection for:', repoId);
      connectWebSocket();
    }

    return () => {
      console.log('[RealTimeGraph] Cleaning up WebSocket connection');

      if (stompClientRef.current) {
        stompClientRef.current.deactivate();
      }

      if (mergeIntervalRef.current) {
        clearInterval(mergeIntervalRef.current);
      }
    };
  }, [repoId, connectWebSocket]);

  // Custom node rendering with file type icons
  const drawNode = useCallback((node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const label = node.label || node.id;
    const fontSize = 12 / globalScale;
    const nodeSize = node.size || 5;

    // Draw node circle with color based on file type
    const color = getFileTypeColor(node.fileType);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(node.x!, node.y!, nodeSize, 0, 2 * Math.PI);
    ctx.fill();

    // Draw label
    ctx.font = `${fontSize}px Sans-Serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, node.x!, node.y! + nodeSize + fontSize);
  }, []);

  // Get color based on file type
  const getFileTypeColor = (fileType: string): string => {
    const colorMap: Record<string, string> = {
      tsx: '#61DAFB',
      ts: '#3178C6',
      jsx: '#F7DF1E',
      js: '#F7DF1E',
      java: '#007396',
      py: '#3776AB',
      go: '#00ADD8',
      rs: '#CE422B',
      cpp: '#00599C',
      cs: '#239120',
      default: '#888888',
    };
    return colorMap[fileType] || colorMap.default;
  };

  // Export graph data
  const handleExport = () => {
    const dataStr = JSON.stringify(graphData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `graph-${repoId}-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Graph data exported');
  };

  // Zoom controls
  const handleZoomIn = () => {
    if (graphRef.current) {
      graphRef.current.zoom(1.5, 400);
    }
  };

  const handleZoomOut = () => {
    if (graphRef.current) {
      graphRef.current.zoom(0.75, 400);
    }
  };

  const handleFitView = () => {
    if (graphRef.current) {
      graphRef.current.zoomToFit(400);
    }
  };

  return (
    <div className="flex flex-col h-full bg-depth-1">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-borderColor">
        <div className="flex items-center gap-4">
          <Button onClick={onBack} variant="ghost" size="sm">
            ← Back
          </Button>
          <h2 className="text-xl font-semibold text-primary">Real-Time Dependency Graph</h2>
        </div>

        {/* Connection Status */}
        <div className="flex items-center gap-2">
          {isConnected ? (
            <Badge variant="success" className="flex items-center gap-1">
              <Wifi className="w-3 h-3" />
              Live Sync
            </Badge>
          ) : (
            <Badge variant="danger" className="flex items-center gap-1">
              <WifiOff className="w-3 h-3" />
              Disconnected
            </Badge>
          )}
          {lastHeartbeat && (
            <span className="text-sm text-secondary">Last heartbeat: {lastHeartbeat.toLocaleTimeString()}</span>
          )}
        </div>
      </div>

      {/* Stats Bar */}
      <div className="flex items-center gap-4 p-3 bg-depth-2 border-b border-borderColor">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-accent" />
          <span className="text-sm font-medium">Status:</span>
          <Badge variant={stats.status === 'completed' ? 'success' : 'default'}>{stats.status}</Badge>
        </div>
        <div className="text-sm text-secondary">
          Nodes: <span className="font-semibold text-primary">{stats.totalNodes}</span>
        </div>
        <div className="text-sm text-secondary">
          Edges: <span className="font-semibold text-primary">{stats.totalEdges}</span>
        </div>
        <div className="text-sm text-secondary">
          Files: <span className="font-semibold text-primary">{stats.processedFiles}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 p-3 bg-depth-2 border-b border-borderColor">
        <Button
          onClick={() => setPhysicsEnabled(!physicsEnabled)}
          variant="secondary"
          size="sm"
          className="flex items-center gap-2"
        >
          {physicsEnabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          {physicsEnabled ? 'Freeze Physics' : 'Enable Physics'}
        </Button>
        <Button onClick={handleZoomIn} variant="secondary" size="sm">
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button onClick={handleZoomOut} variant="secondary" size="sm">
          <ZoomOut className="w-4 h-4" />
        </Button>
        <Button onClick={handleFitView} variant="secondary" size="sm">
          Fit View
        </Button>
        <Button onClick={handleExport} variant="secondary" size="sm" className="flex items-center gap-2">
          <Download className="w-4 h-4" />
          Export
        </Button>
        <Button onClick={connectWebSocket} variant="secondary" size="sm" className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Reconnect
        </Button>
      </div>

      <div className="flex-1 relative">
        <ForceGraph2D
          ref={graphRef}
          graphData={graphData}
          nodeLabel={(node: any) => `${node.label || node.id}\n${node.fileType}`}
          nodeCanvasObject={drawNode}
          linkColor={() => 'rgba(255, 255, 255, 0.2)'}
          linkWidth={(link: any) => link.weight || 1}
          linkDirectionalArrowLength={3}
          linkDirectionalArrowRelPos={1}
          enableNodeDrag={true}
          cooldownTicks={physicsEnabled ? Infinity : 0}
          onNodeClick={(node: any) => {
            console.log('[Node Clicked]', node);
            toast.info(`${node.label || node.id} (${node.fileType})`);
          }}
          backgroundColor="#000000"
        />
      </div>
    </div>
  );
}
