import {
  Cpu,
  Activity,
  Clock,
  Shield,
  Database,
  Wifi,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { HudPanel } from "./HudPanel";
import { useAppContext } from "./AppContextProvider";
import { monitoring } from "@/lib/monitoring-service";
import { cn } from "@/lib/utils";

export function HealthHud() {
  const { metrics, currentRoute, activeWorkflow } = useAppContext();
  const healthStatus = monitoring.getHealthStatus();

  const getStatusColor = (status: string) => {
    if (status === "online" || status === "healthy") return "text-[var(--hud-success)]";
    if (status === "degraded" || status === "warning") return "text-yellow-400";
    return "text-red-500";
  };

  const getStatusIcon = (status: string) => {
    if (status === "online" || status === "healthy") return <CheckCircle className="h-3 w-3" />;
    if (status === "degraded" || status === "warning") return <AlertTriangle className="h-3 w-3" />;
    return <XCircle className="h-3 w-3" />;
  };

  return (
    <HudPanel
      title="System Intelligence"
      subtitle={`Health: ${healthStatus.toUpperCase()}`}
      className={cn(
        "mb-4 w-64 border-l-4 transition-all duration-500",
        healthStatus === "healthy"
          ? "border-l-[var(--hud-success)]"
          : healthStatus === "warning"
            ? "border-l-yellow-400"
            : "border-l-red-500",
      )}
    >
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="rounded-md border border-border/40 bg-background/40 p-2">
          <div className="flex items-center justify-between">
            <Activity className="h-3 w-3 text-primary" />
            <span className="text-[10px] font-mono text-muted-foreground">{metrics.latency}ms</span>
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            Latency
          </div>
        </div>
        <div className="rounded-md border border-border/40 bg-background/40 p-2">
          <div className="flex items-center justify-between">
            <Clock className="h-3 w-3 text-primary" />
            <span className="text-[10px] font-mono text-muted-foreground">{metrics.uptime}s</span>
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            Uptime
          </div>
        </div>
      </div>

      <div className="space-y-2 text-[10px] font-mono">
        <div className="flex items-center justify-between p-1.5 rounded bg-background/20">
          <div className="flex items-center gap-2">
            <Wifi className="h-3 w-3" />
            <span>API</span>
          </div>
          <div className={cn("flex items-center gap-1", getStatusColor(metrics.apiStatus))}>
            {getStatusIcon(metrics.apiStatus)}
            <span>{metrics.apiStatus.toUpperCase()}</span>
          </div>
        </div>

        <div className="flex items-center justify-between p-1.5 rounded bg-background/20">
          <div className="flex items-center gap-2">
            <Database className="h-3 w-3" />
            <span>DB</span>
          </div>
          <div className={cn("flex items-center gap-1", getStatusColor(metrics.dbStatus))}>
            {getStatusIcon(metrics.dbStatus)}
            <span>{metrics.dbStatus.toUpperCase()}</span>
          </div>
        </div>

        <div className="flex items-center justify-between p-1.5 rounded bg-background/20">
          <div className="flex items-center gap-2">
            <Shield className="h-3 w-3" />
            <span>AUTH</span>
          </div>
          <div className={cn("flex items-center gap-1", getStatusColor(metrics.authStatus))}>
            {getStatusIcon(metrics.authStatus)}
            <span>{metrics.authStatus.toUpperCase()}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-border/40">
        <div className="flex flex-col gap-1 text-[10px] text-muted-foreground uppercase tracking-widest">
          <div className="flex justify-between">
            <span>Route:</span>
            <span className="text-foreground truncate ml-2">{currentRoute}</span>
          </div>
          {activeWorkflow && (
            <div className="flex justify-between">
              <span>Workflow:</span>
              <span className="text-primary truncate ml-2">{activeWorkflow}</span>
            </div>
          )}
          <div className="flex justify-between mt-1">
            <span>Errors:</span>
            <span className={cn(metrics.errorCount > 0 ? "text-red-500" : "text-muted-foreground")}>
              {metrics.errorCount}
            </span>
          </div>
        </div>
      </div>
    </HudPanel>
  );
}
