import React, { useState, useEffect } from "react";
import { Info, Settings, Plus, Trash2, Power, PowerOff } from "lucide-react";
import { type Tool } from "use-mcp/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useMcp } from "mcp-use/react";

interface McpServer {
  id: string;
  url: string;
  enabled: boolean;
  name?: string;
  transportType: "auto" | "http" | "sse";
}

// MCP Connection wrapper for a single server
function McpConnection({
  server,
  onConnectionUpdate,
}: {
  server: McpServer;
  onConnectionUpdate: (serverId: string, data: any) => void;
}) {
  // Use the MCP hook with the server URL
  const resolveUrlForTransport = (rawUrl: string): string => {
    try {
      const target = new URL(rawUrl);
      const host = target.hostname.toLowerCase();

      const isIPv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
      const isIPv6 = host.includes(":");

      const isLocalHostname =
        host === "localhost" ||
        host === "0.0.0.0" ||
        host === "::1" ||
        host.endsWith(".local");

      let isPrivateLan = false;
      if (isIPv4) {
        const [a, b] = host.split(".").map((n) => parseInt(n, 10));
        if (a === 10) isPrivateLan = true; // 10.0.0.0/8
        if (a === 127) isPrivateLan = true; // 127.0.0.0/8 loopback
        if (a === 192 && b === 168) isPrivateLan = true; // 192.168.0.0/16
        if (a === 172 && b >= 16 && b <= 31) isPrivateLan = true; // 172.16.0.0/12
        if (a === 169 && b === 254) isPrivateLan = true; // 169.254.0.0/16 link-local
        if (a === 100 && b >= 64 && b <= 127) isPrivateLan = true; // 100.64.0.0/10 CGNAT
      }
      if (isIPv6) {
        const h = host;
        if (h === "::1") isPrivateLan = true; // loopback
        if (h.startsWith("fe80:")) isPrivateLan = true; // link-local
        if (h.startsWith("fc") || h.startsWith("fd")) isPrivateLan = true; // unique local
      }

      const isLocal = isLocalHostname || isPrivateLan;
      if (isLocal) return rawUrl;
      // Remote host → используем локальный прокси
      return `http://localhost:8502/api/mcp/@${rawUrl}`;
    } catch {
      // Если URL некорректный — возвращаем как есть
      return rawUrl;
    }
  };
  const effectiveUrl = resolveUrlForTransport(server.url);

  const connection = useMcp({
    url: effectiveUrl,
    debug: true,
    autoRetry: false,
    popupFeatures: "width=500,height=600,resizable=yes,scrollbars=yes",
    transportType: server.transportType,
    callbackUrl: window.location.origin + "/oauth/callback",
    clientName: "GigaAgent",
    onPopupWindow: (popup) => {
      // Track popup for UX
      console.log("OAuth popup opened:", popup);
    },
    preventAutoAuth: false, // Prevent automatic popups on page load
  });

  // Update parent component with connection data
  useEffect(() => {
    onConnectionUpdate(server.id, connection);
  }, [
    server.id,
    connection.state,
    connection.tools,
    connection.error,
    connection.log.length,
    connection.authUrl,
  ]);

  // Return null as this is just a hook wrapper
  return null;
}

const MCPConnectionMemo = React.memo(
  McpConnection,
  (prev, next) => prev.server.url === next.server.url,
);

interface McpServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onToolsUpdate?: (tools: Tool[]) => void;
}

const McpServerModal: React.FC<McpServerModalProps> = ({
  isOpen,
  onClose,
  onToolsUpdate,
}) => {
  // Ретрансляция OAuth-сообщений из BroadcastChannel в window.postMessage для use-mcp
  useEffect(() => {
    if (!isOpen) return;
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel("mcp_auth");
      channel.onmessage = (ev: MessageEvent) => {
        const data = (ev as MessageEvent).data;
        if (data?.type === "mcp_auth_callback") {
          console.log(data);
          window.postMessage(data, window.location.origin);
        }
      };
    } catch (_e) {
      // Если BroadcastChannel недоступен — ничего не делаем здесь
    }
    return () => {
      try {
        if (channel) channel.close();
      } catch {
        // ignore
      }
    };
  }, [isOpen]);

  const [servers, setServers] = useState<McpServer[]>(() => {
    const stored = localStorage.getItem("mcpServers");
    return stored ? JSON.parse(stored) : [];
  });
  const [newServerUrl, setNewServerUrl] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [connectionData, setConnectionData] = useState<Record<string, any>>({});
  const [serverToolCounts, setServerToolCounts] = useState<
    Record<string, number>
  >(() => {
    const stored = localStorage.getItem("mcpServerToolCounts");
    return stored ? JSON.parse(stored) : {};
  });
  const [transportType, _setTransportType] = useState<"auto" | "http" | "sse">(
    () => {
      const stored = localStorage.getItem("mcpTransportType");
      return (stored as "auto" | "http" | "sse") || "auto";
    },
  );
  const [newServerTransportType, setNewServerTransportType] = useState<
    "auto" | "http" | "sse"
  >("auto");

  // Helper to cycle through new server transport types
  const cycleNewServerTransportType = () => {
    setNewServerTransportType((current) => {
      switch (current) {
        case "auto":
          return "http";
        case "http":
          return "sse";
        case "sse":
          return "auto";
        default:
          return "http";
      }
    });
  };
  // const logRef = useRef<HTMLDivElement>(null) // Removed for now as debug logs not implemented in multi-server version

  // Save servers to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("mcpServers", JSON.stringify(servers));
  }, [servers]);

  // Save tool counts to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(
      "mcpServerToolCounts",
      JSON.stringify(serverToolCounts),
    );
  }, [serverToolCounts]);

  // Save transport type to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("mcpTransportType", transportType);
  }, [transportType]);

  // Dialog сам управляет оверлеем/скроллом

  // Aggregate all tools from enabled servers and notify parent
  useEffect(() => {
    const allTools: Tool[] = [];

    servers.forEach((server) => {
      if (server.enabled && connectionData[server.id]?.tools) {
        const serverTools = connectionData[server.id].tools.map((t: Tool) => ({
          ...t,
          callTool: (args: Record<string, unknown>) =>
            connectionData[server.id].callTool(t.name, args),
        }));
        allTools.push(...serverTools);
      }
    });

    if (onToolsUpdate) {
      onToolsUpdate(allTools);
    }
  }, [servers, connectionData, onToolsUpdate]);

  // Handle adding a new server
  const handleAddServer = () => {
    if (!newServerUrl.trim()) return;

    const newServer: McpServer = {
      id: Date.now().toString(),
      url: newServerUrl.trim(),
      enabled: true,
      name: new URL(newServerUrl.trim()).hostname,
      transportType: newServerTransportType,
    };

    setServers((prev) => [...prev, newServer]);
    setNewServerUrl("");
  };

  // Handle removing a server
  const handleRemoveServer = (serverId: string) => {
    // Disconnect if connected
    const connection = connectionData[serverId];
    if (connection?.disconnect) {
      connection.disconnect();
    }

    setServers((prev) => prev.filter((s) => s.id !== serverId));
    setConnectionData((prev) => {
      const newData = { ...prev };
      delete newData[serverId];
      return newData;
    });
    setServerToolCounts((prev) => {
      const newCounts = { ...prev };
      delete newCounts[serverId];
      return newCounts;
    });
  };

  // Handle toggling server enabled state
  const handleToggleServer = (serverId: string) => {
    setServers((prev) =>
      prev.map((server) =>
        server.id === serverId
          ? { ...server, enabled: !server.enabled }
          : server,
      ),
    );

    // If disabling, disconnect
    const server = servers.find((s) => s.id === serverId);
    if (server?.enabled && connectionData[serverId]?.disconnect) {
      connectionData[serverId].disconnect();
    }
  };

  // Handle connection update for a specific server
  const handleConnectionUpdate = (serverId: string, data: any) => {
    setConnectionData((prev) => ({
      ...prev,
      [serverId]: data,
    }));

    // Store tool count for this server (even if it gets disabled later)
    if (data.tools && Array.isArray(data.tools)) {
      setServerToolCounts((prev) => ({
        ...prev,
        [serverId]: data.tools.length,
      }));
    }
  };

  // Handle authentication for a specific server
  const handleManualAuth = (serverId: string) => {
    try {
      const connection = connectionData[serverId];
      connection.authenticate();
    } catch (err) {
      console.error("Authentication error:", err);
    }
  };

  // Generate status badge based on connection state
  const getStatusBadge = (state: string) => {
    switch (state) {
      case "discovering":
        return <Badge variant="secondary">Discovering</Badge>;
      case "pending_auth":
        return <Badge variant="outline">Authentication Required</Badge>;
      case "authenticating":
        return <Badge variant="secondary">Authenticating</Badge>;
      case "connecting":
        return <Badge variant="secondary">Connecting</Badge>;
      case "loading":
        return <Badge variant="secondary">Loading</Badge>;
      case "ready":
        return <Badge>Connected</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      case "not-connected":
      default:
        return <Badge variant="outline">Not Connected</Badge>;
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="w-full max-w-3xl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>MCP Servers</DialogTitle>
              {/*<Button*/}
              {/*  variant="outline"*/}
              {/*  size="icon"*/}
              {/*  onClick={() => setShowSettings(!showSettings)}*/}
              {/*  aria-label="Settings"*/}
              {/*>*/}
              {/*  <Settings size={16} />*/}
              {/*</Button>*/}
            </div>
            <DialogDescription>
              <span className="inline-flex items-center gap-2">
                <Info size={16} />
                Connect to Model Context Protocol (MCP) servers to access
                additional AI capabilities.
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto max-h-[60vh]">
            {/* Server List */}
            <div className="space-y-4 mb-6">
              {servers.map((server) => {
                const connection = connectionData[server.id] || {
                  state: "not-connected",
                  tools: [],
                  error: undefined,
                  authUrl: undefined,
                };
                const { state, tools, error, authUrl } = connection;

                return (
                  <div
                    key={server.id}
                    className={`bg-card border shadow-none dark:border-t-1 dark:border-l-0 dark:border-r-0 dark:border-b-0 dark:shadow-md border-highlight rounded-lg p-4 ${server.enabled ? "" : "bg-muted"}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="font-medium text-foreground">
                            {server.name || "MCP Server"}
                          </div>
                          <div className="text-sm text-muted-foreground break-all">
                            {server.url}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {getStatusBadge(server.enabled ? state : "disabled")}
                        {server.enabled && state === "ready" && (
                          <Badge variant="outline" className="font-mono">
                            {server.transportType.toUpperCase()}
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleServer(server.id)}
                          title={
                            server.enabled ? "Disable server" : "Enable server"
                          }
                          aria-label={
                            server.enabled ? "Disable server" : "Enable server"
                          }
                        >
                          {server.enabled ? (
                            <Power size={16} />
                          ) : (
                            <PowerOff size={16} />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveServer(server.id)}
                          title="Delete server"
                          aria-label="Delete server"
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </div>

                    {server.enabled && (
                      <>
                        {error && state === "failed" && (
                          <Alert variant="destructive" className="mb-3">
                            <AlertDescription>{error}</AlertDescription>
                          </Alert>
                        )}

                        {(state === "pending_auth" || authUrl) && (
                          <div className="border rounded p-3 mb-3">
                            <p className="text-sm mb-2">
                              {state === "pending_auth"
                                ? "Authentication is required to connect to this server."
                                : "Authentication popup was blocked. You can open the authentication page manually:"}
                            </p>
                            <div className="space-y-2">
                              <Button
                                className="w-full"
                                onClick={() => handleManualAuth(server.id)}
                              >
                                Open Authentication Popup
                              </Button>
                              {authUrl && (
                                <a
                                  href={authUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block text-center text-sm text-primary underline"
                                >
                                  Or open in new tab instead
                                </a>
                              )}
                            </div>
                          </div>
                        )}

                        {state === "ready" && tools.length > 0 && (
                          <div>
                            <h4 className="font-medium text-sm mb-2">
                              Available Tools ({tools.length})
                            </h4>
                            <div className="border rounded p-2 bg-muted max-h-24 overflow-y-auto space-y-1">
                              {tools.map((tool: Tool, index: number) => (
                                <div key={index} className="text-xs">
                                  <span className="font-medium">
                                    {tool.name}
                                  </span>
                                  {tool.description && (
                                    <span className="text-muted-foreground ml-2">
                                      - {tool.description}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}

              {servers.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Info size={24} className="mx-auto mb-2" />
                  <p>No MCP servers configured yet.</p>
                  <p className="text-sm">Add your first server below.</p>
                </div>
              )}
            </div>

            {/* Add New Server */}
            <div className="border-t pt-4">
              <div className="flex items-center gap-3 mb-3">
                <h3 className="font-medium text-sm">Add New Server</h3>
                <Badge
                  variant="outline"
                  className="cursor-pointer font-mono"
                  onClick={cycleNewServerTransportType}
                  title="Click to cycle through transport types"
                >
                  {newServerTransportType.toUpperCase()}
                </Badge>
              </div>
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Enter MCP server URL"
                  value={newServerUrl}
                  onChange={(e) => setNewServerUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddServer();
                    }
                  }}
                />
                <Button
                  onClick={handleAddServer}
                  disabled={!newServerUrl.trim()}
                >
                  <Plus size={16} />
                  Add
                </Button>
              </div>
            </div>

            {/* Debug Info */}
            {showSettings && (
              <div className="border-t pt-4 mt-4">
                <h3 className="font-medium text-sm mb-3">Debug Information</h3>
                <div className="text-xs space-y-2">
                  <div>Total Servers: {servers.length}</div>
                  <div>
                    Enabled Servers: {servers.filter((s) => s.enabled).length}
                  </div>
                  <div>
                    Connected Servers:{" "}
                    {
                      Object.values(connectionData).filter(
                        (c: any) => c.state === "ready",
                      ).length
                    }
                  </div>
                  <div>
                    Total Tools:{" "}
                    {Object.values(connectionData).reduce(
                      (sum: number, c: any) => sum + (c.tools?.length || 0),
                      0,
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Render MCP connections for all enabled servers */}
      {servers
        .filter((s) => s.enabled)
        .map((server) => (
          <MCPConnectionMemo
            key={server.id}
            server={server}
            onConnectionUpdate={handleConnectionUpdate}
          />
        ))}
    </>
  );
};

export default McpServerModal;
